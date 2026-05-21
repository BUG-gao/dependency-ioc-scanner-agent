import TOML from "toml";
import { dependencyRecord, readText, stripQuotes } from "./scanner-utils.js";
import type { DependencyRecord } from "../types.js";

export async function scanPythonFile(filePath: string): Promise<DependencyRecord[]> {
  if (filePath.endsWith("requirements.txt")) {
    return scanRequirements(filePath);
  }
  if (filePath.endsWith("pyproject.toml") || filePath.endsWith("Pipfile")) {
    return scanTomlFile(filePath);
  }
  return [];
}

async function scanRequirements(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  const records: DependencyRecord[] = [];
  const pattern = /^([A-Za-z0-9_.-]+)(?:\[[^\]]+])?\s*([<>=!~]{1,2}\s*[^#;\s]+)?/;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line || line.startsWith("-")) continue;
    const match = line.match(pattern);
    if (match?.[1] && match[2]) {
      records.push(dependencyRecord(match[1], match[2].replace(/\s+/g, ""), filePath, "python", "requirements.txt"));
    }
  }

  return records;
}

async function scanTomlFile(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  const parsed = TOML.parse(content) as Record<string, unknown>;
  const records: DependencyRecord[] = [];

  if (filePath.endsWith("pyproject.toml")) {
    const project = parsed.project as { dependencies?: string[]; "optional-dependencies"?: Record<string, string[]> } | undefined;
    for (const dependency of project?.dependencies ?? []) {
      const record = parsePythonDependencyString(dependency, filePath, "pyproject.toml");
      if (record) records.push(record);
    }

    const poetryDependencies = (((parsed.tool as Record<string, unknown> | undefined)?.poetry as Record<string, unknown> | undefined)?.dependencies ?? {}) as Record<string, string>;
    for (const [name, version] of Object.entries(poetryDependencies)) {
      if (name !== "python") records.push(dependencyRecord(name, String(version), filePath, "python", "poetry.dependencies"));
    }
  }

  if (filePath.endsWith("Pipfile")) {
    for (const section of ["packages", "dev-packages"]) {
      for (const [name, version] of Object.entries((parsed[section] as Record<string, string> | undefined) ?? {})) {
        records.push(dependencyRecord(name, String(version), filePath, "python", section));
      }
    }
  }

  return records;
}

function parsePythonDependencyString(value: string, filePath: string, source: string): DependencyRecord | null {
  const match = value.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+])?\s*([<>=!~]{1,2}\s*.+)$/);
  if (!match) return null;
  return dependencyRecord(match[1], stripQuotes(match[2].replace(/\s+/g, "")), filePath, "python", source);
}
