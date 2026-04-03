import type { CoverageType } from "@/lib/types";

export const insuranceGlossary: Record<
  CoverageType,
  { label: string; plainEnglishExplanation: string }
> = {
  bodilyInjuryLiability: {
    label: "Bodily injury liability",
    plainEnglishExplanation:
      "Pays for injuries you cause to someone else when you are at fault. Higher limits mean less risk that a serious crash spills into your own savings.",
  },
  propertyDamageLiability: {
    label: "Property damage liability",
    plainEnglishExplanation:
      "Pays for damage you cause to other cars, fences, buildings, and similar property. Low limits can run out quickly in a multi-car or newer-vehicle crash.",
  },
  uninsuredMotorist: {
    label: "Uninsured / underinsured motorist",
    plainEnglishExplanation:
      "Helps when another driver hits you and either has no insurance or not enough of it. This matters more than people expect because many drivers are underinsured.",
  },
  collision: {
    label: "Collision",
    plainEnglishExplanation:
      "Pays to repair your car after a crash, regardless of fault, after you pay your deductible.",
  },
  comprehensive: {
    label: "Comprehensive",
    plainEnglishExplanation:
      "Covers non-crash damage such as theft, hail, vandalism, falling objects, or animal strikes, after your deductible.",
  },
  roadsideAssistance: {
    label: "Roadside assistance",
    plainEnglishExplanation:
      "Helps with towing, jump starts, flat tires, lockouts, and similar roadside emergencies.",
  },
  rentalReimbursement: {
    label: "Rental reimbursement",
    plainEnglishExplanation:
      "Helps pay for a rental car while your covered vehicle is being repaired after a claim.",
  },
  medicalPayments: {
    label: "Medical payments / PIP",
    plainEnglishExplanation:
      "Helps cover immediate medical expenses for you and passengers after an accident, depending on the state and policy structure.",
  },
};

export const bodilyInjuryOptions = ["25/50", "50/100", "100/300", "250/500", "500/500"];

export const propertyDamageOptions = [
  "$25,000",
  "$50,000",
  "$100,000",
  "$250,000",
  "$500,000",
];

export const deductibleOptions = [
  "$250",
  "$500",
  "$1,000",
  "$1,500",
  "$2,000",
  "Not included",
];

