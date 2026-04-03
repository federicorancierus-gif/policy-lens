import { insuranceGlossary } from "@/lib/glossary";
import type {
  CoverageItem,
  CoverageType,
  DeductibleItem,
  ExclusionItem,
  VehicleInfo,
} from "@/lib/types";

interface ExtractedPolicyData {
  carrierName: string;
  policyPeriod: string;
  vehicles: VehicleInfo[];
  coverages: CoverageItem[];
  deductibles: DeductibleItem[];
  exclusions: ExclusionItem[];
  extractionNotes: string[];
  currentMonthlyPremium: number | null;
  matchedCoverageCount: number;
  textLength: number;
}

type CoverageCategory = "limit" | "money" | "toggle";

interface CoverageDefinition {
  type: CoverageType;
  label: string;
  aliases: string[];
  category: CoverageCategory;
  absentMeansMissing: boolean;
}

const coverageDefinitions: CoverageDefinition[] = [
  {
    type: "bodilyInjuryLiability",
    label: "Bodily injury liability",
    aliases: ["bodily injury liability", "bi liability", "bodily injury"],
    category: "limit",
    absentMeansMissing: false,
  },
  {
    type: "propertyDamageLiability",
    label: "Property damage liability",
    aliases: ["property damage liability", "pd liability", "property damage"],
    category: "money",
    absentMeansMissing: false,
  },
  {
    type: "uninsuredMotorist",
    label: "Uninsured / underinsured motorist",
    aliases: [
      "uninsured motorist",
      "underinsured motorist",
      "um/uim",
      "uninsured/underinsured motorist",
    ],
    category: "limit",
    absentMeansMissing: true,
  },
  {
    type: "collision",
    label: "Collision",
    aliases: ["collision"],
    category: "money",
    absentMeansMissing: true,
  },
  {
    type: "comprehensive",
    label: "Comprehensive",
    aliases: ["comprehensive", "other than collision"],
    category: "money",
    absentMeansMissing: true,
  },
  {
    type: "roadsideAssistance",
    label: "Roadside assistance",
    aliases: ["roadside assistance", "emergency road service", "towing and labor"],
    category: "toggle",
    absentMeansMissing: true,
  },
  {
    type: "rentalReimbursement",
    label: "Rental reimbursement",
    aliases: [
      "rental reimbursement",
      "transportation expense",
      "rental expense",
      "rental car reimbursement",
    ],
    category: "money",
    absentMeansMissing: true,
  },
  {
    type: "medicalPayments",
    label: "Medical payments / PIP",
    aliases: ["medical payments", "med pay", "personal injury protection", "pip"],
    category: "money",
    absentMeansMissing: true,
  },
];

const knownCarriers = [
  "GEICO",
  "Progressive",
  "State Farm",
  "Allstate",
  "Liberty Mutual",
  "Travelers",
  "Nationwide",
  "Farmers",
  "USAA",
  "The General",
];

const knownVehicleMakes = [
  "Acura",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jeep",
  "Kia",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Mercedes-Benz",
  "Mini",
  "Nissan",
  "Porsche",
  "Ram",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const exclusionKeywordMatchers = [
  /not covered/i,
  /exclusion/i,
  /excluded/i,
  /does not cover/i,
  /coverage does not apply/i,
];

const missingCoverageMatchers = [
  /declined/i,
  /rejected/i,
  /waived/i,
  /not included/i,
  /not carried/i,
  /\bnone\b/i,
  /excluded/i,
];

const numberFormatter = new Intl.NumberFormat("en-US");

export function extractPolicyData(
  rawText: string,
  fileName: string,
  parseIssue?: string,
): ExtractedPolicyData {
  const normalizedText = normalizePolicyText(rawText);
  const lines = normalizedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const coverages = coverageDefinitions.map((definition) =>
    buildCoverageItem(definition, lines, normalizedText),
  );

  const deductibles = coverages
    .filter(
      (coverage) =>
        (coverage.type === "collision" || coverage.type === "comprehensive") &&
        coverage.status !== "missing" &&
        coverage.status !== "unknown",
    )
    .map((coverage) => ({
      type: coverage.label,
      amount: extractFirstDollarAmount(coverage.limitOrDeductible) ?? coverage.limitOrDeductible,
      note:
        coverage.type === "collision"
          ? "This is what you would pay out of pocket before collision coverage starts helping."
          : "This is what you would pay before coverage helps with theft, hail, glass, or similar non-collision claims.",
    }));

  const extractionNotes: string[] = [];

  if (parseIssue) {
    extractionNotes.push(parseIssue);
  }

  if (normalizedText.length < 200) {
    extractionNotes.push(
      "This PDF may be image-based or lightly searchable, so some values are inferred conservatively.",
    );
  }

  if (
    !coverages.some(
      (coverage) => coverage.type === "bodilyInjuryLiability" && coverage.status !== "unknown",
    )
  ) {
    extractionNotes.push(
      "Liability limits were hard to locate in the document. Treat the summary as directional until a human reviews the declarations page.",
    );
  }

  return {
    carrierName: detectCarrierName(normalizedText, fileName),
    policyPeriod: detectPolicyPeriod(normalizedText),
    vehicles: detectVehicles(lines),
    coverages,
    deductibles,
    exclusions: extractExclusions(lines),
    extractionNotes,
    currentMonthlyPremium: detectMonthlyPremium(lines),
    matchedCoverageCount: coverages.filter(
      (coverage) => coverage.status === "included" || coverage.status === "limited",
    ).length,
    textLength: normalizedText.length,
  };
}

function normalizePolicyText(text: string) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildCoverageItem(
  definition: CoverageDefinition,
  lines: string[],
  normalizedText: string,
): CoverageItem {
  const snippet = findCoverageSnippet(lines, normalizedText, definition.aliases);
  const glossary = insuranceGlossary[definition.type];

  if (!snippet) {
    return {
      type: definition.type,
      label: definition.label,
      limitOrDeductible: definition.absentMeansMissing ? "Not included" : "Unable to confirm",
      status: definition.absentMeansMissing ? "missing" : "unknown",
      plainEnglishExplanation: glossary.plainEnglishExplanation,
    };
  }

  if (isMissingCoverage(snippet)) {
    return {
      type: definition.type,
      label: definition.label,
      limitOrDeductible: "Not included",
      status: "missing",
      plainEnglishExplanation: glossary.plainEnglishExplanation,
      rawValue: snippet,
    };
  }

  const extractedValue = extractCoverageValue(snippet, definition.category);

  return {
    type: definition.type,
    label: definition.label,
    limitOrDeductible: extractedValue,
    status: isLimitedValue(definition.type, extractedValue) ? "limited" : "included",
    plainEnglishExplanation: glossary.plainEnglishExplanation,
    rawValue: snippet,
  };
}

function findCoverageSnippet(lines: string[], normalizedText: string, aliases: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    const currentLineLower = currentLine.toLowerCase();
    if (aliases.some((alias) => currentLineLower.includes(alias.toLowerCase()))) {
      if (looksLikeCompleteCoverageLine(currentLine)) {
        return currentLine.trim();
      }

      return [lines[index], lines[index + 1], lines[index + 2]]
        .filter(Boolean)
        .join(" ")
        .trim();
    }
  }

  const flattenedText = normalizedText.replace(/\n/g, " ");

  for (const alias of aliases) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(`${escapedAlias}([^.!?]{0,120})`, "i");
    const match = flattenedText.match(matcher);

    if (match) {
      return `${alias} ${match[1]}`.trim();
    }
  }

  return null;
}

function looksLikeCompleteCoverageLine(line: string) {
  return (
    /[:$]/.test(line) ||
    /\b(included|not included|declined|waived|none|excluded)\b/i.test(line) ||
    /\d/.test(line)
  );
}

function extractCoverageValue(snippet: string, category: CoverageCategory) {
  if (category === "limit") {
    const slashMatch = snippet.match(/(\$?\d[\d,]*)\s*\/\s*(\$?\d[\d,]*)(?:\s*\/\s*(\$?\d[\d,]*))?/);

    if (slashMatch) {
      const values = slashMatch.slice(1).filter(Boolean).map(formatCoverageLimitToken);
      return values.join(" / ");
    }
  }

  const dollarMatches = [...snippet.matchAll(/\$?\d[\d,]*(?:\.\d{2})?/g)].map((match) => match[0]);

  if (category === "money" && dollarMatches.length >= 2 && /day|max|per/i.test(snippet)) {
    const [first, second] = dollarMatches.map(formatCurrencyToken);
    return `${first}/day up to ${second}`;
  }

  if (category === "money" && dollarMatches.length >= 1) {
    const value = formatCurrencyToken(dollarMatches[0]);
    return /deduct/i.test(snippet) ? `${value} deductible` : value;
  }

  if (category === "toggle") {
    return "Included";
  }

  return "Included";
}

function formatCoverageLimitToken(token: string) {
  const numeric = Number.parseInt(token.replace(/[$,]/g, ""), 10);

  if (Number.isNaN(numeric)) {
    return token;
  }

  if (!token.includes("$") && numeric <= 999) {
    return `$${numberFormatter.format(numeric)}k`;
  }

  return `$${numberFormatter.format(numeric)}`;
}

function formatCurrencyToken(token: string) {
  const numeric = Number.parseFloat(token.replace(/[$,]/g, ""));

  if (!Number.isFinite(numeric)) {
    return token;
  }

  return `$${numberFormatter.format(numeric)}`;
}

function extractFirstDollarAmount(value: string) {
  const match = value.match(/\$[\d,]+/);
  return match?.[0];
}

function isMissingCoverage(snippet: string) {
  return missingCoverageMatchers.some((matcher) => matcher.test(snippet));
}

function isLimitedValue(type: CoverageType, value: string) {
  if (type === "bodilyInjuryLiability") {
    const [firstAmount] = extractNumericAmounts(value);
    return firstAmount > 0 && firstAmount < 100000;
  }

  if (type === "propertyDamageLiability") {
    const [amount] = extractNumericAmounts(value);
    return amount > 0 && amount < 100000;
  }

  return false;
}

function extractNumericAmounts(value: string) {
  return [...value.matchAll(/\d[\d,]*/g)]
    .map((match) => match[0].replace(/,/g, ""))
    .map((token) => Number.parseInt(token, 10))
    .filter((amount) => Number.isFinite(amount))
    .map((amount) => (amount <= 999 ? amount * 1000 : amount));
}

function detectCarrierName(text: string, fileName: string) {
  const haystack = `${text} ${fileName}`.toLowerCase();
  return (
    knownCarriers.find((carrier) => haystack.includes(carrier.toLowerCase())) ?? "Unknown carrier"
  );
}

function detectPolicyPeriod(text: string) {
  const periodMatch = text.match(
    /policy period[^0-9]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})[^0-9]{1,15}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  );

  if (periodMatch) {
    return `${periodMatch[1]} to ${periodMatch[2]}`;
  }

  const dateMatches = [...text.matchAll(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g)].map((match) => match[0]);

  if (dateMatches.length >= 2) {
    return `${dateMatches[0]} to ${dateMatches[1]}`;
  }

  return "Unable to confirm policy term";
}

function detectVehicles(lines: string[]) {
  const vehicles: VehicleInfo[] = [];
  const makePattern = knownVehicleMakes.join("|").replace(/ /g, "\\s+");
  const vehicleMatcher = new RegExp(
    `\\b(19\\d{2}|20\\d{2}|21\\d{2})\\s+(${makePattern})\\s+([A-Za-z0-9-]+(?:\\s+[A-Za-z0-9-]+){0,2})`,
    "i",
  );

  for (const line of lines) {
    const match = line.match(vehicleMatcher);

    if (match) {
      vehicles.push({
        year: Number.parseInt(match[1], 10),
        make: match[2],
        model: match[3],
      });
    }

    if (vehicles.length === 2) {
      break;
    }
  }

  return vehicles;
}

function detectMonthlyPremium(lines: string[]) {
  const premiumMatchers = [
    {
      matcher: /(monthly premium|monthly payment)[^\d$]{0,20}\$?([\d,]+(?:\.\d{2})?)/i,
      divisor: 1,
    },
    {
      matcher: /(6[- ]month premium|six[- ]month premium|policy premium|total premium)[^\d$]{0,20}\$?([\d,]+(?:\.\d{2})?)/i,
      divisor: 6,
    },
    {
      matcher: /(premium)[^\d$]{0,20}\$?([\d,]+(?:\.\d{2})?)/i,
      divisor: 0,
    },
  ];

  for (const line of lines) {
    for (const premiumMatcher of premiumMatchers) {
      const match = line.match(premiumMatcher.matcher);

      if (match) {
        const numeric = Number.parseFloat(match[2].replace(/,/g, ""));

        if (!Number.isFinite(numeric)) {
          continue;
        }

        if (premiumMatcher.divisor === 0) {
          return numeric > 350 ? Math.round((numeric / 6) * 100) / 100 : numeric;
        }

        return Math.round((numeric / premiumMatcher.divisor) * 100) / 100;
      }
    }
  }

  return null;
}

function extractExclusions(lines: string[]) {
  const extracted = lines
    .filter((line) => exclusionKeywordMatchers.some((matcher) => matcher.test(line)))
    .slice(0, 3)
    .map((line) => ({
      label: line,
      plainEnglishExplanation:
        "This line looks like policy fine print or a limitation. Treat it as something worth double-checking before you rely on coverage in that situation.",
    }));

  if (extracted.length > 0) {
    return extracted;
  }

  return [
    {
      label: "Wear and tear / mechanical breakdown",
      plainEnglishExplanation:
        "Auto insurance usually does not pay for normal aging, maintenance, or a part failing on its own.",
    },
    {
      label: "Commercial or rideshare use without endorsement",
      plainEnglishExplanation:
        "If the vehicle is used for deliveries or rideshare work without the right endorsement, claims can be denied.",
    },
    {
      label: "Intentional damage or fraud",
      plainEnglishExplanation:
        "Deliberate damage and misrepresentation are standard exclusions on personal auto policies.",
    },
  ];
}

