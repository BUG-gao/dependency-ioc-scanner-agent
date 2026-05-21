#!/usr/bin/env node
import { Command } from "commander";
import { getDefaultGlobalConfigPath, loadConfig, resolveConfigPath } from "../core/config.js";
import { scanProjects } from "../core/dependency-scanner.js";
import { buildMarkdownReport } from "../core/report-builder.js";

const program = new Command();

program
  .name("ioc-scan")
  .description("Scan configured projects for dependency IOC version matches.")
  .requiredOption("--ioc <text>", "IOC text, for example: axios 1.14.1")
  .option("--config <path>", `YAML project config path. Defaults to ./config/projects.yaml or ${getDefaultGlobalConfigPath()}`)
  .option("--json", "Print JSON instead of Markdown")
  .action(async (options: { ioc: string; config?: string; json?: boolean }) => {
    const configPath = await resolveConfigPath(options.config);
    const config = await loadConfig(configPath);
    const result = await scanProjects(options.ioc, config.projects);
    process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : buildMarkdownReport(result));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ioc-scan failed: ${message}\n`);
  process.exitCode = 1;
});
