import type {
  ComparisonQuoteInput,
  CoverageDifference,
  CoverageItem,
  GapFlag,
  PolicyAnalysis,
  QuoteComparison,
} from "@/lib/types";
import { extractPolicyData } from "@/lib/policy-parser";

const currentYear = new Date().getFullYear();

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function analyzePolicyDocument(args: {
  fileName: string;
  text: string;
  parseIssue?: string;
}): PolicyAnalysis {
  const extracted = extractPolicyData(args.text, args.fileName, args.parseIssue);
  const gapFlags = buildGapFlags(extracted.coverages, extracted.vehicles);
  const confidence = calculateConfidence(
    extracted.textLength,
    extracted.matchedCoverageCount,
    extracted.vehicles.length,
    extracted.extractionNotes.length,
  );
  const protectionScore = calculateProtectionScore(extracted.coverages, gapFlags);

  return {
    carrierName: extracted.carrierName,
    policyPeriod: extracted.policyPeriod,
    vehicles: extracted.vehicles,
    coverages: extracted.coverages,
    deductibles: extracted.deductibles,
    exclusions: extracted.exclusions,
    gapFlags,
    plainEnglishSummary: buildPlainEnglishSummary(
      extracted.carrierName,
      extracted.policyPeriod,
      extracted.coverages,
      gapFlags,
      extracted.vehicles.length,
    ),
    confidence,
    extractionNotes: extracted.extractionNotes,
    currentMonthlyPremium: extracted.currentMonthlyPremium,
    protectionScore,
    textLength: extracted.textLength,
  };
}

export function recomputePolicyAnalysis(analysis: PolicyAnalysis): PolicyAnalysis {
  const gapFlags = buildGapFlags(analysis.coverages, analysis.vehicles);
  const confidence = calculateConfidence(
    analysis.textLength,
    analysis.coverages.filter(
      (coverage) => coverage.status === "included" || coverage.status === "limited",
    ).length,
    analysis.vehicles.length,
    analysis.extractionNotes.length,
  );
  const protectionScore = calculateProtectionScore(analysis.coverages, gapFlags);
  const plainEnglishSummary =
    analysis.plainEnglishSummary?.trim() ||
    buildPlainEnglishSummary(
      analysis.carrierName,
      analysis.policyPeriod,
      analysis.coverages,
      gapFlags,
      analysis.vehicles.length,
    );

  return {
    ...analysis,
    gapFlags,
    confidence,
    protectionScore,
    plainEnglishSummary,
  };
}

export function compareQuote(
  currentPolicy: PolicyAnalysis,
  currentMonthlyPremium: number,
  comparisonQuote: ComparisonQuoteInput,
): QuoteComparison {
  const currentCoverageMap = buildCoverageSnapshot(currentPolicy.coverages);
  const comparisonCoverageMap = buildComparisonCoverageSnapshot(comparisonQuote);

  const coverageDifferences: CoverageDifference[] = [
    compareCoveragePair(
      "Bodily injury liability",
      currentCoverageMap.bodilyInjuryLiability,
      comparisonCoverageMap.bodilyInjuryLiability,
      "limit",
    ),
    compareCoveragePair(
      "Property damage liability",
      currentCoverageMap.propertyDamageLiability,
      comparisonCoverageMap.propertyDamageLiability,
      "limit",
    ),
    compareCoveragePair(
      "Collision deductible",
      currentCoverageMap.collision,
      comparisonCoverageMap.collision,
      "deductible",
    ),
    compareCoveragePair(
      "Comprehensive deductible",
      currentCoverageMap.comprehensive,
      comparisonCoverageMap.comprehensive,
      "deductible",
    ),
    compareCoveragePair(
      "Uninsured motorist",
      currentCoverageMap.uninsuredMotorist,
      comparisonCoverageMap.uninsuredMotorist,
      "toggle",
    ),
    compareCoveragePair(
      "Roadside assistance",
      currentCoverageMap.roadsideAssistance,
      comparisonCoverageMap.roadsideAssistance,
      "toggle",
    ),
    compareCoveragePair(
      "Rental reimbursement",
      currentCoverageMap.rentalReimbursement,
      comparisonCoverageMap.rentalReimbursement,
      "toggle",
    ),
  ];

  const currentProtectionScore = scoreCoverageSnapshot(currentCoverageMap);
  const comparisonProtectionScore = scoreCoverageSnapshot(comparisonCoverageMap);
  const priceDelta = Math.round((comparisonQuote.monthlyPremium - currentMonthlyPremium) * 100) / 100;

  const betterForSavings =
    priceDelta < 0
      ? comparisonQuote.carrierName
      : priceDelta > 0
        ? currentPolicy.carrierName
        : "Tie on price";

  const betterForProtection =
    comparisonProtectionScore > currentProtectionScore
      ? comparisonQuote.carrierName
      : comparisonProtectionScore < currentProtectionScore
        ? currentPolicy.carrierName
        : "Tie on protection";

  const finalRecommendation = buildRecommendation(
    currentPolicy.carrierName,
    comparisonQuote.carrierName,
    priceDelta,
    currentProtectionScore,
    comparisonProtectionScore,
  );

  return {
    priceDelta,
    coverageDifferences,
    currentProtectionScore,
    comparisonProtectionScore,
    betterForSavings,
    betterForProtection,
    finalRecommendation,
    summary: buildComparisonSummary(
      currentPolicy.carrierName,
      comparisonQuote.carrierName,
      priceDelta,
      currentProtectionScore,
      comparisonProtectionScore,
    ),
  };
}

function buildGapFlags(coverages: CoverageItem[], vehicles: PolicyAnalysis["vehicles"]) {
  const flags: GapFlag[] = [];
  const coverageMap = buildCoverageSnapshot(coverages);

  const [bodilyInjuryFirst, bodilyInjurySecond] = extractLimitAmounts(
    coverageMap.bodilyInjuryLiability.value,
  );
  const [propertyDamageAmount] = extractLimitAmounts(coverageMap.propertyDamageLiability.value);
  const [collisionDeductible] = extractMoneyAmounts(coverageMap.collision.value);

  if (bodilyInjuryFirst > 0 && (bodilyInjuryFirst < 100000 || bodilyInjurySecond < 300000)) {
    flags.push({
      title: "Liability limits may leave personal savings exposed",
      severity: bodilyInjuryFirst < 50000 ? "high" : "medium",
      whyItMatters:
        "Medical bills and attorney costs can run past low liability limits fast, especially when newer cars or multiple people are involved.",
      suggestedAction:
        "Model at least $100,000 / $300,000 bodily injury limits so the user can see the price difference against stronger protection.",
    });
  }

  if (propertyDamageAmount > 0 && propertyDamageAmount < 100000) {
    flags.push({
      title: "Property damage limit is on the thin side",
      severity: propertyDamageAmount < 50000 ? "high" : "medium",
      whyItMatters:
        "One damaged SUV, EV, storefront, or highway barrier can exceed a low property damage cap.",
      suggestedAction:
        "Compare the current limit against a $100,000 or $250,000 option to show whether the premium tradeoff is worth it.",
    });
  }

  if (!coverageMap.uninsuredMotorist.enabled) {
    flags.push({
      title: "No uninsured / underinsured motorist coverage found",
      severity: "medium",
      whyItMatters:
        "If another driver has little or no coverage, the policyholder may have to absorb more of the financial hit themselves.",
      suggestedAction:
        "Ask for UM/UIM options that track the liability limits when the state allows it.",
    });
  }

  if (!coverageMap.roadsideAssistance.enabled) {
    flags.push({
      title: "No roadside assistance",
      severity: "low",
      whyItMatters:
        "This does not break the policy, but it removes help for towing, jump starts, and lockouts when stress is already high.",
      suggestedAction:
        "Show the add-on cost next to the price of a single tow so the tradeoff feels concrete.",
    });
  }

  if (!coverageMap.rentalReimbursement.enabled) {
    flags.push({
      title: "No rental reimbursement",
      severity: "medium",
      whyItMatters:
        "A claim can leave the driver paying for alternative transportation even when the repair itself is covered.",
      suggestedAction:
        "Compare a version with rental coverage added so the user sees the cost of convenience up front.",
    });
  }

  if (collisionDeductible >= 1000) {
    flags.push({
      title: "Collision deductible may be painful in a real claim",
      severity: collisionDeductible >= 1500 ? "high" : "medium",
      whyItMatters:
        "A high deductible lowers premium now but can feel brutal when cash is tight after a crash.",
      suggestedAction:
        "Offer a side-by-side quote with a $500 deductible so the user can judge whether the monthly savings are worth the claim risk.",
    });
  }

  const hasNewerVehicle = vehicles.some((vehicle) => vehicle.year && vehicle.year >= currentYear - 7);
  if (hasNewerVehicle && !coverageMap.collision.enabled) {
    flags.push({
      title: "A newer vehicle appears to be missing collision coverage",
      severity: "high",
      whyItMatters:
        "Without collision, the driver may be on the hook for most repair or replacement costs after an at-fault crash.",
      suggestedAction:
        "Verify whether collision was intentionally declined or whether the parser missed it on the declarations page.",
    });
  }

  return flags.slice(0, 5);
}

function calculateConfidence(
  textLength: number,
  matchedCoverageCount: number,
  vehicleCount: number,
  extractionNoteCount: number,
): PolicyAnalysis["confidence"] {
  if (textLength < 200 || matchedCoverageCount <= 2) {
    return "low";
  }

  if (matchedCoverageCount >= 5 && vehicleCount > 0 && extractionNoteCount <= 1) {
    return "high";
  }

  return "medium";
}

function buildPlainEnglishSummary(
  carrierName: string,
  policyPeriod: string,
  coverages: CoverageItem[],
  gapFlags: GapFlag[],
  vehicleCount: number,
) {
  const includedCoverages = coverages
    .filter((coverage) => coverage.status === "included" || coverage.status === "limited")
    .slice(0, 4)
    .map((coverage) => coverage.label.toLowerCase());

  const gapLead = gapFlags[0]?.title ?? "no major blind spots surfaced from the text we could read";
  const vehiclePhrase = vehicleCount > 0 ? `for ${vehicleCount} listed vehicle${vehicleCount > 1 ? "s" : ""}` : "";
  const includedPhrase =
    includedCoverages.length > 0
      ? `It appears to include ${includedCoverages.join(", ")}`
      : "The PDF did not expose every coverage line clearly";

  return `${carrierName} policy ${vehiclePhrase} during ${policyPeriod}. ${includedPhrase}. The biggest thing to review is ${gapLead.toLowerCase()}.`;
}

function calculateProtectionScore(coverages: CoverageItem[], gapFlags: GapFlag[]) {
  const snapshot = buildCoverageSnapshot(coverages);
  let score = scoreCoverageSnapshot(snapshot);

  for (const gapFlag of gapFlags) {
    if (gapFlag.severity === "high") {
      score -= 10;
    } else if (gapFlag.severity === "medium") {
      score -= 6;
    } else {
      score -= 3;
    }
  }

  return Math.max(8, Math.min(96, score));
}

function buildCoverageSnapshot(coverages: CoverageItem[]) {
  const getCoverage = (type: CoverageItem["type"]) =>
    coverages.find((coverage) => coverage.type === type);

  return {
    bodilyInjuryLiability: buildSnapshotValue(getCoverage("bodilyInjuryLiability")),
    propertyDamageLiability: buildSnapshotValue(getCoverage("propertyDamageLiability")),
    uninsuredMotorist: buildSnapshotValue(getCoverage("uninsuredMotorist")),
    collision: buildSnapshotValue(getCoverage("collision")),
    comprehensive: buildSnapshotValue(getCoverage("comprehensive")),
    roadsideAssistance: buildSnapshotValue(getCoverage("roadsideAssistance")),
    rentalReimbursement: buildSnapshotValue(getCoverage("rentalReimbursement")),
  };
}

function buildComparisonCoverageSnapshot(comparisonQuote: ComparisonQuoteInput) {
  return {
    bodilyInjuryLiability: {
      value: comparisonQuote.bodilyInjuryLimit,
      enabled: true,
    },
    propertyDamageLiability: {
      value: comparisonQuote.propertyDamageLimit,
      enabled: true,
    },
    uninsuredMotorist: {
      value: comparisonQuote.uninsuredMotoristIncluded ? "Included" : "Not included",
      enabled: comparisonQuote.uninsuredMotoristIncluded,
    },
    collision: {
      value: comparisonQuote.collisionDeductible,
      enabled: comparisonQuote.collisionDeductible !== "Not included",
    },
    comprehensive: {
      value: comparisonQuote.comprehensiveDeductible,
      enabled: comparisonQuote.comprehensiveDeductible !== "Not included",
    },
    roadsideAssistance: {
      value: comparisonQuote.roadsideIncluded ? "Included" : "Not included",
      enabled: comparisonQuote.roadsideIncluded,
    },
    rentalReimbursement: {
      value: comparisonQuote.rentalIncluded ? "Included" : "Not included",
      enabled: comparisonQuote.rentalIncluded,
    },
  };
}

function buildSnapshotValue(coverage: CoverageItem | undefined) {
  if (!coverage) {
    return {
      value: "Unable to confirm",
      enabled: false,
    };
  }

  return {
    value: coverage.limitOrDeductible,
    enabled: coverage.status !== "missing" && coverage.status !== "unknown",
  };
}

function compareCoveragePair(
  coverage: string,
  currentValue: { value: string; enabled: boolean },
  comparisonValue: { value: string; enabled: boolean },
  kind: "limit" | "deductible" | "toggle",
): CoverageDifference {
  const currentScore = scoreComparableValue(currentValue.value, kind, currentValue.enabled);
  const comparisonScore = scoreComparableValue(
    comparisonValue.value,
    kind,
    comparisonValue.enabled,
  );

  if (comparisonScore === currentScore) {
    return {
      coverage,
      currentValue: currentValue.value,
      comparisonValue: comparisonValue.value,
      impact: "same",
      explanation: "This line looks materially similar after normalizing the two coverage choices.",
      winner: "tie",
    };
  }

  const comparisonIsBetter = comparisonScore > currentScore;

  return {
    coverage,
    currentValue: currentValue.value,
    comparisonValue: comparisonValue.value,
    impact: comparisonIsBetter ? "better" : "worse",
    explanation: buildCoverageDifferenceExplanation(
      coverage,
      currentValue.value,
      comparisonValue.value,
      kind,
      comparisonIsBetter,
    ),
    winner: comparisonIsBetter ? "comparison" : "current",
  };
}

function buildCoverageDifferenceExplanation(
  coverage: string,
  currentValue: string,
  comparisonValue: string,
  kind: "limit" | "deductible" | "toggle",
  comparisonIsBetter: boolean,
) {
  if (kind === "limit") {
    return comparisonIsBetter
      ? `${coverage} is stronger on the comparison quote (${comparisonValue} vs ${currentValue}).`
      : `${coverage} is stronger on the current policy (${currentValue} vs ${comparisonValue}).`;
  }

  if (kind === "deductible") {
    return comparisonIsBetter
      ? `${coverage} is lower on the comparison quote, which means less out-of-pocket cost at claim time.`
      : `${coverage} is lower on the current policy, so the comparison quote asks the driver to absorb more risk.`;
  }

  return comparisonIsBetter
    ? `The comparison quote includes ${coverage.toLowerCase()} while the current policy does not.`
    : `The current policy keeps ${coverage.toLowerCase()} that the comparison quote drops.`;
}

function scoreCoverageSnapshot(snapshot: ReturnType<typeof buildCoverageSnapshot>) {
  let score = 22;
  score += scoreComparableValue(snapshot.bodilyInjuryLiability.value, "limit", true);
  score += scoreComparableValue(snapshot.propertyDamageLiability.value, "limit", true);
  score += scoreComparableValue(
    snapshot.uninsuredMotorist.value,
    "toggle",
    snapshot.uninsuredMotorist.enabled,
  );
  score += scoreComparableValue(snapshot.collision.value, "deductible", snapshot.collision.enabled);
  score += scoreComparableValue(
    snapshot.comprehensive.value,
    "deductible",
    snapshot.comprehensive.enabled,
  );
  score += scoreComparableValue(
    snapshot.roadsideAssistance.value,
    "toggle",
    snapshot.roadsideAssistance.enabled,
  );
  score += scoreComparableValue(
    snapshot.rentalReimbursement.value,
    "toggle",
    snapshot.rentalReimbursement.enabled,
  );

  return score;
}

function scoreComparableValue(
  value: string,
  kind: "limit" | "deductible" | "toggle",
  enabled: boolean,
) {
  if (kind === "toggle") {
    return enabled ? 7 : 0;
  }

  if (!enabled) {
    return 0;
  }

  const [first, second] =
    kind === "limit" ? extractLimitAmounts(value) : extractMoneyAmounts(value);

  if (kind === "limit") {
    const primary = first || second;

    if (primary >= 500000) {
      return 18;
    }

    if (primary >= 250000) {
      return 14;
    }

    if (primary >= 100000) {
      return 11;
    }

    if (primary >= 50000) {
      return 7;
    }

    return 4;
  }

  if (value.toLowerCase().includes("not included")) {
    return 0;
  }

  if (first <= 250) {
    return 10;
  }

  if (first <= 500) {
    return 8;
  }

  if (first <= 1000) {
    return 5;
  }

  if (first <= 1500) {
    return 3;
  }

  return 1;
}

function extractLimitAmounts(value: string) {
  return [...value.matchAll(/\d[\d,]*/g)]
    .map((match) => match[0].replace(/,/g, ""))
    .map((token) => Number.parseInt(token, 10))
    .filter((amount) => Number.isFinite(amount))
    .map((amount) => (amount <= 999 ? amount * 1000 : amount));
}

function extractMoneyAmounts(value: string) {
  return [...value.matchAll(/\d[\d,]*/g)]
    .map((match) => match[0].replace(/,/g, ""))
    .map((token) => Number.parseInt(token, 10))
    .filter((amount) => Number.isFinite(amount));
}

function buildRecommendation(
  currentCarrier: string,
  comparisonCarrier: string,
  priceDelta: number,
  currentProtectionScore: number,
  comparisonProtectionScore: number,
) {
  if (priceDelta < 0 && comparisonProtectionScore + 4 >= currentProtectionScore) {
    return `${comparisonCarrier} looks like the better price play because it saves about ${currencyFormatter.format(Math.abs(priceDelta))} a month without a major protection drop.`;
  }

  if (priceDelta < 0 && comparisonProtectionScore + 4 < currentProtectionScore) {
    return `${comparisonCarrier} is cheaper on headline price, but ${currentCarrier} appears to preserve meaningfully better protection. This is the classic “cheap quote, thinner coverage” trap.`;
  }

  if (priceDelta > 0 && comparisonProtectionScore > currentProtectionScore + 4) {
    return `${comparisonCarrier} costs more, but it also improves protection enough that the higher premium may be reasonable for a risk-averse driver.`;
  }

  return `${currentCarrier} looks like the steadier recommendation because the comparison quote does not improve protection enough to justify the price tradeoff.`;
}

function buildComparisonSummary(
  currentCarrier: string,
  comparisonCarrier: string,
  priceDelta: number,
  currentProtectionScore: number,
  comparisonProtectionScore: number,
) {
  const priceDirection =
    priceDelta === 0
      ? "the same monthly amount"
      : priceDelta < 0
        ? `${currencyFormatter.format(Math.abs(priceDelta))} less per month`
        : `${currencyFormatter.format(priceDelta)} more per month`;
  const protectionDirection =
    comparisonProtectionScore === currentProtectionScore
      ? "roughly the same protection"
      : comparisonProtectionScore > currentProtectionScore
        ? "better protection"
        : "weaker protection";

  return `${comparisonCarrier} comes in at ${priceDirection} than ${currentCarrier} and offers ${protectionDirection} after normalizing the major coverage choices.`;
}

