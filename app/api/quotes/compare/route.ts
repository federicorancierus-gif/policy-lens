import { z } from "zod";

import { compareQuote } from "@/lib/insurance-engine";
import type { PolicyAnalysis } from "@/lib/types";

const coverageItemSchema = z.object({
  type: z.string(),
  label: z.string(),
  limitOrDeductible: z.string(),
  status: z.string(),
  plainEnglishExplanation: z.string(),
});

const currentPolicySchema = z.object({
  carrierName: z.string(),
  policyPeriod: z.string().optional(),
  coverages: z.array(coverageItemSchema),
  deductibles: z.array(z.any()).optional(),
  exclusions: z.array(z.any()).optional(),
  gapFlags: z.array(z.any()).optional(),
  plainEnglishSummary: z.string().optional(),
  confidence: z.string().optional(),
  extractionNotes: z.array(z.string()).optional(),
  currentMonthlyPremium: z.number().nullable().optional(),
  protectionScore: z.number().optional(),
  textLength: z.number().optional(),
  vehicles: z.array(z.any()).optional(),
});

const comparisonQuoteSchema = z.object({
  carrierName: z.string().min(1),
  monthlyPremium: z.number().positive(),
  bodilyInjuryLimit: z.string().min(1),
  propertyDamageLimit: z.string().min(1),
  collisionDeductible: z.string().min(1),
  comprehensiveDeductible: z.string().min(1),
  uninsuredMotoristIncluded: z.boolean(),
  roadsideIncluded: z.boolean(),
  rentalIncluded: z.boolean(),
  notes: z.string().optional(),
});

const compareRequestSchema = z.object({
  currentPolicy: currentPolicySchema,
  currentMonthlyPremium: z.number().positive(),
  comparisonQuote: comparisonQuoteSchema,
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "The comparison request was not valid JSON." },
      { status: 400 },
    );
  }

  const parsed = compareRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Comparison payload was incomplete.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const result = compareQuote(
    parsed.data.currentPolicy as PolicyAnalysis,
    parsed.data.currentMonthlyPremium,
    parsed.data.comparisonQuote,
  );

  return Response.json(result);
}
