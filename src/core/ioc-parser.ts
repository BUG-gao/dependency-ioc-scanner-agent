import semver from "semver";
import type { IocConstraint, ParsedIoc } from "../types.js";

const VERSION_TOKEN = /(?:v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?|[~^<>=*xX\d][^\s,;]*)/;
const PACKAGE_TOKEN = /(@[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+|[A-Za-z0-9._-]+(?::[A-Za-z0-9._-]+)?)/;

export function parseIoc(input: string): ParsedIoc {
  const raw = input.trim();
  if (!raw) {
    throw new Error("IOC text is required.");
  }

  const packageMatch = raw.match(PACKAGE_TOKEN);
  if (!packageMatch?.[0]) {
    throw new Error(`Could not parse package name from IOC: ${input}`);
  }

  const packageName = packageMatch[0];
  const versionText = raw.slice((packageMatch.index ?? 0) + packageName.length).trim();
  const constraints = parseConstraints(versionText);

  if (constraints.length === 0) {
    throw new Error(`Could not parse version constraint from IOC: ${input}`);
  }

  return { raw, packageName, constraints };
}

function parseConstraints(versionText: string): IocConstraint[] {
  if (!versionText) {
    return [];
  }

  const chunks = splitVersionChunks(versionText);
  return chunks
    .map((chunk) => {
      const normalized = normalizeVersionText(chunk);
      const exact = semver.valid(normalized);
      if (exact) {
        return { kind: "exact", version: exact } satisfies IocConstraint;
      }

      const range = semver.validRange(normalized);
      if (range) {
        return { kind: "range", range } satisfies IocConstraint;
      }

      return null;
    })
    .filter((constraint): constraint is IocConstraint => constraint !== null);
}

function splitVersionChunks(versionText: string): string[] {
  const cleaned = versionText
    .replace(/[，；;]/g, ",")
    .replace(/\b(and|or)\b/gi, ",")
    .replace(/\s+-\s+/g, " - ");

  if (cleaned.includes(",")) {
    return cleaned.split(",").map((item) => item.trim()).filter(Boolean);
  }

  const tokens = cleaned.match(new RegExp(VERSION_TOKEN.source, "g")) ?? [];
  if (tokens.length > 1 && !/[<>=~^*xX-]/.test(cleaned.replace(tokens.join(""), ""))) {
    return tokens;
  }

  return [cleaned.trim()];
}

function normalizeVersionText(versionText: string): string {
  return versionText
    .replace(/^version\s+/i, "")
    .replace(/^版本\s*/i, "")
    .replace(/^@/, "")
    .trim();
}
