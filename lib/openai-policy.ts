import { z } from "zod";

import { insuranceGlossary } from "@/lib/glossary";
import { recomputePolicyAnalysis } from "@/lib/insurance-engine";
import type {
  CoverageItem,
  CoverageStatus,
  CoverageType,
  ExclusionItem,
  PolicyAnalysis,
  VehicleInfo,
} from "@/lib/types";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_POLICY_MODEL || "gpt-4o-mini";
const MAX_POLICY_TEXT_CHARS = 24_000;

const coverageTypes = [
  "bodilyInjuryLiability",
  "propertyDamageLiability",
  "uninsuredMotorist",
  "collision",
  "comprehensive",
  "roadsideAssistance",
  "rentalReimbursement",
  "medicalPayments",
] as const satisfies CoverageType[];

const llmCoverageSchema = z.object({
  status: z.enum(["included", "limited", "missing", "unknown"]),
  limitOrDeductible: z.string().nullable(),
  rawValue: z.string().nullable(),
});

const llmPolicySchema = z.object({
  documentType: z.enum(["auto", "homeowners", "other", "unknown"]),
  carrierName: z.string().nullable(),
  policyPeriod: z.string().nullable(),
  currentMonthlyPremium: z.number().nullable(),
  vehicles: z.array(
    z.object({
      year: z.number().int().min(1900).max(2100).nullable(),
      make: z.string().nullable(),
      model: z.string().nullable(),
    }),
  ),
  coverages: z.object({
    bodilyInjuryLiability: llmCoverageSchema,
    propertyDamageLiability: llmCoverageSchema,
    uninsuredMotorist: llmCoverageSchema,
    collision: llmCoverageSchema,
    comprehensive: llmCoverageSchema,
    roadsideAssistance: llmCoverageSchema,
    rentalReimbursement: llmCoverageSchema,
    medicalPayments: llmCoverageSchema,
  }),
  exclusions: z.array(z.string()),
  summary: z.string().nullable(),
});

type LlmPolicyExtraction = z.infer<typeof llmPolicySchema>;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentType: {
      type: "string",
      enum: ["auto", "homeowners", "other", "unknown"],
    },
    carrierName: { type: ["string", "null"] },
    policyPeriod: { type: ["string", "null"] },
    currentMonthlyPremium: { type: ["number", "null"] },
    vehicles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          year: { type: ["integer", "null"] },
          make: { type: ["string", "null"] },
          model: { type: ["string", "null"] },
        },
        required: ["year", "make", "model"],
      },
    },
    coverages: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        coverageTypes.map((type) => [
          type,
          {
            type: "object",
            additionalProperties: false,
            properties: {
              status: {
                type: "string",
                enum: ["included", "limited", "missing", "unknown"],
              },
              limitOrDeductible: { type: ["string", "null"] },
              rawValue: { type: ["string", "null"] },
            },
            required: ["status", "limitOrDeductible", "rawValue"],
          },
        ]),
      ),
      required: [...coverageTypes],
    },
    exclusions: {
      type: "array",
      items: { type: "string" },
    },
    summary: { type: ["string", "null"] },
  },
  required: [
    "documentType",
    "carrierName",
    "policyPeriod",
    "currentMonthlyPremium",
    "vehicles",
    "coverages",
    "exclusions",
    "summary",
  ],
} as const;

export function isOpenAiPolicyEnhancementEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function enhancePolicyAnalysisWithLlm(args: {
  fileName: string;
  text: string;
  analysis: PolicyAnalysis;
}) {
  if (!isOpenAiPolicyEnhancementEnabled() || args.text.trim().length < 120) {
    return { analysis: args.analysis, documentType: "unknown" as const };
  }

  const extraction = await extractPolicyWithLlm(args.fileName, args.text, args.analysis);
  const merged = mergePolicyAnalysis(args.analysis, extraction);

  return {
    analysis: merged,
    documentType: extraction.documentType,
  };
}

async function extractPolicyWithLlm(
  fileName: string,
  text: string,
  analysis: PolicyAnalysis,
): Promise<LlmPolicyExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const baseline = JSON.stringify(
    {
      carrierName: analysis.carrierName,
      policyPeriod: analysis.policyPeriod,
      currentMonthlyPremium: analysis.currentMonthlyPremium ?? null,
      vehicles: analysis.vehicles,
      coverages: analysis.coverages.map((coverage) => ({
        type: coverage.type,
        status: coverage.status,
        limitOrDeductible: coverage.limitOrDeductible,
        rawValue: coverage.rawValue ?? null,
      })),
    },
    null,
    2,
  );

  const prompt = [
    "You extract structured data from U.S. personal auto insurance policy text.",
    "Rules:",
    "- Only use information that is explicitly present in the provided text.",
    "- If the document is a homeowners policy, renters policy, umbrella policy, or another non-auto policy, mark documentType accordingly.",
    "- Do not invent carrier names, vehicles, or coverage values.",
    "- Do not invent exclusions that are not stated in the text.",
    "- Use monthly premium if directly stated; otherwise derive it from 6-month or annual premium if clearly shown.",
    "- For coverage values, prefer concise strings such as \"$50,000 / $100,000\", \"$500 deductible\", \"$40/day up to $1,200\", \"Not included\", or \"Unable to confirm\".",
    "- Keep the summary to 2-3 short sentences in plain English.",
    "- The summary must mention the carrier, at least one included coverage, and the biggest protection gap if one is visible in the text.",
    "",
    `File name: ${fileName}`,
    "",
    "Deterministic baseline (may be incomplete or wrong, use only as a hint):",
    baseline,
    "",
    "Policy text:",
    text.slice(0, MAX_POLICY_TEXT_CHARS),
  ].join("\n");

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are an insurance document extraction assistant. Return only valid JSON that matches the provided schema.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "policy_extraction",
          schema: responseSchema,
          strict: true,
        },
      },
      max_output_tokens: 1800,
      store: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI policy extraction failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as {
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };
  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && typeof item.text === "string")
    ?.text?.trim();

  if (!outputText) {
    throw new Error("OpenAI policy extraction returned no structured output.");
  }

  return llmPolicySchema.parse(JSON.parse(outputText));
}

function mergePolicyAnalysis(
  analysis: PolicyAnalysis,
  extraction: LlmPolicyExtraction,
): PolicyAnalysis {
  const nextCarrier =
    shouldUseLlmString(analysis.carrierName, extraction.carrierName, "Unknown carrier")
      ? cleanLlmString(extraction.carrierName)
      : analysis.carrierName;
  const nextPolicyPeriod =
    shouldUseLlmString(
      analysis.policyPeriod,
      extraction.policyPeriod,
      "Unable to confirm policy term",
    )
      ? cleanLlmString(extraction.policyPeriod)
      : analysis.policyPeriod;
  const mergedVehicles = mergeVehicles(analysis.vehicles, extraction.vehicles);
  const mergedCoverages = mergeCoverages(analysis.coverages, extraction.coverages);
  const mergedExclusions = mergeExclusions(analysis.exclusions, extraction.exclusions);
  const filledFieldCount = countFilledFields(analysis, mergedVehicles, mergedCoverages, extraction);
  const candidateSummary = chooseSummary(analysis.plainEnglishSummary, extraction.summary, nextCarrier);
  const shouldRegenerateSummary =
    candidateSummary === analysis.plainEnglishSummary &&
    (nextCarrier !== analysis.carrierName ||
      nextPolicyPeriod !== analysis.policyPeriod ||
      mergedVehicles.length !== analysis.vehicles.length ||
      mergedCoverages.some((coverage, index) => {
        const previous = analysis.coverages[index];
        return (
          previous?.status !== coverage.status ||
          previous?.limitOrDeductible !== coverage.limitOrDeductible
        );
      }));

  return recomputePolicyAnalysis({
    ...analysis,
    carrierName: nextCarrier,
    policyPeriod: nextPolicyPeriod,
    currentMonthlyPremium:
      typeof extraction.currentMonthlyPremium === "number" &&
      Number.isFinite(extraction.currentMonthlyPremium)
        ? extraction.currentMonthlyPremium
        : analysis.currentMonthlyPremium ?? null,
    vehicles: mergedVehicles,
    coverages: mergedCoverages,
    exclusions: mergedExclusions,
    plainEnglishSummary: shouldRegenerateSummary ? "" : candidateSummary,
    extractionNotes: [
      ...analysis.extractionNotes,
      `LLM reviewed the extracted text and clarified ${filledFieldCount} field${
        filledFieldCount === 1 ? "" : "s"
      }.`,
    ],
  });
}

function mergeVehicles(
  currentVehicles: VehicleInfo[],
  llmVehicles: LlmPolicyExtraction["vehicles"],
) {
  const normalizedLlmVehicles = llmVehicles
    .map((vehicle) => ({
      year: vehicle.year ?? undefined,
      make: cleanLlmString(vehicle.make) || undefined,
      model: cleanLlmString(vehicle.model) || undefined,
    }))
    .filter((vehicle) => vehicle.year || vehicle.make || vehicle.model);

  if (normalizedLlmVehicles.length > currentVehicles.length) {
    return normalizedLlmVehicles;
  }

  return currentVehicles;
}

function mergeCoverages(
  currentCoverages: CoverageItem[],
  llmCoverages: LlmPolicyExtraction["coverages"],
) {
  return currentCoverages.map((coverage) => {
    const llmCoverage = llmCoverages[coverage.type];
    const llmValue = cleanCoverageValue(llmCoverage.limitOrDeductible);
    const nextStatus = chooseCoverageStatus(coverage, llmCoverage.status, llmValue);
    const nextValue = shouldUseLlmCoverageValue(coverage, llmCoverage.status, llmValue)
      ? llmValue
      : coverage.limitOrDeductible;

    return {
      ...coverage,
      status: nextStatus,
      limitOrDeductible: nextValue,
      rawValue: llmCoverage.rawValue?.trim() || coverage.rawValue,
      plainEnglishExplanation: insuranceGlossary[coverage.type].plainEnglishExplanation,
    };
  });
}

function mergeExclusions(
  currentExclusions: ExclusionItem[],
  llmExclusions: string[],
) {
  const cleaned = llmExclusions
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (cleaned.length === 0) {
    return currentExclusions;
  }

  if (!shouldReplaceExclusions(currentExclusions)) {
    return currentExclusions;
  }

  return cleaned.map((label) => ({
    label,
    plainEnglishExplanation:
      "This line looks like policy fine print or a limitation. Treat it as something worth double-checking before you rely on coverage in that situation.",
  }));
}

function countFilledFields(
  original: PolicyAnalysis,
  vehicles: VehicleInfo[],
  coverages: CoverageItem[],
  extraction: LlmPolicyExtraction,
) {
  let count = 0;

  if (original.carrierName === "Unknown carrier" && extraction.carrierName?.trim()) {
    count += 1;
  }

  if (
    original.policyPeriod === "Unable to confirm policy term" &&
    extraction.policyPeriod?.trim()
  ) {
    count += 1;
  }

  if ((original.currentMonthlyPremium ?? null) === null && extraction.currentMonthlyPremium !== null) {
    count += 1;
  }

  if (original.vehicles.length === 0 && vehicles.length > 0) {
    count += vehicles.length;
  }

  const originalCoverageMap = new Map(original.coverages.map((coverage) => [coverage.type, coverage]));
  for (const coverage of coverages) {
    const previous = originalCoverageMap.get(coverage.type);
    if (!previous) {
      continue;
    }

    if (
      previous.status !== coverage.status ||
      previous.limitOrDeductible !== coverage.limitOrDeductible
    ) {
      count += 1;
    }
  }

  return Math.max(1, count);
}

function chooseSummary(
  currentSummary: string,
  llmSummary: string | null,
  carrierName: string,
) {
  const trimmed = llmSummary?.trim();

  if (!trimmed) {
    return currentSummary;
  }

  const normalized = trimmed.toLowerCase();
  const mentionsCarrier =
    carrierName !== "Unknown carrier" && normalized.includes(carrierName.toLowerCase());
  const tooGeneric =
    normalized.includes("various coverages") ||
    normalized.includes("includes various coverages");

  if (trimmed.length < 110 || tooGeneric || !mentionsCarrier) {
    return currentSummary;
  }

  return trimmed;
}

function shouldUseLlmString(
  currentValue: string,
  llmValue: string | null,
  placeholder: string,
) {
  return currentValue === placeholder && Boolean(llmValue?.trim());
}

function cleanLlmString(value: string | null) {
  return value?.trim() ?? "";
}

function cleanCoverageValue(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return "Unable to confirm";
  }

  return normalized;
}

function chooseCoverageStatus(
  current: CoverageItem,
  llmStatus: CoverageStatus,
  llmValue: string,
): CoverageStatus {
  if (shouldUseLlmCoverageValue(current, llmStatus, llmValue)) {
    return llmStatus;
  }

  return current.status;
}

function shouldUseLlmCoverageValue(
  current: CoverageItem,
  llmStatus: CoverageStatus,
  llmValue: string,
) {
  const currentValue = current.limitOrDeductible.trim().toLowerCase();
  const normalizedLlmValue = llmValue.trim().toLowerCase();

  if (llmStatus === "unknown" && normalizedLlmValue === "unable to confirm") {
    return false;
  }

  if (current.status === "unknown" && llmStatus !== "unknown") {
    return true;
  }

  if (current.status === "missing" && (llmStatus === "included" || llmStatus === "limited")) {
    return true;
  }

  if (currentValue === "included" && normalizedLlmValue !== "included") {
    return true;
  }

  if (currentValue === "unable to confirm" && normalizedLlmValue !== "unable to confirm") {
    return true;
  }

  if (current.rawValue == null && normalizedLlmValue !== currentValue) {
    return true;
  }

  return false;
}

function shouldReplaceExclusions(currentExclusions: ExclusionItem[]) {
  const fallbackLabels = new Set([
    "Wear and tear / mechanical breakdown",
    "Commercial or rideshare use without endorsement",
    "Intentional damage or fraud",
  ]);

  return (
    currentExclusions.length === 0 ||
    currentExclusions.every((exclusion) => fallbackLabels.has(exclusion.label))
  );
}
