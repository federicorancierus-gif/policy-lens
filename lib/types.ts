export type ConfidenceLevel = "high" | "medium" | "low";

export type CoverageStatus =
  | "included"
  | "optional"
  | "missing"
  | "limited"
  | "unknown";

export type CoverageType =
  | "bodilyInjuryLiability"
  | "propertyDamageLiability"
  | "uninsuredMotorist"
  | "collision"
  | "comprehensive"
  | "roadsideAssistance"
  | "rentalReimbursement"
  | "medicalPayments";

export type GapSeverity = "high" | "medium" | "low";

export interface VehicleInfo {
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
}

export interface CoverageItem {
  type: CoverageType;
  label: string;
  limitOrDeductible: string;
  status: CoverageStatus;
  plainEnglishExplanation: string;
  rawValue?: string;
}

export interface DeductibleItem {
  type: string;
  amount: string;
  note?: string;
}

export interface ExclusionItem {
  label: string;
  plainEnglishExplanation: string;
}

export interface GapFlag {
  title: string;
  severity: GapSeverity;
  whyItMatters: string;
  suggestedAction: string;
}

export interface PolicyAnalysis {
  carrierName: string;
  policyPeriod: string;
  vehicles: VehicleInfo[];
  coverages: CoverageItem[];
  deductibles: DeductibleItem[];
  exclusions: ExclusionItem[];
  gapFlags: GapFlag[];
  plainEnglishSummary: string;
  confidence: ConfidenceLevel;
  extractionNotes: string[];
  currentMonthlyPremium?: number | null;
  protectionScore: number;
  textLength: number;
}

export interface ComparisonQuoteInput {
  carrierName: string;
  monthlyPremium: number;
  bodilyInjuryLimit: string;
  propertyDamageLimit: string;
  collisionDeductible: string;
  comprehensiveDeductible: string;
  uninsuredMotoristIncluded: boolean;
  roadsideIncluded: boolean;
  rentalIncluded: boolean;
  notes?: string;
}

export interface CoverageDifference {
  coverage: string;
  currentValue: string;
  comparisonValue: string;
  impact: "better" | "worse" | "same";
  explanation: string;
  winner: "current" | "comparison" | "tie";
}

export interface QuoteComparison {
  priceDelta: number;
  coverageDifferences: CoverageDifference[];
  currentProtectionScore: number;
  comparisonProtectionScore: number;
  betterForSavings: string;
  betterForProtection: string;
  finalRecommendation: string;
  summary: string;
}

