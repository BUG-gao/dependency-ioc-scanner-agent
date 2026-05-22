import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { glob } from "glob";
import type {
  ProjectConfig,
  SupplyChainIndicator,
  SupplyChainMatch,
  SupplyChainScanResult
} from "../types.js";

const TEXT_PATTERNS = [
  "**/package.json",
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
  "**/README*",
  "**/*.js",
  "**/*.cjs",
  "**/*.mjs",
  "**/*.ts",
  "**/*.sh",
  "**/*.json",
  "**/*.yaml",
  "**/*.yml",
  "**/*.md"
];

const IGNORE_PATTERNS = ["**/.git/**", "**/dist/**", "**/build/**", "**/coverage/**"];
const MAX_TEXT_FILE_BYTES = 1024 * 1024;

export async function scanSupplyChainIndicators(
  notice: string,
  indicators: SupplyChainIndicator[],
  projects: ProjectConfig[]
): Promise<SupplyChainScanResult> {
  const projectResults = [];

  for (const project of projects) {
    const matches = await scanProject(project, indicators);
    projectResults.push({ project, matches });
  }

  return {
    notice,
    indicators,
    projectCount: projects.length,
    riskCount: projectResults.reduce((count, project) => count + project.matches.length, 0),
    projects: projectResults
  };
}

async function scanProject(project: ProjectConfig, indicators: SupplyChainIndicator[]): Promise<SupplyChainMatch[]> {
  const files = await glob(TEXT_PATTERNS, {
    cwd: project.path,
    absolute: true,
    ignore: IGNORE_PATTERNS,
    nodir: true,
    dot: true
  });

  const matches = await Promise.all(files.map((filePath) => scanFile(project, filePath, indicators)));
  return matches
    .flat()
    .sort((a, b) => path.relative(project.path, a.filePath).localeCompare(path.relative(project.path, b.filePath)));
}

async function scanFile(
  project: ProjectConfig,
  filePath: string,
  indicators: SupplyChainIndicator[]
): Promise<SupplyChainMatch[]> {
  const content = await readSmallTextFile(filePath);
  if (content === null) {
    return [];
  }

  const matches: SupplyChainMatch[] = [];

  if (filePath.endsWith("package.json")) {
    matches.push(...scanPackageJson(project, filePath, content, indicators));
  }

  for (const indicator of indicators) {
    if (indicator.kind === "repository-pattern") {
      continue;
    }

    if (indicator.kind === "lifecycle-script" || indicator.kind === "github-dependency") {
      continue;
    }

    if (content.includes(indicator.value)) {
      matches.push(toMatch(project, filePath, indicator, lineEvidence(content, indicator.value)));
    }
  }

  return dedupeMatches(matches);
}

function scanPackageJson(
  project: ProjectConfig,
  filePath: string,
  content: string,
  indicators: SupplyChainIndicator[]
): SupplyChainMatch[] {
  let parsed: {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch {
    return [];
  }

  const matches: SupplyChainMatch[] = [];

  for (const indicator of indicators) {
    if (indicator.kind === "lifecycle-script") {
      const [scriptName, expectedCommand] = indicator.value.split(/:(.*)/s);
      const actualCommand = parsed.scripts?.[scriptName];
      if (actualCommand && (expectedCommand === "*" || actualCommand === expectedCommand)) {
        matches.push(toMatch(project, filePath, indicator, `"${scriptName}": "${actualCommand}"`));
      }
    }

    if (indicator.kind === "github-dependency") {
      const [packageName, expectedSpec] = indicator.value.split(/:(.*)/s);
      for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const) {
        const actualSpec = parsed[section]?.[packageName];
        if (actualSpec && actualSpec === expectedSpec) {
          matches.push(toMatch(project, filePath, indicator, `"${packageName}": "${actualSpec}"`));
        }
      }
    }

    if (indicator.kind === "repository-pattern" && parsed.name && /^[a-z]+-[a-z]+-\d{3}$/.test(parsed.name)) {
      matches.push(toMatch(project, filePath, indicator, `"name": "${parsed.name}"`));
    }
  }

  return matches;
}

async function readSmallTextFile(filePath: string): Promise<string | null> {
  try {
    const info = await stat(filePath);
    if (info.size > MAX_TEXT_FILE_BYTES) {
      return null;
    }
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function toMatch(
  project: ProjectConfig,
  filePath: string,
  indicator: SupplyChainIndicator,
  evidence: string
): SupplyChainMatch {
  return {
    project,
    filePath: path.resolve(filePath),
    indicator,
    evidence,
    status: "Potential Supply Chain Risk"
  };
}

function lineEvidence(content: string, needle: string): string {
  const line = content.split(/\r?\n/).find((item) => item.includes(needle));
  return (line ?? needle).trim();
}

function dedupeMatches(matches: SupplyChainMatch[]): SupplyChainMatch[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.filePath}:${match.indicator.kind}:${match.indicator.value}:${match.evidence}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
