import semver from "semver";
import type { SecurityNoticeAnalysis, SupplyChainIndicator } from "../types.js";

const URL_PATTERN = /https?:\/\/[^\s"'，。；、)）]+/gi;
const DOMAIN_PATTERN = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi;
const QUOTED_SCRIPT_PATTERN = /["'](preinstall|postinstall|install|prepare)["']\s*:\s*["']([^"']+)["']/gi;
const GITHUB_DEP_PATTERN = /["']([^"']+)["']\s*:\s*["'](github:[^"']+)["']/gi;
const MAVEN_OR_NPM_PACKAGE = /(@[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+|[A-Za-z0-9._-]+(?::[A-Za-z0-9._-]+)?)/;

export function analyzeSecurityNotice(notice: string): SecurityNoticeAnalysis {
  const dependencyIocs = extractDependencyIocs(notice);
  const supplyChainIndicators = dedupeIndicators([
    ...extractUrls(notice),
    ...extractDomains(notice),
    ...extractLifecycleScripts(notice),
    ...extractGithubDependencies(notice),
    ...extractKnownSuspiciousText(notice),
    ...extractRepositoryPattern(notice)
  ]);

  return { dependencyIocs, supplyChainIndicators };
}

function extractDependencyIocs(notice: string): string[] {
  const candidates = new Set<string>();
  const lines = notice.split(/\r?\n/);

  for (const line of lines) {
    const packageMatch = line.match(MAVEN_OR_NPM_PACKAGE);
    const rangeMatch = line.match(/((?:>=|<=|>|<|~|\^)?\s*v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?:\s+(?:>=|<=|>|<|~|\^)?\s*v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)*)/);
    if (!packageMatch?.[1] || !rangeMatch?.[1]) {
      continue;
    }

    const versionText = rangeMatch[1].trim();
    if (semver.valid(versionText) || semver.validRange(versionText)) {
      candidates.add(`${packageMatch[1]} ${versionText}`);
    }
  }

  return [...candidates];
}

function extractUrls(notice: string): SupplyChainIndicator[] {
  return [...notice.matchAll(URL_PATTERN)].map((match) => ({
    kind: "url",
    value: trimTrailingPunctuation(match[0]),
    description: "URL IOC"
  }));
}

function extractDomains(notice: string): SupplyChainIndicator[] {
  return [...notice.matchAll(DOMAIN_PATTERN)]
    .map((match) => trimTrailingPunctuation(match[0]))
    .filter((domain) => !["github.com"].includes(domain))
    .filter((domain) => !["js", "ts", "json", "yaml", "yml", "md", "txt"].includes(domain.split(".").at(-1) ?? ""))
    .map((domain) => ({
      kind: "domain",
      value: domain,
      description: "Domain IOC"
    }));
}

function extractLifecycleScripts(notice: string): SupplyChainIndicator[] {
  const indicators: SupplyChainIndicator[] = [];
  for (const match of notice.matchAll(QUOTED_SCRIPT_PATTERN)) {
    indicators.push({
      kind: "lifecycle-script",
      value: `${match[1]}:${match[2]}`,
      description: `npm lifecycle script ${match[1]}`
    });
  }

  if (indicators.length === 0 && /\bpreinstall\b/i.test(notice)) {
    indicators.push({
      kind: "lifecycle-script",
      value: "preinstall:*",
      description: "Any npm preinstall lifecycle script"
    });
  }

  return indicators;
}

function extractGithubDependencies(notice: string): SupplyChainIndicator[] {
  return [...notice.matchAll(GITHUB_DEP_PATTERN)].map((match) => ({
    kind: "github-dependency",
    value: `${match[1]}:${match[2]}`,
    description: "npm GitHub dependency IOC"
  }));
}

function extractKnownSuspiciousText(notice: string): SupplyChainIndicator[] {
  const values = [
    "niagA oG eW ereH :duluH-iahS",
    "niaga og ew ereh :duluh-iahs",
    "Shai-Hulud: Here We Go Again"
  ];

  return values
    .filter((value) => notice.includes(value))
    .map((value) => ({
      kind: "text",
      value,
      description: "Suspicious marker text"
    }));
}

function extractRepositoryPattern(notice: string): SupplyChainIndicator[] {
  if (!/<单词>-<单词>-<3位数字>/.test(notice) && !/\b[a-z]+-[a-z]+-\d{3}\b/i.test(notice)) {
    return [];
  }

  return [{
    kind: "repository-pattern",
    value: "[a-z]+-[a-z]+-[0-9]{3}",
    description: "Suspicious repository naming pattern"
  }];
}

function dedupeIndicators(indicators: SupplyChainIndicator[]): SupplyChainIndicator[] {
  const seen = new Set<string>();
  return indicators.filter((indicator) => {
    const key = `${indicator.kind}:${indicator.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[，。；、.)）]+$/g, "");
}
