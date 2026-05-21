import { loadConfig, resolveConfigPath } from "../core/config.js";
import { scanProjects } from "../core/dependency-scanner.js";
import { buildMarkdownReport } from "../core/report-builder.js";
import type { ProjectConfig, ScanResult } from "../types.js";

export interface OpenClawSkillInput {
  ioc_text: string;
  projects?: ProjectConfig[];
  configPath?: string;
  format?: "markdown" | "json";
}

export interface OpenClawSkillOutput {
  result: ScanResult;
  report: string;
}

export async function runOpenClawSkill(input: OpenClawSkillInput): Promise<OpenClawSkillOutput> {
  const projects = input.projects ?? (await loadConfig(await resolveConfigPath(input.configPath))).projects;
  const result = await scanProjects(input.ioc_text, projects);
  return {
    result,
    report: input.format === "json" ? JSON.stringify(result, null, 2) : buildMarkdownReport(result)
  };
}

export const handler = runOpenClawSkill;
