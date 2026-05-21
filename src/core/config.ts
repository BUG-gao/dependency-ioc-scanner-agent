import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { ScannerConfig } from "../types.js";

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
