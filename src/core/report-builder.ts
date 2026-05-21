import path from "node:path";
import type { ScanResult } from "../types.js";

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
