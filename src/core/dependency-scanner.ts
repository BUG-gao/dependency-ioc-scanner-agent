import path from "node:path";
import { glob } from "glob";
import { matchDependency } from "./version-matcher.js";
import { parseIoc } from "./ioc-parser.js";
import { scanGoFile } from "../scanners/go-scanner.js";
import { scanJavaFile } from "../scanners/java-scanner.js";
import { scanNpmFile } from "../scanners/npm-scanner.js";
import { scanPythonFile } from "../scanners/python-scanner.js";
import { scanRustFile } from "../scanners/rust-scanner.js";
import type { DependencyRecord, ProjectConfig, ScanResult } from "../types.js";

const SCAN_PATTERNS = [
  "**/package.json",
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
  "**/go.mod",
  "**/go.sum",
  "**/pom.xml",
  "**/build.gradle",
  "**/requirements.txt",
  "**/pyproject.toml",
  "**/Pipfile",
  "**/Cargo.toml",
  "**/Cargo.lock"
];

const IGNORE_PATTERNS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/vendor/**"];

export async function scanProjects(iocText: string, projects: ProjectConfig[]): Promise<ScanResult> {
  const ioc = parseIoc(iocText);
  const projectResults = [];

  for (const project of projects) {
    const dependencies = await scanProjectDependencies(project);
    const matches = dependencies
      .map((dependency) => {
        const matchedBy = matchDependency(ioc, dependency);
        return matchedBy ? { project, dependency, status: "Potential Risk" as const, matchedBy } : null;
      })
      .filter((match): match is NonNullable<typeof match> => match !== null);

    projectResults.push({ project, matches });
  }

  return {
    ioc,
    projectCount: projects.length,
    riskCount: projectResults.reduce((count, project) => count + project.matches.length, 0),
    projects: projectResults
  };
}

export async function scanProjectDependencies(project: ProjectConfig): Promise<DependencyRecord[]> {
  const files = await glob(SCAN_PATTERNS, {
    cwd: project.path,
    absolute: true,
    ignore: IGNORE_PATTERNS,
    nodir: true
  });

  const records = await Promise.all(files.map((file) => scanFile(file)));
  return records.flat().sort((a, b) => path.relative(project.path, a.filePath).localeCompare(path.relative(project.path, b.filePath)));
}

async function scanFile(filePath: string): Promise<DependencyRecord[]> {
  if (/(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(filePath)) {
    return scanNpmFile(filePath);
  }
  if (/(go\.mod|go\.sum)$/.test(filePath)) {
    return scanGoFile(filePath);
  }
  if (/(pom\.xml|build\.gradle)$/.test(filePath)) {
    return scanJavaFile(filePath);
  }
  if (/(requirements\.txt|pyproject\.toml|Pipfile)$/.test(filePath)) {
    return scanPythonFile(filePath);
  }
  if (/(Cargo\.toml|Cargo\.lock)$/.test(filePath)) {
    return scanRustFile(filePath);
  }
  return [];
}
