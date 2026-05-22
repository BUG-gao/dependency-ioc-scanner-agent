import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { runOpenClawSkill } from "../adapters/openclaw-skill-adapter.js";
import { scanGoFile } from "../scanners/go-scanner.js";
import { scanJavaFile } from "../scanners/java-scanner.js";
import { scanNpmFile } from "../scanners/npm-scanner.js";
import { scanPythonFile } from "../scanners/python-scanner.js";
import type { DependencyRecord } from "../types.js";
import { loadConfig, resolveConfigPath } from "./config.js";
import { scanProjects } from "./dependency-scanner.js";
import { parseIoc } from "./ioc-parser.js";
import { buildMarkdownReport } from "./report-builder.js";
import { matchDependency, versionMatches } from "./version-matcher.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, "../..");

async function tempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

function names(records: DependencyRecord[]): string[] {
  return records.map((record) => `${record.packageName}@${record.version}`).sort();
}

describe("IOC parser", () => {
  it("parses exact versions, multiple versions, ranges, scoped packages, and Maven coordinates", () => {
    expect(parseIoc("axios 1.14.1")).toMatchObject({
      packageName: "axios",
      constraints: [{ kind: "exact", version: "1.14.1" }]
    });
    expect(parseIoc("axios 1.14.1, 1.14.2").constraints).toEqual([
      { kind: "exact", version: "1.14.1" },
      { kind: "exact", version: "1.14.2" }
    ]);
    expect(parseIoc("axios >=1.14.0 <1.15.0")).toMatchObject({
      packageName: "axios",
      constraints: [{ kind: "range" }]
    });
    expect(parseIoc("@scope/pkg 2.0.1")).toMatchObject({
      packageName: "@scope/pkg",
      constraints: [{ kind: "exact", version: "2.0.1" }]
    });
    expect(parseIoc("org.example:demo-lib 1.2.3")).toMatchObject({
      packageName: "org.example:demo-lib",
      constraints: [{ kind: "exact", version: "1.2.3" }]
    });
  });

  it("rejects empty IOC text and notices without a parseable version", () => {
    expect(() => parseIoc("")).toThrow("IOC text is required");
    expect(() => parseIoc("axios 存在风险")).toThrow("Could not parse version constraint");
  });
});

describe("version matcher", () => {
  it("matches exact IOC versions against exact, ranged, and Python equality dependency specs", () => {
    expect(versionMatches({ kind: "exact", version: "1.14.1" }, "1.14.1")).toBe(true);
    expect(versionMatches({ kind: "exact", version: "1.14.1" }, "^1.14.0")).toBe(true);
    expect(versionMatches({ kind: "exact", version: "2.31.0" }, "==2.31.0")).toBe(true);
    expect(versionMatches({ kind: "exact", version: "2.31.0" }, "~=2.31.0")).toBe(true);
    expect(versionMatches({ kind: "exact", version: "1.14.1" }, "^2.0.0")).toBe(false);
  });

  it("matches IOC ranges against exact dependency versions and intersecting dependency ranges", () => {
    expect(versionMatches({ kind: "range", range: ">=1.0.0 <2.0.0" }, "1.5.0")).toBe(true);
    expect(versionMatches({ kind: "range", range: ">=1.0.0 <2.0.0" }, "^1.4.0")).toBe(true);
    expect(versionMatches({ kind: "range", range: ">=1.0.0 <2.0.0" }, "2.1.0")).toBe(false);
  });

  it("matches Maven artifact names by full coordinate or artifact id", () => {
    const dependency: DependencyRecord = {
      packageName: "org.example:demo-lib",
      version: "1.2.3",
      filePath: "/tmp/pom.xml",
      ecosystem: "java",
      source: "pom.xml",
      isInstalledVersion: false
    };

    expect(matchDependency(parseIoc("org.example:demo-lib 1.2.3"), dependency)).not.toBeNull();
    expect(matchDependency(parseIoc("demo-lib 1.2.3"), dependency)).not.toBeNull();
  });
});

describe("npm scanner", () => {
  it("reads package.json dependency sections", async () => {
    const root = await tempDir("ioc-scan-npm-");
    const filePath = path.join(root, "package.json");
    await writeFile(filePath, JSON.stringify({
      dependencies: { axios: "^1.14.0" },
      devDependencies: { vitest: "4.1.7" },
      peerDependencies: { react: "19.0.0" },
      optionalDependencies: { fsevents: "2.3.3" }
    }));

    expect(names(await scanNpmFile(filePath))).toEqual([
      "axios@^1.14.0",
      "fsevents@2.3.3",
      "react@19.0.0",
      "vitest@4.1.7"
    ]);
  });

  it("reads package-lock, pnpm-lock, and yarn.lock installed versions", async () => {
    const root = await tempDir("ioc-scan-locks-");
    const packageLock = path.join(root, "package-lock.json");
    const pnpmLock = path.join(root, "pnpm-lock.yaml");
    const yarnLock = path.join(root, "yarn.lock");
    await writeFile(packageLock, JSON.stringify({
      packages: {
        "": { version: "1.0.0" },
        "node_modules/axios": { version: "1.14.1" },
        "node_modules/@scope/pkg": { version: "2.0.1" }
      }
    }));
    await writeFile(pnpmLock, [
      "importers:",
      "  .:",
      "    dependencies:",
      "      axios:",
      "        specifier: ^1.14.0",
      "        version: 1.14.1",
      "packages:",
      "  /axios@1.14.1: {}",
      "  /@scope/pkg@2.0.1: {}"
    ].join("\n"));
    await writeFile(yarnLock, [
      "\"axios@^1.14.0\":",
      "  version \"1.14.1\"",
      "",
      "\"@scope/pkg@^2.0.0\":",
      "  version \"2.0.1\""
    ].join("\n"));

    expect(names(await scanNpmFile(packageLock))).toEqual(["@scope/pkg@2.0.1", "axios@1.14.1"]);
    expect(names(await scanNpmFile(pnpmLock))).toEqual(["@scope/pkg@2.0.1", "axios@1.14.1", "axios@1.14.1"]);
    expect(names(await scanNpmFile(yarnLock))).toEqual(["@scope/pkg@2.0.1", "axios@1.14.1"]);
  });
});

describe("go scanner", () => {
  it("reads go.mod and go.sum dependencies", async () => {
    const root = await tempDir("ioc-scan-go-");
    const goMod = path.join(root, "go.mod");
    const goSum = path.join(root, "go.sum");
    await writeFile(goMod, [
      "module example.com/app",
      "require github.com/gin-gonic/gin v1.9.1",
      "require (",
      "  golang.org/x/crypto v0.20.0",
      ")"
    ].join("\n"));
    await writeFile(goSum, "github.com/gin-gonic/gin v1.9.1 h1:abc\n");

    expect(names(await scanGoFile(goMod))).toEqual(["github.com/gin-gonic/gin@v1.9.1", "golang.org/x/crypto@v0.20.0"]);
    expect(names(await scanGoFile(goSum))).toEqual(["github.com/gin-gonic/gin@v1.9.1"]);
  });
});

describe("java scanner", () => {
  it("reads pom.xml and build.gradle dependencies", async () => {
    const root = await tempDir("ioc-scan-java-");
    const pom = path.join(root, "pom.xml");
    const gradle = path.join(root, "build.gradle");
    await writeFile(pom, [
      "<project><dependencies>",
      "<dependency><groupId>org.example</groupId><artifactId>demo-lib</artifactId><version>1.2.3</version></dependency>",
      "</dependencies></project>"
    ].join(""));
    await writeFile(gradle, [
      "dependencies {",
      "  implementation 'org.apache.commons:commons-lang3:3.14.0'",
      "  testImplementation group: 'junit', name: 'junit', version: '4.13.2'",
      "}"
    ].join("\n"));

    expect(names(await scanJavaFile(pom))).toEqual(["org.example:demo-lib@1.2.3"]);
    expect(names(await scanJavaFile(gradle))).toEqual(["junit:junit@4.13.2", "org.apache.commons:commons-lang3@3.14.0"]);
  });
});

describe("python scanner", () => {
  it("reads requirements.txt, pyproject.toml, and Pipfile dependencies", async () => {
    const root = await tempDir("ioc-scan-python-");
    const requirements = path.join(root, "requirements.txt");
    const pyproject = path.join(root, "pyproject.toml");
    const pipfile = path.join(root, "Pipfile");
    await writeFile(requirements, "requests==2.31.0\nfastapi >= 0.110.0\n-r base.txt\n");
    await writeFile(pyproject, [
      "[project]",
      "dependencies = [\"urllib3>=2.0.0\"]",
      "[tool.poetry.dependencies]",
      "python = \"^3.12\"",
      "pydantic = \"^2.0.0\""
    ].join("\n"));
    await writeFile(pipfile, [
      "[packages]",
      "flask = \"==3.0.0\"",
      "[dev-packages]",
      "pytest = \"^8.0.0\""
    ].join("\n"));

    expect(names(await scanPythonFile(requirements))).toEqual(["fastapi@>=0.110.0", "requests@==2.31.0"]);
    expect(names(await scanPythonFile(pyproject))).toEqual(["pydantic@^2.0.0", "urllib3@>=2.0.0"]);
    expect(names(await scanPythonFile(pipfile))).toEqual(["flask@==3.0.0", "pytest@^8.0.0"]);
  });
});

describe("end-to-end project scan", () => {
  it("scans multiple projects, ignores generated directories, and builds markdown reports", async () => {
    const root = await tempDir("ioc-scan-e2e-");
    const projectA = path.join(root, "goplus_web");
    const projectB = path.join(root, "secware");
    await mkdir(path.join(projectA, "node_modules", "ignored"), { recursive: true });
    await mkdir(projectB);
    await writeFile(path.join(projectA, "package.json"), JSON.stringify({ dependencies: { axios: "1.14.1" } }));
    await writeFile(path.join(projectA, "node_modules", "ignored", "package.json"), JSON.stringify({ dependencies: { axios: "9.9.9" } }));
    await writeFile(path.join(projectB, "requirements.txt"), "requests==2.31.0\n");

    const result = await scanProjects("axios 1.14.1", [
      { name: "goplus_web", path: projectA },
      { name: "secware", path: projectB }
    ]);
    const report = buildMarkdownReport(result);

    expect(result.projectCount).toBe(2);
    expect(result.riskCount).toBe(1);
    expect(result.projects[0].matches[0].dependency.packageName).toBe("axios");
    expect(report).toContain("状态：Potential Risk");
    expect(report).toContain("项目：secware");
    expect(report).toContain("未发现");
    expect(report).not.toContain("9.9.9");
  });

  it("matches Python equality pins in project scans", async () => {
    const root = await tempDir("ioc-scan-python-e2e-");
    await writeFile(path.join(root, "requirements.txt"), "requests==2.31.0\n");

    const result = await scanProjects("requests 2.31.0", [{ name: "api", path: root }]);

    expect(result.riskCount).toBe(1);
    expect(result.projects[0].matches[0].dependency.version).toBe("==2.31.0");
  });
});

describe("config", () => {
  it("resolves explicit config paths and loads projects", async () => {
    const root = await tempDir("ioc-scan-config-");
    const configPath = path.join(root, "projects.yaml");
    await writeFile(configPath, "projects:\n  - name: demo\n    path: /tmp/demo\n");

    expect(await resolveConfigPath(configPath)).toBe(configPath);
    await expect(loadConfig(await resolveConfigPath(configPath))).resolves.toEqual({
      projects: [{ name: "demo", path: "/tmp/demo" }]
    });
  });

  it("resolves IOC_SCAN_CONFIG when no explicit path is supplied", async () => {
    const root = await tempDir("ioc-scan-env-config-");
    const configPath = path.join(root, "projects.yaml");
    await writeFile(configPath, "projects:\n  - name: env-demo\n    path: /tmp/env-demo\n");
    const previous = process.env.IOC_SCAN_CONFIG;
    process.env.IOC_SCAN_CONFIG = configPath;

    try {
      expect(await resolveConfigPath()).toBe(configPath);
    } finally {
      if (previous === undefined) {
        delete process.env.IOC_SCAN_CONFIG;
      } else {
        process.env.IOC_SCAN_CONFIG = previous;
      }
    }
  });

  it("rejects invalid project entries", async () => {
    const root = await tempDir("ioc-scan-invalid-config-");
    const configPath = path.join(root, "projects.yaml");
    await writeFile(configPath, "projects:\n  - name: broken\n");

    await expect(loadConfig(configPath)).rejects.toThrow("Each project needs name and path");
  });
});

describe("adapters", () => {
  it("runs openClaw adapter with explicit projects", async () => {
    const root = await tempDir("ioc-scan-skill-");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { axios: "1.14.1" } }));

    const output = await runOpenClawSkill({
      ioc_text: "axios 1.14.1",
      projects: [{ name: "skill-demo", path: root }]
    });

    expect(output.result.riskCount).toBe(1);
    expect(output.report).toContain("项目：skill-demo");
  });

  it("runs CLI with an explicit config path and returns markdown", async () => {
    const root = await tempDir("ioc-scan-cli-");
    const project = path.join(root, "web");
    const configPath = path.join(root, "projects.yaml");
    await mkdir(project);
    await writeFile(path.join(project, "package.json"), JSON.stringify({ dependencies: { axios: "1.14.1" } }));
    await writeFile(configPath, `projects:\n  - name: web\n    path: ${project}\n`);

    const { stdout, stderr } = await execFileAsync(process.execPath, [
      "--import",
      "tsx",
      path.join(repoRoot, "src/adapters/cli-adapter.ts"),
      "--ioc",
      "axios 1.14.1",
      "--config",
      configPath
    ], { cwd: repoRoot });

    expect(stderr).toBe("");
    expect(stdout).toContain("发现风险：1");
    expect(stdout).toContain("项目：web");
  });
});
