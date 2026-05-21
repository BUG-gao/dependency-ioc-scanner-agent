import os from "node:os";
import path from "node:path";
import { access, readFile } from "node:fs/promises";
import YAML from "yaml";
import type { ScannerConfig } from "../types.js";

const DEFAULT_LOCAL_CONFIG = path.resolve("config/projects.yaml");
const DEFAULT_GLOBAL_CONFIG = path.join(os.homedir(), ".ioc-scan", "projects.yaml");

export async function loadConfig(configPath: string): Promise<ScannerConfig> {
  const content = await readFile(configPath, "utf8");
  const parsed = YAML.parse(content) as Partial<ScannerConfig> | null;

  if (!parsed || !Array.isArray(parsed.projects)) {
    throw new Error(`Invalid config: ${configPath}. Expected "projects" array.`);
  }

  return {
    projects: parsed.projects.map((project) => {
      if (!project?.name || !project?.path) {
        throw new Error(`Invalid project entry in ${configPath}. Each project needs name and path.`);
      }
      return { name: String(project.name), path: String(project.path) };
    })
  };
}

export async function resolveConfigPath(configPath?: string): Promise<string> {
  if (configPath) {
    return path.resolve(configPath);
  }

  if (process.env.IOC_SCAN_CONFIG) {
    return path.resolve(process.env.IOC_SCAN_CONFIG);
  }

  for (const candidate of [DEFAULT_LOCAL_CONFIG, DEFAULT_GLOBAL_CONFIG]) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    [
      "No project config found.",
      `Create ${DEFAULT_GLOBAL_CONFIG}, create ${DEFAULT_LOCAL_CONFIG}, set IOC_SCAN_CONFIG, or pass --config <path>.`
    ].join(" ")
  );
}

export function getDefaultGlobalConfigPath(): string {
  return DEFAULT_GLOBAL_CONFIG;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
