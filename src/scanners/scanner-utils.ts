import path from "node:path";
import { readFile } from "node:fs/promises";
import type { DependencyRecord, Ecosystem } from "../types.js";

export async function readText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export function dependencyRecord(
  packageName: string,
  version: string,
  filePath: string,
  ecosystem: Ecosystem,
  source: string,
  isInstalledVersion = false
): DependencyRecord {
  return {
    packageName,
    version: stripQuotes(String(version)),
    filePath: path.resolve(filePath),
    ecosystem,
    source,
    isInstalledVersion
  };
}

export function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}
