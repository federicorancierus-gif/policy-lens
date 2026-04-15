export type PolicyDocumentType = "auto" | "homeowners" | "unknown";

const autoSignals = [
  /\bauto(?:mobile)? insurance policy\b/i,
  /\bauto policy\b/i,
  /\bbodily injury liability\b/i,
  /\bproperty damage liability\b/i,
  /\buninsured(?:\s*\/\s*underinsured)? motorist\b/i,
  /\bcollision(?: deductible)?\b/i,
  /\bcomprehensive(?: deductible)?\b/i,
  /\bvin\b/i,
  /\bvehicle\b/i,
  /\bdriver\b/i,
];

const homeownersSignals = [
  /\bhomeowners insurance policy\b/i,
  /\bpolicy form ho-\d\b/i,
  /\bcoverage a\b.*\bdwelling\b/i,
  /\bdwelling\b/i,
  /\bother structures\b/i,
  /\bpersonal property\b/i,
  /\bloss of use\b/i,
  /\binsured location\b/i,
  /\bmortgagee\b/i,
  /\bwater backup\b/i,
];

export function detectPolicyDocumentType(text: string, fileName = ""): PolicyDocumentType {
  const haystack = `${text}\n${fileName}`.trim();
  const autoScore = countMatches(haystack, autoSignals);
  const homeownersScore = countMatches(haystack, homeownersSignals);

  if (homeownersScore >= 2 && homeownersScore >= autoScore + 1) {
    return "homeowners";
  }

  if (autoScore >= 2 && autoScore >= homeownersScore) {
    return "auto";
  }

  if (homeownersScore >= 1 && autoScore === 0) {
    return "homeowners";
  }

  return "unknown";
}

export function buildUnsupportedPolicyMessage(documentType: PolicyDocumentType) {
  if (documentType === "homeowners") {
    return "This file looks like a homeowners policy. Policy Lens currently supports personal auto insurance only, so upload an auto declarations page or auto policy PDF instead.";
  }

  return "This policy type is not supported yet. Policy Lens currently supports personal auto insurance only.";
}

function countMatches(haystack: string, matchers: RegExp[]) {
  return matchers.reduce((count, matcher) => count + (matcher.test(haystack) ? 1 : 0), 0);
}
