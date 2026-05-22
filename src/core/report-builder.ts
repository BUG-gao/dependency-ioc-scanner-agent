import path from "node:path";
import type { AutoScanResult, ScanResult, SupplyChainScanResult } from "../types.js";

export function buildMarkdownReport(result: ScanResult): string {
  const lines = [
    "# Dependency IOC Scan Result",
    "",
    "IOC:",
    "",
    result.ioc.raw,
    "",
    `扫描项目：${result.projectCount}`,
    "",
    `发现风险：${result.riskCount}`,
    ""
  ];

  for (const project of result.projects) {
    lines.push(`项目：${project.project.name}`, "");
    if (project.matches.length === 0) {
      lines.push("未发现", "");
      continue;
    }

    for (const match of project.matches) {
      lines.push(`文件：${path.relative(project.project.path, match.dependency.filePath) || match.dependency.filePath}`);
      lines.push("");
      lines.push(`发现：${match.dependency.packageName}@${match.dependency.version}`);
      lines.push("");
      lines.push(`状态：${match.status}`);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function buildSupplyChainMarkdownReport(result: SupplyChainScanResult): string {
  const lines = [
    "# Supply Chain IOC Scan Result",
    "",
    `提炼 IOC：${result.indicators.length}`,
    "",
    `扫描项目：${result.projectCount}`,
    "",
    `发现风险：${result.riskCount}`,
    ""
  ];

  if (result.indicators.length > 0) {
    lines.push("IOC 列表：", "");
    for (const indicator of result.indicators) {
      lines.push(`- ${indicator.kind}: ${indicator.value}`);
    }
    lines.push("");
  }

  for (const project of result.projects) {
    lines.push(`项目：${project.project.name}`, "");
    if (project.matches.length === 0) {
      lines.push("未发现", "");
      continue;
    }

    for (const match of project.matches) {
      lines.push(`文件：${path.relative(project.project.path, match.filePath) || match.filePath}`);
      lines.push("");
      lines.push(`IOC：${match.indicator.kind} ${match.indicator.value}`);
      lines.push("");
      lines.push(`证据：${match.evidence}`);
      lines.push("");
      lines.push(`状态：${match.status}`);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function buildAutoScanMarkdownReport(result: AutoScanResult): string {
  const lines = [
    "# Security Notice Auto Scan Result",
    "",
    `提炼依赖版本 IOC：${result.analysis.dependencyIocs.length}`,
    "",
    `提炼供应链 IOC：${result.analysis.supplyChainIndicators.length}`,
    ""
  ];

  for (const dependencyResult of result.dependencyResults) {
    lines.push(buildMarkdownReport(dependencyResult).trimEnd(), "");
  }

  if (result.supplyChainResult) {
    lines.push(buildSupplyChainMarkdownReport(result.supplyChainResult).trimEnd(), "");
  }

  return lines.join("\n").trimEnd() + "\n";
}
