import semver from "semver";
import type { DependencyRecord, IocConstraint, ParsedIoc } from "../types.js";

export function packageNameMatches(iocPackageName: string, dependencyPackageName: string): boolean {
  if (iocPackageName === dependencyPackageName) {
    return true;
  }

  if (dependencyPackageName.includes(":")) {
    return dependencyPackageName.split(":").at(-1) === iocPackageName;
  }

  return false;
}

export function matchDependency(ioc: ParsedIoc, dependency: DependencyRecord): IocConstraint | null {
  if (!packageNameMatches(ioc.packageName, dependency.packageName)) {
    return null;
  }

  return ioc.constraints.find((constraint) => versionMatches(constraint, dependency.version)) ?? null;
}

export function versionMatches(iocConstraint: IocConstraint, dependencyVersion: string): boolean {
  const depVersion = normalizeDependencyVersion(dependencyVersion);
  const exactDependency = semver.valid(depVersion);
  const dependencyRange = semver.validRange(depVersion);

  if (iocConstraint.kind === "exact") {
    if (exactDependency) {
      return semver.compare(iocConstraint.version, exactDependency) === 0;
    }
    if (dependencyRange) {
      return semver.satisfies(iocConstraint.version, dependencyRange, { includePrerelease: true });
    }
    return stripVersionPrefix(dependencyVersion) === iocConstraint.version;
  }

  const iocRange = new semver.Range(iocConstraint.range, { includePrerelease: true });
  if (exactDependency) {
    return semver.satisfies(exactDependency, iocRange, { includePrerelease: true });
  }
  if (dependencyRange) {
    return semver.intersects(iocRange, dependencyRange, { includePrerelease: true });
  }

  return false;
}

export function normalizeDependencyVersion(version: string): string {
  return stripVersionPrefix(version)
    .replace(/^=\s*/, "")
    .replace(/^version\s+/i, "")
    .trim();
}

function stripVersionPrefix(version: string): string {
  return version.trim().replace(/^v(?=\d)/, "");
}
