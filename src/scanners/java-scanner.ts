import { parseStringPromise } from "xml2js";
import { dependencyRecord, readText, stripQuotes } from "./scanner-utils.js";
import type { DependencyRecord } from "../types.js";

export async function scanJavaFile(filePath: string): Promise<DependencyRecord[]> {
  if (filePath.endsWith("pom.xml")) {
    return scanPom(filePath);
  }
  if (filePath.endsWith("build.gradle")) {
    return scanGradle(filePath);
  }
  return [];
}

async function scanPom(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  const parsed = await parseStringPromise(content, { explicitArray: false }) as {
    project?: { dependencies?: { dependency?: PomDependency | PomDependency[] } };
  };
  const dependencies = parsed.project?.dependencies?.dependency;
  const items = Array.isArray(dependencies) ? dependencies : dependencies ? [dependencies] : [];

  return items.flatMap((item) => {
    if (!item.artifactId || !item.version) {
      return [];
    }
    return [
      dependencyRecord(`${item.groupId ?? ""}:${item.artifactId}`.replace(/^:/, ""), item.version, filePath, "java", "pom.xml")
    ];
  });
}

async function scanGradle(filePath: string): Promise<DependencyRecord[]> {
  const content = await readText(filePath);
  if (!content) return [];
  const records: DependencyRecord[] = [];
  const compactPattern = /\b(?:implementation|api|compileOnly|runtimeOnly|testImplementation|classpath)\s+['"]([^:'"]+):([^:'"]+):([^'"]+)['"]/g;
  const mapPattern = /\b(?:implementation|api|compileOnly|runtimeOnly|testImplementation|classpath)\s+group:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*version:\s*['"]([^'"]+)['"]/g;

  for (const match of content.matchAll(compactPattern)) {
    records.push(dependencyRecord(`${match[1]}:${match[2]}`, stripQuotes(match[3]), filePath, "java", "build.gradle"));
  }
  for (const match of content.matchAll(mapPattern)) {
    records.push(dependencyRecord(`${match[1]}:${match[2]}`, stripQuotes(match[3]), filePath, "java", "build.gradle"));
  }

  return records;
}

interface PomDependency {
  groupId?: string;
  artifactId?: string;
  version?: string;
}
