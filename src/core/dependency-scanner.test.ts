import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanProjects } from "./dependency-scanner.js";
import { parseIoc } from "./ioc-parser.js";
import { versionMatches } from "./version-matcher.js";
import { buildMarkdownReport } from "./report-builder.js";

describe("IOC parser", () => {
  it("parses exact versions and ranges", () => {
    expect(parseIoc("axios 1.14.1")).toMatchObject({
      packageName: "axios",
      constraints: [{ kind: "exact", version: "1.14.1" }]
    });
    expect(parseIoc("axios >=1.14.0 <1.15.0")).toMatchObject({
      packageName: "axios",
      constraints: [{ kind: "range" }]
    });
  });
});

describe("version matcher", () => {
  it("matches exact IOC versions against exact and ranged dependency specs", () => {
    expect(versionMatches({ kind: "exact", version: "1.14.1" }, "1.14.1")).toBe(true);
    expect(versionMatches({ kind: "exact", version: "1.14.1" }, "^1.14.0")).toBe(true);
    expect(versionMatches({ kind: "exact", version: "1.14.1" }, "^2.0.0")).toBe(false);
  });
});

describe("dependency scanner", () => {
  it("scans configured project manifests and builds reports", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ioc-scan-"));
    const projectA = path.join(root, "goplus_web");
    const projectB = path.join(root, "secware");
    await mkdir(projectA);
    await mkdir(projectB);
    await writeFile(path.join(projectA, "package.json"), JSON.stringify({ dependencies: { axios: "1.14.1" } }));
    await writeFile(path.join(projectB, "requirements.txt"), "requests==2.31.0\n");

    const result = await scanProjects("axios 1.14.1", [
      { name: "goplus_web", path: projectA },
      { name: "secware", path: projectB }
    ]);

    expect(result.riskCount).toBe(1);
    expect(result.projects[0].matches[0].dependency.packageName).toBe("axios");
    expect(buildMarkdownReport(result)).toContain("状态：Potential Risk");
    expect(buildMarkdownReport(result)).toContain("未发现");
  });
});
