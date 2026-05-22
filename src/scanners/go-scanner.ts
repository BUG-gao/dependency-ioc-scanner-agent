import { dependencyRecord, readText } from "./scanner-utils.js";
import type { DependencyRecord } from "../types.js";

export async function scanGoFile(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  return filePath.endsWith("go.sum") ? scanGoSum(filePath, content) : scanGoMod(filePath, content);
}

function scanGoMod(filePath: string, content: string): DependencyRecord[] {
  const records: DependencyRecord[] = [];
  const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/m)?.[1] ?? "";
  const singleRequires = [...content.matchAll(/^require\s+([^\s(]+)\s+(\S+)/gm)].map((match) => [match[1], match[2]]);
  const blockRequires = [...requireBlock.matchAll(/^\s*(\S+)\s+(\S+)/gm)].map((match) => [match[1], match[2]]);

  for (const [name, version] of [...singleRequires, ...blockRequires]) {
    records.push(dependencyRecord(name, version, filePath, "go", "go.mod"));
  }

  return records;
}

function scanGoSum(filePath: string, content: string): DependencyRecord[] {
  return [...content.matchAll(/^(\S+)\s+(v\S+)\s+/gm)].map((match) =>
    dependencyRecord(match[1], match[2], filePath, "go", "go.sum", true)
  );
}
