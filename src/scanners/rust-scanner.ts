import TOML from "toml";
import { dependencyRecord, readText } from "./scanner-utils.js";
import type { DependencyRecord } from "../types.js";

export async function scanRustFile(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  return filePath.endsWith("Cargo.lock") ? scanCargoLock(filePath, content) : scanCargoToml(filePath, content);
}

function scanCargoToml(filePath: string, content: string): DependencyRecord[] {
  const parsed = TOML.parse(content) as Record<string, unknown>;
  const records: DependencyRecord[] = [];

  for (const section of ["dependencies", "dev-dependencies", "build-dependencies"]) {
    for (const [name, value] of Object.entries((parsed[section] as Record<string, unknown> | undefined) ?? {})) {
      const version = rustDependencyVersion(value);
      if (version) {
        records.push(dependencyRecord(name, version, filePath, "rust", section));
      }
    }
  }

  const target = parsed.target as Record<string, Record<string, Record<string, unknown>>> | undefined;
  for (const targetConfig of Object.values(target ?? {})) {
    for (const section of ["dependencies", "dev-dependencies", "build-dependencies"]) {
      for (const [name, value] of Object.entries(targetConfig[section] ?? {})) {
        const version = rustDependencyVersion(value);
        if (version) {
          records.push(dependencyRecord(name, version, filePath, "rust", `target.${section}`));
        }
      }
    }
  }

  return records;
}

function scanCargoLock(filePath: string, content: string): DependencyRecord[] {
  const parsed = TOML.parse(content) as { package?: Array<{ name?: string; version?: string }> };
  return (parsed.package ?? [])
    .filter((item): item is { name: string; version: string } => Boolean(item.name && item.version))
    .map((item) => dependencyRecord(item.name, item.version, filePath, "rust", "Cargo.lock", true));
}

function rustDependencyVersion(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "version" in value) {
    const version = (value as { version?: unknown }).version;
    return typeof version === "string" ? version : null;
  }

  return null;
}
