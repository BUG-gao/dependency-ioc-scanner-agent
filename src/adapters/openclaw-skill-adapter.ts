import { loadConfig, resolveConfigPath } from "../core/config.js";
import { scanProjects } from "../core/dependency-scanner.js";
import { buildAutoScanMarkdownReport, buildMarkdownReport } from "../core/report-builder.js";
import { analyzeSecurityNotice } from "../core/security-notice-parser.js";
import { scanSupplyChainIndicators } from "../core/supply-chain-scanner.js";
import type { AutoScanResult, ProjectConfig, ScanResult } from "../types.js";

export interface OpenClawSkillInput {
  ioc_text?: string;
  notice_text?: string;
  projects?: ProjectConfig[];
  configPath?: string;
  format?: "markdown" | "json";
}

export interface OpenClawSkillOutput {
  result: ScanResult | AutoScanResult;
  report: string;
}

export async function runOpenClawSkill(input: OpenClawSkillInput): Promise<OpenClawSkillOutput> {
  const projects = input.projects ?? (await loadConfig(await resolveConfigPath(input.configPath))).projects;
  const text = input.notice_text ?? input.ioc_text;
  if (!text) {
    throw new Error("ioc_text or notice_text is required.");
  }

  if (input.notice_text || looksLikeSecurityNotice(text)) {
    const analysis = analyzeSecurityNotice(text);
    const dependencyResults = await Promise.all(analysis.dependencyIocs.map((ioc) => scanProjects(ioc, projects)));
    const supplyChainResult = analysis.supplyChainIndicators.length > 0
      ? await scanSupplyChainIndicators(text, analysis.supplyChainIndicators, projects)
      : undefined;
    const result: AutoScanResult = { analysis, dependencyResults, supplyChainResult };
    return {
      result,
      report: input.format === "json" ? JSON.stringify(result, null, 2) : buildAutoScanMarkdownReport(result)
    };
  }

  const result = await scanProjects(text, projects);
  return {
    result,
    report: input.format === "json" ? JSON.stringify(result, null, 2) : buildMarkdownReport(result)
  };
}

export const handler = runOpenClawSkill;

function looksLikeSecurityNotice(text: string): boolean {
  return /https?:\/\/|IOCs?|投毒|preinstall|postinstall|node_modules|GitHub|恶意|失陷指标|t\.m-kosche\.com/i.test(text);
}
