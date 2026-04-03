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

export const sampleScannedPolicyAnalysis: PolicyAnalysis = {
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
      status: "limited",
      plainEnglishExplanation:
        "Pays for injuries you cause to someone else when you are at fault. Higher limits mean less risk that a serious crash spills into your own savings.",
      rawValue: "Bodily Injury Liability: $50,000 / $100,000",
    },
    {
      type: "propertyDamageLiability",
      label: "Property damage liability",
      limitOrDeductible: "$50,000",
      status: "limited",
      plainEnglishExplanation:
        "Pays for damage you cause to other cars, fences, buildings, and similar property. Low limits can run out quickly in a multi-car or newer-vehicle crash.",
      rawValue: "Property Damage Liability: $50,000",
    },
    {
      type: "uninsuredMotorist",
      label: "Uninsured / underinsured motorist",
      limitOrDeductible: "Not included",
      status: "missing",
      plainEnglishExplanation:
        "Helps when another driver hits you and either has no insurance or not enough of it. This matters more than people expect because many drivers are underinsured.",
      rawValue: "Uninsured Motorist: Not Included",
    },
    {
      type: "collision",
      label: "Collision",
      limitOrDeductible: "$1,000 deductible",
      status: "included",
      plainEnglishExplanation:
        "Pays to repair your car after a crash, regardless of fault, after you pay your deductible.",
      rawValue: "Collision Deductible: $1,000",
    },
    {
      type: "comprehensive",
      label: "Comprehensive",
      limitOrDeductible: "$500 deductible",
      status: "included",
      plainEnglishExplanation:
        "Covers non-crash damage such as theft, hail, vandalism, falling objects, or animal strikes, after your deductible.",
      rawValue: "Comprehensive Deductible: $500",
    },
    {
      type: "roadsideAssistance",
      label: "Roadside assistance",
      limitOrDeductible: "Not included",
      status: "missing",
      plainEnglishExplanation:
        "Helps with towing, jump starts, flat tires, lockouts, and similar roadside emergencies.",
      rawValue: "Roadside Assistance: Not Included",
    },
    {
      type: "rentalReimbursement",
      label: "Rental reimbursement",
      limitOrDeductible: "$40/day up to $1,200",
      status: "included",
      plainEnglishExplanation:
        "Helps pay for a rental car while your covered vehicle is being repaired after a claim.",
      rawValue: "Rental Reimbursement: $40/day up to $1,200",
    },
    {
      type: "medicalPayments",
      label: "Medical payments / PIP",
      limitOrDeductible: "$5,000",
      status: "included",
      plainEnglishExplanation:
        "Helps cover immediate medical expenses for you and passengers after an accident, depending on the state and policy structure.",
      rawValue: "Medical Payments: $5,000",
    },
  ],
  deductibles: [
    {
      type: "Collision",
      amount: "$1,000",
      note: "This is what you would pay out of pocket before collision coverage starts helping.",
    },
    {
      type: "Comprehensive",
      amount: "$500",
      note: "This is what you would pay before coverage helps with theft, hail, glass, or similar non-collision claims.",
    },
  ],
  exclusions: [
    {
      label: "Wear and tear or mechanical breakdown is not covered.",
      plainEnglishExplanation:
        "This line looks like policy fine print or a limitation. Treat it as something worth double-checking before you rely on coverage in that situation.",
    },
  ],
  gapFlags: [
    {
      title: "Liability limits may leave personal savings exposed",
      severity: "medium",
      whyItMatters:
        "Medical bills and attorney costs can run past low liability limits fast, especially when newer cars or multiple people are involved.",
      suggestedAction:
        "Model at least $100,000 / $300,000 bodily injury limits so the user can see the price difference against stronger protection.",
    },
    {
      title: "Property damage limit is on the thin side",
      severity: "medium",
      whyItMatters:
        "One damaged SUV, EV, storefront, or highway barrier can exceed a low property damage cap.",
      suggestedAction:
        "Compare the current limit against a $100,000 or $250,000 option to show whether the premium tradeoff is worth it.",
    },
    {
      title: "No uninsured / underinsured motorist coverage found",
      severity: "medium",
      whyItMatters:
        "If another driver has little or no coverage, the policyholder may have to absorb more of the financial hit themselves.",
      suggestedAction:
        "Ask for UM/UIM options that track the liability limits when the state allows it.",
    },
    {
      title: "No roadside assistance",
      severity: "low",
      whyItMatters:
        "This does not break the policy, but it removes help for towing, jump starts, and lockouts when stress is already high.",
      suggestedAction:
        "Show the add-on cost next to the price of a single tow so the tradeoff feels concrete.",
    },
    {
      title: "Collision deductible may be painful in a real claim",
      severity: "medium",
      whyItMatters:
        "A high deductible lowers premium now but can feel brutal when cash is tight after a crash.",
      suggestedAction:
        "Offer a side-by-side quote with a $500 deductible so the user can judge whether the monthly savings are worth the claim risk.",
    },
  ],
  plainEnglishSummary:
    "This scanned GEICO sample resolves to the same key protection story: physical damage coverage is present, but liability is still leaner than ideal and uninsured motorist protection is missing.",
  confidence: "medium",
  extractionNotes: [
    "Verified sample fallback loaded so the scanned demo stays reliable even if OCR is unavailable in the current environment.",
    "The source document for this result is the built-in image-based sample declarations page.",
  ],
  currentMonthlyPremium: 118,
  protectionScore: 22,
  textLength: 577,
};

export const demoQuoteComparison = compareQuote(
  demoPolicyAnalysis,
  demoPolicyAnalysis.currentMonthlyPremium ?? 118,
  demoComparisonQuote,
);

