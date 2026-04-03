import { compareQuote } from "@/lib/insurance-engine";
import type { ComparisonQuoteInput, PolicyAnalysis } from "@/lib/types";

export const demoPolicyAnalysis: PolicyAnalysis = {
  carrierName: "GEICO",
  policyPeriod: "04/01/2026 to 10/01/2026",
  vehicles: [
    {
      year: 2021,
      make: "Toyota",
      model: "Camry SE",
    },
  ],
  coverages: [
    {
      type: "bodilyInjuryLiability",
      label: "Bodily injury liability",
      limitOrDeductible: "$50,000 / $100,000",
      status: "included",
      plainEnglishExplanation:
        "Pays for injuries you cause to other people. This is the biggest line item that protects your savings from a lawsuit after a major crash.",
    },
    {
      type: "propertyDamageLiability",
      label: "Property damage liability",
      limitOrDeductible: "$50,000",
      status: "included",
      plainEnglishExplanation:
        "Pays for damage you cause to someone else’s vehicle or property.",
    },
    {
      type: "uninsuredMotorist",
      label: "Uninsured / underinsured motorist",
      limitOrDeductible: "Not included",
      status: "missing",
      plainEnglishExplanation:
        "This would help if another driver hits you without enough insurance.",
    },
    {
      type: "collision",
      label: "Collision",
      limitOrDeductible: "$1,000 deductible",
      status: "included",
      plainEnglishExplanation:
        "Repairs your own car after a crash, after you pay the deductible.",
    },
    {
      type: "comprehensive",
      label: "Comprehensive",
      limitOrDeductible: "$500 deductible",
      status: "included",
      plainEnglishExplanation:
        "Handles theft, hail, vandalism, and other non-collision damage.",
    },
    {
      type: "roadsideAssistance",
      label: "Roadside assistance",
      limitOrDeductible: "Not included",
      status: "missing",
      plainEnglishExplanation:
        "Useful for lockouts, towing, jump starts, and flat tires.",
    },
    {
      type: "rentalReimbursement",
      label: "Rental reimbursement",
      limitOrDeductible: "$40/day up to $1,200",
      status: "included",
      plainEnglishExplanation:
        "Helps pay for a rental while your car is in the shop after a covered claim.",
    },
    {
      type: "medicalPayments",
      label: "Medical payments",
      limitOrDeductible: "$5,000",
      status: "included",
      plainEnglishExplanation:
        "Helps with immediate medical bills after an accident.",
    },
  ],
  deductibles: [
    {
      type: "Collision",
      amount: "$1,000",
      note: "A higher deductible lowers premium but increases out-of-pocket cost after a crash.",
    },
    {
      type: "Comprehensive",
      amount: "$500",
      note: "This applies to theft, hail, or similar non-collision claims.",
    },
  ],
  exclusions: [
    {
      label: "Wear and tear / mechanical breakdown",
      plainEnglishExplanation:
        "Routine maintenance and breakdowns are typically not covered by personal auto insurance.",
    },
    {
      label: "Commercial or rideshare use without endorsement",
      plainEnglishExplanation:
        "If the car is used for delivery or rideshare work without the right endorsement, claims can be denied.",
    },
    {
      label: "Intentional damage or fraud",
      plainEnglishExplanation:
        "Losses caused on purpose or with false information are not covered.",
    },
  ],
  gapFlags: [
    {
      title: "Liability limits may be too low for a serious crash",
      severity: "high",
      whyItMatters:
        "A newer SUV, medical bills, or a multi-car accident can blow past $50,000 / $100,000 quickly and leave you exposed personally.",
      suggestedAction:
        "Price out $100,000 / $300,000 bodily injury and at least $100,000 property damage before renewal.",
    },
    {
      title: "No uninsured motorist protection",
      severity: "medium",
      whyItMatters:
        "If an underinsured driver hits you, you may have to rely on health insurance or pay more out of pocket yourself.",
      suggestedAction:
        "Ask for UM/UIM options that mirror your liability limits if your state allows it.",
    },
    {
      title: "No roadside assistance",
      severity: "low",
      whyItMatters:
        "A tow or lockout can turn into an annoying out-of-pocket expense even if the main policy is solid.",
      suggestedAction:
        "Compare the add-on cost to the price of a single tow or jump-start.",
    },
  ],
  plainEnglishSummary:
    "This GEICO policy covers the big basics for a financed daily driver, but it leans cost-conscious instead of fully protected. Collision and comprehensive are present, rental reimbursement is included, and the main watchout is thinner liability protection plus no uninsured motorist coverage.",
  confidence: "high",
  extractionNotes: [
    "Demo policy uses realistic GEICO-style values so you can show the full experience without uploading a live policy.",
    "Gap flags are generated from deterministic coverage rules rather than insurer-specific underwriting logic.",
  ],
  currentMonthlyPremium: 118,
  protectionScore: 72,
  textLength: 3680,
};

export const demoComparisonQuote: ComparisonQuoteInput = {
  carrierName: "BudgetSure",
  monthlyPremium: 92,
  bodilyInjuryLimit: "25/50",
  propertyDamageLimit: "$25,000",
  collisionDeductible: "$1,500",
  comprehensiveDeductible: "$1,000",
  uninsuredMotoristIncluded: false,
  roadsideIncluded: false,
  rentalIncluded: false,
  notes:
    "Cheaper headline price, but it trims liability and removes rental reimbursement.",
};

export const demoQuoteComparison = compareQuote(
  demoPolicyAnalysis,
  demoPolicyAnalysis.currentMonthlyPremium ?? 118,
  demoComparisonQuote,
);

