#!/usr/bin/env node
import { Command } from "commander";
import { collectIocOption, resolveCliIocs } from "../core/cli-ioc-input.js";
import { getDefaultGlobalConfigPath, loadConfig, resolveConfigPath } from "../core/config.js";
import { scanProjects } from "../core/dependency-scanner.js";
import { buildMarkdownReport } from "../core/report-builder.js";

const program = new Command();

program
  .name("ioc-scan")
  .description("Scan configured projects for dependency IOC version matches.")
  .argument("[ioc...]", "short form: axios 1.14.1 axum 0.8")
  .option("-i, --ioc <text>", "IOC text. Can be used multiple times.", collectIocOption)
  .option("-c, --config <path>", `YAML project config path. Defaults to ./config/projects.yaml or ${getDefaultGlobalConfigPath()}`)
  .option("-j, --json", "Print JSON instead of Markdown")
  .showHelpAfterError()
  .action(async (iocParts: string[], options: { ioc?: string[]; config?: string; json?: boolean }) => {
    const iocs = resolveCliIocs(options.ioc, iocParts);
    if (iocs.length === 0) {
      throw new Error("At least one IOC is required. Example: ioc-scan axios 1.14.1");
    }

    const configPath = await resolveConfigPath(options.config);
    const config = await loadConfig(configPath);
    const results = await Promise.all(iocs.map((ioc) => scanProjects(ioc, config.projects)));

    if (options.json) {
      process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
      return;
    }

    process.stdout.write(results.map((result) => buildMarkdownReport(result).trimEnd()).join("\n\n"));
    process.stdout.write("\n");
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ioc-scan failed: ${message}\n`);
  process.exitCode = 1;
});
