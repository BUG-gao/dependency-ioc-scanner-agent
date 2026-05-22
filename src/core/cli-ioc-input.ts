import semver from "semver";

export function collectIocOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function resolveCliIocs(optionIocs: string[] | undefined, positionalParts: string[]): string[] {
  const iocs = [
    ...splitIocList(optionIocs ?? []),
    ...parsePositionalIocs(positionalParts)
  ];

  return [...new Set(iocs.map((ioc) => ioc.trim()).filter(Boolean))];
}

export function parsePositionalIocs(parts: string[]): string[] {
  if (parts.length === 0) {
    return [];
  }

  if (parts.length === 1) {
    return splitIocList(parts);
  }

  const iocs: string[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    const packageName = parts[index];
    const version = parts[index + 1];

    if (!packageName || !version) {
      throw new Error(`Invalid IOC arguments. Use: ioc-scan <package> <version> [<package> <version>...]`);
    }

    if (!looksLikeVersionOrRange(version)) {
      throw new Error(`Invalid version or range for ${packageName}: ${version}`);
    }

    iocs.push(`${packageName} ${version}`);
  }

  return iocs;
}

function splitIocList(values: string[]): string[] {
  return values.flatMap((value) =>
    value
      .split(/\r?\n|;/)
      .flatMap((item) => splitCommaSeparatedIocs(item))
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function splitCommaSeparatedIocs(value: string): string[] {
  const parts = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return [value];
  }

  return parts.every((part) => /^\S+\s+\S+/.test(part)) ? parts : [value];
}

function looksLikeVersionOrRange(value: string): boolean {
  return Boolean(semver.valid(value) || semver.validRange(value));
}
