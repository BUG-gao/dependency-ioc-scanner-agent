export type Ecosystem = "npm" | "go" | "java" | "python";

export interface ProjectConfig {
  name: string;
  path: string;
}

export interface ScannerConfig {
  projects: ProjectConfig[];
}

export type IocConstraint =
  | { kind: "exact"; version: string }
  | { kind: "range"; range: string };

export interface ParsedIoc {
  raw: string;
  packageName: string;
  constraints: IocConstraint[];
}

export interface DependencyRecord {
  packageName: string;
  version: string;
  filePath: string;
  ecosystem: Ecosystem;
  source: string;
  isInstalledVersion: boolean;
}

export interface DependencyMatch {
  project: ProjectConfig;
  dependency: DependencyRecord;
  status: "Potential Risk";
  matchedBy: IocConstraint;
}

export interface ProjectScanResult {
  project: ProjectConfig;
  matches: DependencyMatch[];
}

export interface ScanResult {
  ioc: ParsedIoc;
  projectCount: number;
  riskCount: number;
  projects: ProjectScanResult[];
}

export type SupplyChainIndicatorKind =
  | "domain"
  | "url"
  | "lifecycle-script"
  | "github-dependency"
  | "text"
  | "repository-pattern";

export interface SupplyChainIndicator {
  kind: SupplyChainIndicatorKind;
  value: string;
  description?: string;
}

export interface SupplyChainMatch {
  project: ProjectConfig;
  filePath: string;
  indicator: SupplyChainIndicator;
  evidence: string;
  status: "Potential Supply Chain Risk";
}

export interface ProjectSupplyChainScanResult {
  project: ProjectConfig;
  matches: SupplyChainMatch[];
}

export interface SupplyChainScanResult {
  notice: string;
  indicators: SupplyChainIndicator[];
  projectCount: number;
  riskCount: number;
  projects: ProjectSupplyChainScanResult[];
}

export interface SecurityNoticeAnalysis {
  dependencyIocs: string[];
  supplyChainIndicators: SupplyChainIndicator[];
}

export interface AutoScanResult {
  analysis: SecurityNoticeAnalysis;
  dependencyResults: ScanResult[];
  supplyChainResult?: SupplyChainScanResult;
}
