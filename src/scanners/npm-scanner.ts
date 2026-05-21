import YAML from "yaml";
import { dependencyRecord, readText } from "./scanner-utils.js";
import type { DependencyRecord } from "../types.js";

const PACKAGE_SECTIONS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

export async function scanNpmFile(filePath: string): Promise<DependencyRecord[]> {
  if (filePath.endsWith("package.json")) {
    return scanPackageJson(filePath);
  }
  if (filePath.endsWith("package-lock.json")) {
    return scanPackageLock(filePath);
  }
  if (filePath.endsWith("pnpm-lock.yaml")) {
    return scanPnpmLock(filePath);
  }
  if (filePath.endsWith("yarn.lock")) {
    return scanYarnLock(filePath);
  }
  return [];
}

async function scanPackageJson(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  const parsed = JSON.parse(content) as Record<string, Record<string, string> | undefined>;
  const records: DependencyRecord[] = [];

  for (const section of PACKAGE_SECTIONS) {
    for (const [name, version] of Object.entries(parsed[section] ?? {})) {
      records.push(dependencyRecord(name, version, filePath, "npm", section));
    }
  }

  return records;
}

async function scanPackageLock(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  const parsed = JSON.parse(content) as {
    packages?: Record<string, { version?: string }>;
    dependencies?: Record<string, { version?: string; dependencies?: Record<string, unknown> }>;
  };
  const records: DependencyRecord[] = [];

  for (const [pkgPath, details] of Object.entries(parsed.packages ?? {})) {
    if (!pkgPath.startsWith("node_modules/") || !details.version) continue;
    records.push(dependencyRecord(pkgPath.replace(/^node_modules\//, ""), details.version, filePath, "npm", "package-lock", true));
  }

  for (const [name, details] of Object.entries(parsed.dependencies ?? {})) {
    if (details.version) {
      records.push(dependencyRecord(name, details.version, filePath, "npm", "package-lock", true));
    }
  }

  return records;
}

async function scanPnpmLock(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  const parsed = YAML.parse(content) as {
    importers?: Record<string, Record<string, Record<string, string | { specifier?: string; version?: string }>>>;
    packages?: Record<string, unknown>;
  };
  const records: DependencyRecord[] = [];

  for (const importer of Object.values(parsed.importers ?? {})) {
    for (const section of PACKAGE_SECTIONS) {
      for (const [name, value] of Object.entries(importer[section] ?? {})) {
        const version = typeof value === "string" ? value : value.version ?? value.specifier;
        if (version) records.push(dependencyRecord(name, version, filePath, "npm", `pnpm:${section}`));
      }
    }
  }

  for (const key of Object.keys(parsed.packages ?? {})) {
    const parsedKey = parsePnpmPackageKey(key);
    if (parsedKey) {
      records.push(dependencyRecord(parsedKey.name, parsedKey.version, filePath, "npm", "pnpm-lock", true));
    }
  }

  return records;
}

async function scanYarnLock(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  const records: DependencyRecord[] = [];
  const blocks = content.split(/\n{2,}/);

  for (const block of blocks) {
    const header = block.split("\n")[0]?.trim().replace(/:$/, "");
    const version = block.match(/^\s+version\s+"?([^"\n]+)"?/m)?.[1];
    if (!header || !version) continue;

    for (const selector of header.split(/,\s*/)) {
      const name = parseYarnSelector(selector.replace(/^"|"$/g, ""));
      if (name) {
        records.push(dependencyRecord(name, version, filePath, "npm", "yarn.lock", true));
      }
    }
  }

  return records;
}

function parsePnpmPackageKey(key: string): { name: string; version: string } | null {
  const clean = key.replace(/^\//, "");
  const atIndex = clean.startsWith("@") ? clean.indexOf("@", 1) : clean.indexOf("@");
  if (atIndex < 0) return null;
  const name = clean.slice(0, atIndex);
  const version = clean.slice(atIndex + 1).split("(")[0];
  return name && version ? { name, version } : null;
}

function parseYarnSelector(selector: string): string | null {
  if (selector.startsWith("@")) {
    const parts = selector.split("@");
    return parts.length >= 3 ? `@${parts[1]}` : null;
  }
  return selector.split("@")[0] || null;
}
