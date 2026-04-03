"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  CarFront,
  FileText,
  LifeBuoy,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";

import {
  bodilyInjuryOptions,
  deductibleOptions,
  insuranceGlossary,
  propertyDamageOptions,
} from "@/lib/glossary";
import {
  demoComparisonQuote,
  demoPolicyAnalysis,
  demoQuoteComparison,
} from "@/lib/demo-scenarios";
import type {
  ComparisonQuoteInput,
  CoverageStatus,
  CoverageType,
  PolicyAnalysis,
  QuoteComparison,
} from "@/lib/types";

type QuoteFormState = {
  carrierName: string;
  currentMonthlyPremium: string;
  monthlyPremium: string;
  bodilyInjuryLimit: string;
  propertyDamageLimit: string;
  collisionDeductible: string;
  comprehensiveDeductible: string;
  uninsuredMotoristIncluded: boolean;
  roadsideIncluded: boolean;
  rentalIncluded: boolean;
  notes: string;
};

const emptyQuoteForm: QuoteFormState = {
  carrierName: "",
  currentMonthlyPremium: "",
  monthlyPremium: "",
  bodilyInjuryLimit: "50/100",
  propertyDamageLimit: "$50,000",
  collisionDeductible: "$1,000",
  comprehensiveDeductible: "$500",
  uninsuredMotoristIncluded: false,
  roadsideIncluded: false,
  rentalIncluded: false,
  notes: "",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const demoMonthlySavings = Math.max(
  0,
  (demoPolicyAnalysis.currentMonthlyPremium ?? 0) - demoComparisonQuote.monthlyPremium,
);

const productName = "Policy Lens";

export function PolicyDecoderApp({ mode = "home" }: { mode?: "home" | "demo" }) {
  const isDemoMode = mode === "demo";
  const initialDemoAnalysis = isDemoMode ? structuredClone(demoPolicyAnalysis) : null;
  const initialDemoQuoteForm = isDemoMode
    ? {
        ...buildQuoteFormFromAnalysis(demoPolicyAnalysis),
        carrierName: demoComparisonQuote.carrierName,
        currentMonthlyPremium: String(demoPolicyAnalysis.currentMonthlyPremium ?? ""),
        monthlyPremium: String(demoComparisonQuote.monthlyPremium),
        bodilyInjuryLimit: demoComparisonQuote.bodilyInjuryLimit,
        propertyDamageLimit: demoComparisonQuote.propertyDamageLimit,
        collisionDeductible: demoComparisonQuote.collisionDeductible,
        comprehensiveDeductible: demoComparisonQuote.comprehensiveDeductible,
        uninsuredMotoristIncluded: demoComparisonQuote.uninsuredMotoristIncluded,
        roadsideIncluded: demoComparisonQuote.roadsideIncluded,
        rentalIncluded: demoComparisonQuote.rentalIncluded,
        notes: demoComparisonQuote.notes ?? "",
      }
    : emptyQuoteForm;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PolicyAnalysis | null>(initialDemoAnalysis);
  const [comparison, setComparison] = useState<QuoteComparison | null>(
    isDemoMode ? structuredClone(demoQuoteComparison) : null,
  );
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>(initialDemoQuoteForm);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonPulse, setComparisonPulse] = useState(false);
  const comparisonOutputRef = useRef<HTMLDivElement | null>(null);

  const glossaryCards = useMemo(() => buildGlossaryCards(analysis), [analysis]);
  const coverageCuts = useMemo(
    () => comparison?.coverageDifferences.filter((difference) => difference.winner === "current") ?? [],
    [comparison],
  );

  function revealComparison() {
    setComparisonPulse(true);

    window.setTimeout(() => {
      setComparisonPulse(false);
    }, 900);

    window.requestAnimationFrame(() => {
      comparisonOutputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function handleAnalyzeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setAnalysisError("Choose a policy PDF first, or load the demo scenario.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setComparison(null);
    setComparisonError(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);

      const response = await fetch("/api/policies/analyze", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to analyze that policy PDF.");
      }

      const nextAnalysis = payload as PolicyAnalysis;
      setAnalysis(nextAnalysis);
      setQuoteForm(buildQuoteFormFromAnalysis(nextAnalysis));
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Something went wrong while analyzing the PDF.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleCompareSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!analysis) {
      setComparisonError("Analyze a policy first so we have a baseline to compare against.");
      return;
    }

    const currentMonthlyPremium = parseMoneyInput(quoteForm.currentMonthlyPremium);
    const monthlyPremium = parseMoneyInput(quoteForm.monthlyPremium);

    if (
      !Number.isFinite(currentMonthlyPremium) ||
      !Number.isFinite(monthlyPremium) ||
      currentMonthlyPremium <= 0 ||
      monthlyPremium <= 0
    ) {
      setComparisonError("Enter both monthly premiums before running the quote comparison.");
      return;
    }

    setIsComparing(true);
    setComparisonError(null);

    try {
      const response = await fetch("/api/quotes/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPolicy: analysis,
          currentMonthlyPremium,
          comparisonQuote: {
            carrierName: quoteForm.carrierName || "Alternate quote",
            monthlyPremium,
            bodilyInjuryLimit: quoteForm.bodilyInjuryLimit,
            propertyDamageLimit: quoteForm.propertyDamageLimit,
            collisionDeductible: quoteForm.collisionDeductible,
            comprehensiveDeductible: quoteForm.comprehensiveDeductible,
            uninsuredMotoristIncluded: quoteForm.uninsuredMotoristIncluded,
            roadsideIncluded: quoteForm.roadsideIncluded,
            rentalIncluded: quoteForm.rentalIncluded,
            notes: quoteForm.notes,
          } satisfies ComparisonQuoteInput,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to compare the quote right now.");
      }

      setComparison(payload as QuoteComparison);
      revealComparison();
    } catch (error) {
      setComparisonError(
        error instanceof Error ? error.message : "Something went wrong while comparing quotes.",
      );
    } finally {
      setIsComparing(false);
    }
  }

  function handleLoadDemo() {
    const nextAnalysis = structuredClone(demoPolicyAnalysis);

    setSelectedFile(null);
    setAnalysis(nextAnalysis);
    setComparison(isDemoMode ? structuredClone(demoQuoteComparison) : null);
    setAnalysisError(null);
    setComparisonError(null);
    setQuoteForm({
      ...buildQuoteFormFromAnalysis(nextAnalysis),
      carrierName: demoComparisonQuote.carrierName,
      currentMonthlyPremium: String(nextAnalysis.currentMonthlyPremium ?? ""),
      monthlyPremium: String(demoComparisonQuote.monthlyPremium),
      bodilyInjuryLimit: demoComparisonQuote.bodilyInjuryLimit,
      propertyDamageLimit: demoComparisonQuote.propertyDamageLimit,
      collisionDeductible: demoComparisonQuote.collisionDeductible,
      comprehensiveDeductible: demoComparisonQuote.comprehensiveDeductible,
      uninsuredMotoristIncluded: demoComparisonQuote.uninsuredMotoristIncluded,
      roadsideIncluded: demoComparisonQuote.roadsideIncluded,
      rentalIncluded: demoComparisonQuote.rentalIncluded,
      notes: demoComparisonQuote.notes ?? "",
    });
  }

  function handleLoadComparisonDemo() {
    setComparisonError(null);
    setQuoteForm((current) => ({
      ...current,
      carrierName: demoComparisonQuote.carrierName,
      currentMonthlyPremium:
        current.currentMonthlyPremium || String(analysis?.currentMonthlyPremium ?? demoPolicyAnalysis.currentMonthlyPremium ?? ""),
      monthlyPremium: String(demoComparisonQuote.monthlyPremium),
      bodilyInjuryLimit: demoComparisonQuote.bodilyInjuryLimit,
      propertyDamageLimit: demoComparisonQuote.propertyDamageLimit,
      collisionDeductible: demoComparisonQuote.collisionDeductible,
      comprehensiveDeductible: demoComparisonQuote.comprehensiveDeductible,
      uninsuredMotoristIncluded: demoComparisonQuote.uninsuredMotoristIncluded,
      roadsideIncluded: demoComparisonQuote.roadsideIncluded,
      rentalIncluded: demoComparisonQuote.rentalIncluded,
      notes: demoComparisonQuote.notes ?? "",
    }));
  }

  return (
    <main className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[var(--sun)]/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[var(--accent)]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[var(--accent-soft)]/18 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
        <header className="reveal flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Insurance clarity, one upload away</p>
            <h1 className="display-type mt-2 text-3xl leading-tight text-slate-950 sm:text-4xl">
              {productName}
            </h1>
          </div>
          {isDemoMode ? (
            <div className="flex flex-wrap gap-3">
              <Link className="inline-flex items-center justify-center rounded-full border border-[var(--panel)]/12 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--accent)]/30 hover:bg-white" href="/">
                Back to home
              </Link>
              <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--panel-soft)]"
                type="button"
                onClick={handleLoadDemo}
              >
                <Sparkles className="h-4 w-4" />
                Reset demo
              </button>
            </div>
          ) : null}
        </header>

        {isDemoMode ? (
          <section className="reveal reveal-delay-1 glass-panel rounded-[2rem] border border-white/50 px-6 py-6 lg:px-8">
            <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr] xl:items-center">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Sample walkthrough</p>
                <h2 className="display-type mt-3 text-4xl leading-tight text-slate-950 sm:text-5xl">
                  See how price and protection change side by side.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-700">
                  This page starts with a realistic sample policy and quote so you can try the product immediately, then
                  swap in your own numbers and see the comparison update live.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <DemoBeat
                    step="01"
                    title="Decode"
                    body="Turn declarations-page jargon into something a driver can understand in seconds."
                  />
                  <DemoBeat
                    step="02"
                    title="Spot risk"
                    body="Surface the moments where thin limits or missing coverage become claim-time regret."
                  />
                  <DemoBeat
                    step="03"
                    title="Compare"
                    body="See what gets better, what gets worse, and whether the lower premium is actually worth it."
                  />
                </div>
              </div>

              <div className="rounded-[1.9rem] border border-[var(--panel)]/12 bg-white/82 p-5 shadow-[0_24px_70px_rgba(12,90,67,0.08)]">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_188px] lg:items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Protection comparison
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      Coverage strength should read clearly at a glance
                    </p>
                  </div>
                  <div className="flex min-h-[132px] flex-col items-center justify-center rounded-[1.5rem] border border-[var(--panel)]/10 bg-[var(--accent-soft)]/28 px-5 py-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                      Premium delta
                    </p>
                    <p className="mt-3 text-4xl font-semibold leading-none text-slate-950">
                      {formatPriceDelta(comparison?.priceDelta ?? demoQuoteComparison.priceDelta)}
                    </p>
                    <p className="mt-3 text-sm text-slate-600">Monthly savings on the cheaper quote</p>
                  </div>
                </div>

                <div className="mt-5">
                  <ProtectionMeterCard
                    currentLabel={demoPolicyAnalysis.carrierName}
                    comparisonLabel={demoComparisonQuote.carrierName}
                    currentScore={comparison?.currentProtectionScore ?? demoQuoteComparison.currentProtectionScore}
                    comparisonScore={comparison?.comparisonProtectionScore ?? demoQuoteComparison.comparisonProtectionScore}
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <PreviewStat label="Mode" value="Interactive demo" />
                  <PreviewStat label="Loaded policy" value="GEICO sample policy" />
                  <PreviewStat label="Main reveal" value="Price vs protection" />
                </div>
              </div>
            </div>
          </section>
        ) : (
        <section className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-start">
          <div className="space-y-8 pt-2">
            <div className="reveal reveal-delay-1 space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--panel)]/12 bg-white/80 px-4 py-2 text-sm text-slate-700">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                Auto insurance explained in plain English
              </span>
              <h2 className="display-type max-w-5xl text-5xl leading-[0.92] text-slate-950 sm:text-6xl lg:text-[5.15rem]">
                Know what you are actually covered for before a claim forces you to.
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-700">
                Upload a policy PDF, decode the legalese, surface the blind spots that matter, and compare whether a
                cheaper quote is really worth what it strips away.
              </p>
            </div>

            <div className="reveal reveal-delay-2 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--panel)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--panel-soft)]"
                href="#upload-panel"
              >
                Decode my policy
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white transition hover:brightness-105" href="/demo" rel="noreferrer" target="_blank">
                <Sparkles className="h-4 w-4" />
                Try live demo
              </Link>
            </div>

            <div className="reveal reveal-delay-2 flex flex-wrap gap-3">
              <SignalPill tone="warning" text="Low liability detected before claim time" />
              <SignalPill tone="warning" text="Rental coverage missing from cheaper quote" />
              <SignalPill tone="neutral" text={`${currencyFormatter.format(demoMonthlySavings)}/mo savings normalized against protection`} />
            </div>

            <div className="reveal reveal-delay-3 grid gap-4 xl:grid-cols-3">
              <HeroMetric
                icon={<FileText className="h-5 w-5" />}
                title="Policy translation"
                stat="8 coverage lines decoded"
                description="From bodily injury liability to rental reimbursement, the tool rewrites dense policy language into something clear and usable."
              />
              <HeroMetric
                icon={<ShieldAlert className="h-5 w-5" />}
                title="Claim-time surprises"
                stat="Top 5 blind spots surfaced"
                description="Low limits, missing UM/UIM, no roadside, and deductible pain get elevated before they become stressful surprises."
              />
              <HeroMetric
                icon={<Scale className="h-5 w-5" />}
                title="Quote normalization"
                stat={`${currencyFormatter.format(demoMonthlySavings)}/mo cheaper can still lose`}
                description="The app turns price-first shopping into a real protection tradeoff conversation instead of a race to the cheapest premium."
              />
            </div>
          </div>

          <div
            id="upload-panel"
            className="reveal reveal-delay-2 glass-panel-strong rounded-[2rem] border border-white/55 p-6 shadow-[0_24px_80px_rgba(12,90,67,0.14)] lg:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Preview first</p>
                <h3 className="display-type mt-2 text-3xl text-slate-950">See the decoded result before you upload</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  The live demo below shows the exact kind of output a user gets back: translated coverage, surfaced
                  risks, and a quote tradeoff that feels concrete.
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--panel)] p-3 text-[var(--sun)]">
                <UploadCloud className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(232,248,238,0.96))] shadow-[0_18px_50px_rgba(12,90,67,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-200" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Decoded policy view</p>
                </div>
                <div className="flex items-center gap-2">
                  <PreviewTab active label="Summary" />
                  <PreviewTab label="Gaps" />
                  <PreviewTab label="Compare" />
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                  <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/88 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Policy summary</p>
                        <p className="mt-2 text-xl font-semibold text-slate-950">
                          {demoPolicyAnalysis.carrierName} policy · {titleCase(demoPolicyAnalysis.confidence)} confidence
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-white">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Protection score</p>
                        <p className="mt-2 text-2xl font-semibold">{demoPolicyAnalysis.protectionScore}/100</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-700">{demoPolicyAnalysis.plainEnglishSummary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {demoPolicyAnalysis.coverages.slice(0, 4).map((coverage) => (
                        <span
                          key={coverage.type}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {coverage.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-[var(--accent)]/20 bg-[var(--accent)]/7 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">What the cheaper quote cuts</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {currencyFormatter.format(demoMonthlySavings)}/mo cheaper
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      The headline price drops, but so does protection. This is the exact trap the product is built to
                      explain.
                    </p>
                    <div className="mt-4 space-y-2">
                      <PreviewDelta label="Bodily injury" current="$50k / $100k" next="$25k / $50k" />
                      <PreviewDelta label="Rental reimbursement" current="Included" next="Removed" />
                      <PreviewDelta label="Collision deductible" current="$1,000" next="$1,500" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <PreviewStat label="Liability watchout" value="Low limits" />
                  <PreviewStat label="Hidden cost" value="No rental coverage" />
                  <PreviewStat label="Biggest tradeoff" value="Cheaper but weaker" />
                </div>

                <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/88 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Claim-time surprises</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {demoPolicyAnalysis.gapFlags.slice(0, 3).map((flag) => (
                      <div key={flag.title} className="rounded-[1.2rem] bg-slate-50 px-3 py-3">
                        <div className="flex items-center gap-2 text-[var(--accent)]">
                          <TriangleAlert className="h-4 w-4" />
                          <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                            {titleCase(flag.severity)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{flag.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleAnalyzeSubmit}>
              <label className="field-shell flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.6rem] border border-dashed px-6 py-9 text-center transition hover:border-[var(--accent)] hover:bg-white">
                <input
                  accept="application/pdf"
                  className="hidden"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedFile(file);
                    setAnalysisError(null);
                  }}
                />
                <div className="rounded-full bg-[var(--panel)]/8 p-3 text-[var(--panel)]">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {selectedFile ? selectedFile.name : "Choose a policy PDF"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Best with a searchable declarations PDF. Files stay session-scoped for this MVP.
                  </p>
                </div>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--panel)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--panel-soft)] disabled:cursor-not-allowed disabled:bg-slate-500"
                  disabled={isAnalyzing}
                  type="submit"
                >
                  {isAnalyzing ? "Decoding policy..." : "Decode my policy"}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105" href="/demo" rel="noreferrer" target="_blank">
                  <Sparkles className="h-4 w-4" />
                  Try live demo
                </Link>
              </div>

              {analysisError ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {analysisError}
                </p>
              ) : null}
            </form>
          </div>
        </section>
        )}

        {analysis ? (
          <>
            <section className="reveal reveal-delay-1 grid gap-6 lg:grid-cols-[1fr_0.92fr]">
              <div className="rounded-[2rem] bg-[var(--panel)] px-6 py-6 text-white shadow-[0_28px_90px_rgba(12,90,67,0.22)] lg:px-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                      Analysis snapshot
                    </p>
                    <h3 className="display-type mt-2 text-4xl">{analysis.carrierName}</h3>
                    <p className="mt-2 max-w-2xl text-base leading-7 text-slate-200">
                      {analysis.plainEnglishSummary}
                    </p>
                  </div>
                  <div className="flex min-w-[212px] flex-col items-center justify-center rounded-[1.5rem] bg-white/10 px-5 py-4 text-center">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-300">Confidence</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{titleCase(analysis.confidence)}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <AnalysisStat label="Policy term" value={analysis.policyPeriod} />
                  <AnalysisStat
                    label="Vehicles detected"
                    value={analysis.vehicles.length > 0 ? String(analysis.vehicles.length) : "0 found"}
                  />
                  <AnalysisStat
                    label="Estimated monthly premium"
                    value={analysis.currentMonthlyPremium ? currencyFormatter.format(analysis.currentMonthlyPremium) : "Add manually"}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ScoreCard
                  icon={<ShieldCheck className="h-5 w-5" />}
                  label="Protection score"
                  value={`${analysis.protectionScore}/100`}
                  body="Higher scores mean stronger normalized protection across the core coverages this MVP inspects."
                />
                <ScoreCard
                  icon={<TriangleAlert className="h-5 w-5" />}
                  label="Gap flags"
                  value={String(analysis.gapFlags.length)}
                  body="The app prioritizes the 3-5 blind spots most likely to surprise a driver at claim time."
                />
                <ScoreCard
                  icon={<CarFront className="h-5 w-5" />}
                  label="Vehicles"
                  value={analysis.vehicles[0] ? vehicleLabel(analysis.vehicles[0]) : "Not clearly parsed"}
                  body="Vehicle detection helps the prototype infer whether missing physical damage coverage is more concerning."
                />
                <ScoreCard
                  icon={<BadgeDollarSign className="h-5 w-5" />}
                  label="Best next move"
                  value={analysis.gapFlags[0]?.title ?? "Coverage looks balanced"}
                  body="This is the strongest story beat for a live demo: show the biggest risk and what GEICO should recommend next."
                />
              </div>
            </section>

            <section className="reveal reveal-delay-2 glass-panel rounded-[2rem] border border-white/45 px-6 py-6 lg:px-8">
              <SectionHeader
                kicker="Coverage breakdown"
                title="Plain-English policy translation"
                description="Every major line is normalized into a coverage card so the user can see what is actually included, what looks thin, and what may be missing."
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {analysis.coverages.map((coverage) => (
                  <article
                    key={coverage.type}
                    className="rounded-[1.5rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_14px_40px_rgba(12,90,67,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{coverage.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-[var(--panel)]">
                          {coverage.limitOrDeductible}
                        </p>
                      </div>
                      <StatusBadge status={coverage.status} />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {coverage.plainEnglishExplanation}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section
              className={`reveal reveal-delay-2 grid gap-6 ${isDemoMode ? "" : "xl:grid-cols-[1.08fr_0.92fr]"}`}
            >
              <div className="glass-panel rounded-[2rem] border border-white/45 px-6 py-6 lg:px-8">
                <SectionHeader
                  kicker="Gap flags"
                  title="Claim-time surprises to highlight"
                  description="These are the moments where a customer thinks they are protected until a real accident exposes a blind spot."
                />
                <div className="mt-6 space-y-4">
                  {analysis.gapFlags.map((flag) => (
                    <article
                      key={flag.title}
                      className="rounded-[1.5rem] border border-slate-200/75 bg-white/88 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{flag.title}</p>
                          <p className="mt-3 text-sm leading-6 text-slate-600">{flag.whyItMatters}</p>
                        </div>
                        <SeverityBadge severity={flag.severity} />
                      </div>
                      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Suggested action:</span> {flag.suggestedAction}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {!isDemoMode ? (
                <div className="space-y-6">
                  <section className="glass-panel rounded-[2rem] border border-white/45 px-6 py-6">
                    <SectionHeader
                      kicker="Exclusions and fine print"
                      title="What this policy likely does not protect"
                      description="Some exclusions are pulled directly from the PDF; others are standard personal auto limitations worth calling out in the product story."
                    />
                    <div className="mt-6 space-y-3">
                      {analysis.exclusions.map((exclusion) => (
                        <div key={exclusion.label} className="rounded-[1.35rem] border border-slate-200/80 bg-white/88 p-4">
                          <p className="font-semibold text-slate-900">{exclusion.label}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {exclusion.plainEnglishExplanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="glass-panel rounded-[2rem] border border-white/45 px-6 py-6">
                    <SectionHeader
                      kicker="Extraction notes"
                      title="What the parser was confident about"
                      description="This keeps the prototype honest when the PDF is messy or lightly searchable."
                    />
                    <div className="mt-4 space-y-3">
                      {analysis.extractionNotes.map((note) => (
                        <div key={note} className="rounded-2xl border border-slate-200/75 bg-white/88 px-4 py-3 text-sm leading-6 text-slate-700">
                          {note}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}
            </section>
            <section className="reveal reveal-delay-3 grid items-start gap-6 xl:grid-cols-[0.96fr_1.04fr]">
              <div className="glass-panel rounded-[2rem] border border-white/45 px-6 py-6 lg:px-8">
                <SectionHeader
                  kicker="Quote compare"
                  title="Normalize an alternate quote"
                  description="Use the controls below to model the quote a shopper is considering and show exactly where lower price starts cutting into real protection."
                />

                <form className="mt-6 grid gap-4" onSubmit={handleCompareSubmit}>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-slate-200/75 bg-white/80 px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Current policy baseline</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {analysis.carrierName} · {getCoverageValue(analysis, "bodilyInjuryLiability")} BI ·{" "}
                        {getCoverageValue(analysis, "propertyDamageLiability")} PD
                      </p>
                    </div>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-4 py-2 text-sm font-semibold text-[var(--panel)] transition hover:bg-[var(--accent)]/14"
                      type="button"
                      onClick={handleLoadComparisonDemo}
                    >
                      <Sparkles className="h-4 w-4" />
                      Load cheaper demo quote
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField label="Current monthly premium">
                      <input
                        className="field-shell w-full rounded-2xl px-4 py-3 text-slate-900 outline-none"
                        inputMode="decimal"
                        placeholder="118"
                        value={quoteForm.currentMonthlyPremium}
                        onChange={(event) => updateQuoteForm(setQuoteForm, "currentMonthlyPremium", event.target.value)}
                      />
                    </FormField>
                    <FormField label="Alternate carrier">
                      <input
                        className="field-shell w-full rounded-2xl px-4 py-3 text-slate-900 outline-none"
                        placeholder="BudgetSure"
                        value={quoteForm.carrierName}
                        onChange={(event) => updateQuoteForm(setQuoteForm, "carrierName", event.target.value)}
                      />
                    </FormField>
                    <FormField label="Alternate monthly premium">
                      <input
                        className="field-shell w-full rounded-2xl px-4 py-3 text-slate-900 outline-none"
                        inputMode="decimal"
                        placeholder="92"
                        value={quoteForm.monthlyPremium}
                        onChange={(event) => updateQuoteForm(setQuoteForm, "monthlyPremium", event.target.value)}
                      />
                    </FormField>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-200/75 bg-white/82 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Liability limits</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <OptionGroup
                        label="Bodily injury"
                        options={bodilyInjuryOptions}
                        value={quoteForm.bodilyInjuryLimit}
                        onChange={(value) => updateQuoteForm(setQuoteForm, "bodilyInjuryLimit", value)}
                      />
                      <OptionGroup
                        label="Property damage"
                        options={propertyDamageOptions}
                        value={quoteForm.propertyDamageLimit}
                        onChange={(value) => updateQuoteForm(setQuoteForm, "propertyDamageLimit", value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-200/75 bg-white/82 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Deductibles</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <OptionGroup
                        label="Collision"
                        options={deductibleOptions}
                        value={quoteForm.collisionDeductible}
                        onChange={(value) => updateQuoteForm(setQuoteForm, "collisionDeductible", value)}
                      />
                      <OptionGroup
                        label="Comprehensive"
                        options={deductibleOptions}
                        value={quoteForm.comprehensiveDeductible}
                        onChange={(value) => updateQuoteForm(setQuoteForm, "comprehensiveDeductible", value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-200/75 bg-white/82 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Optional protections</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <TogglePill
                      checked={quoteForm.uninsuredMotoristIncluded}
                      icon={<ShieldCheck className="h-4 w-4" />}
                      label="UM/UIM included"
                      onChange={() =>
                        setQuoteForm((current) => ({
                          ...current,
                          uninsuredMotoristIncluded: !current.uninsuredMotoristIncluded,
                        }))
                      }
                    />
                    <TogglePill
                      checked={quoteForm.roadsideIncluded}
                      icon={<LifeBuoy className="h-4 w-4" />}
                      label="Roadside included"
                      onChange={() =>
                        setQuoteForm((current) => ({
                          ...current,
                          roadsideIncluded: !current.roadsideIncluded,
                        }))
                      }
                    />
                    <TogglePill
                      checked={quoteForm.rentalIncluded}
                      icon={<CarFront className="h-4 w-4" />}
                      label="Rental included"
                      onChange={() =>
                        setQuoteForm((current) => ({
                          ...current,
                          rentalIncluded: !current.rentalIncluded,
                        }))
                      }
                    />
                    </div>
                  </div>

                  {comparisonError ? (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {comparisonError}
                    </p>
                  ) : null}

                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[var(--accent)]/45"
                    disabled={isComparing}
                    type="submit"
                  >
                    {isComparing
                      ? "Comparing quotes..."
                      : comparison
                        ? "Refresh coverage tradeoff"
                        : "Compare coverage tradeoffs"}
                    <Scale className="h-4 w-4" />
                  </button>
                </form>
              </div>

              <div
                ref={comparisonOutputRef}
                className={`glass-panel rounded-[2rem] border border-white/45 px-6 py-6 transition duration-500 lg:px-8 ${
                  comparisonPulse
                    ? "ring-2 ring-emerald-300 shadow-[0_0_0_1px_rgba(29,163,111,0.12),0_24px_80px_rgba(12,90,67,0.14)]"
                    : ""
                }`}
              >
                <SectionHeader
                  kicker="Comparison output"
                  title="Current policy vs alternate quote"
                  description="Compare price, protection, and the exact coverage tradeoffs between the two options."
                />

                {comparison ? (
                  <div className="mt-6 space-y-4">
                    <ComparisonSummaryBoard
                      currentLabel={analysis.carrierName}
                      comparisonLabel={quoteForm.carrierName || "Alternate quote"}
                      comparison={comparison}
                      coverageCuts={coverageCuts}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <PolicySideCard
                        badge="Current policy"
                        title={analysis.carrierName}
                        premium={formatMoneyInput(quoteForm.currentMonthlyPremium) || "Add premium"}
                        rows={buildCurrentPolicyRows(analysis)}
                        tone="current"
                      />
                      <PolicySideCard
                        badge="Alternate quote"
                        title={quoteForm.carrierName || "Alternate quote"}
                        premium={formatMoneyInput(quoteForm.monthlyPremium) || "Set premium"}
                        rows={buildQuotePolicyRows(quoteForm)}
                        tone="alternate"
                      />
                    </div>

                    <div className="rounded-[1.6rem] bg-[var(--panel)] px-5 py-5 text-white">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.24em] text-emerald-200/80">Recommendation</p>
                          <p className="mt-3 text-xl font-semibold leading-8">{comparison.finalRecommendation}</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Price delta</p>
                          <p className="mt-2 text-3xl font-semibold">{formatPriceDelta(comparison.priceDelta)}</p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-200">{comparison.summary}</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <MiniOutcome label="Better for savings" value={comparison.betterForSavings} />
                      <MiniOutcome label="Better for protection" value={comparison.betterForProtection} />
                    </div>

                    {coverageCuts.length > 0 ? (
                      <div className="rounded-[1.5rem] border border-[var(--accent)]/22 bg-[var(--accent)]/8 p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                          What the cheaper quote cuts
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {coverageCuts.map((difference) => (
                            <SignalPill key={difference.coverage} tone="warning" text={difference.coverage} />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      {comparison.coverageDifferences.map((difference) => (
                        <div key={difference.coverage} className="rounded-[1.4rem] border border-slate-200/75 bg-white/88 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{difference.coverage}</p>
                              <p className="mt-2 text-sm text-slate-600">
                                Current: <span className="font-semibold text-slate-900">{difference.currentValue}</span>
                                {"  "}
                                Alternate: <span className="font-semibold text-slate-900">{difference.comparisonValue}</span>
                              </p>
                            </div>
                            <ImpactBadge impact={difference.impact} />
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600">{difference.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <PolicySideCard
                        badge="Current policy"
                        title={analysis.carrierName}
                        premium={formatMoneyInput(quoteForm.currentMonthlyPremium) || "Add premium"}
                        rows={buildCurrentPolicyRows(analysis)}
                        tone="current"
                      />
                      <PolicySideCard
                        badge="Alternate quote"
                        title={quoteForm.carrierName || "Alternate quote"}
                        premium={formatMoneyInput(quoteForm.monthlyPremium) || "Set premium"}
                        rows={buildQuotePolicyRows(quoteForm)}
                        tone="alternate"
                      />
                    </div>

                    <div className="rounded-[1.8rem] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--panel)]/8 text-[var(--panel)]">
                        <Scale className="h-6 w-6" />
                      </div>
                      <p className="mt-5 text-lg font-semibold text-slate-900">Run the comparison to expose the tradeoff</p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        Once you compare, this panel will call out what gets better, what gets worse, and whether the
                        cheaper quote is truly worth it.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {!isDemoMode ? (
              <section className="reveal reveal-delay-3 glass-panel rounded-[2rem] border border-white/45 px-6 py-6 lg:px-8">
                <SectionHeader
                  kicker="Explain like I’m new to insurance"
                  title="Built-in terminology translator"
                  description="Every key concept gets a plain-English explanation so the product feels educational instead of intimidating."
                />
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {glossaryCards.map((item) => (
                    <article key={item.label} className="rounded-[1.4rem] border border-slate-200/75 bg-white/88 p-5">
                      <p className="text-lg font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{item.plainEnglishExplanation}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

      </div>
    </main>
  );
}
function buildQuoteFormFromAnalysis(analysis: PolicyAnalysis): QuoteFormState {
  return {
    ...emptyQuoteForm,
    currentMonthlyPremium: analysis.currentMonthlyPremium ? String(analysis.currentMonthlyPremium) : "",
    bodilyInjuryLimit: normalizeBodilyInjury(getCoverageValue(analysis, "bodilyInjuryLiability")),
    propertyDamageLimit: normalizeDollarOption(
      getCoverageValue(analysis, "propertyDamageLiability"),
      propertyDamageOptions,
      "$50,000",
    ),
    collisionDeductible: normalizeDollarOption(
      getCoverageValue(analysis, "collision"),
      deductibleOptions,
      "$1,000",
    ),
    comprehensiveDeductible: normalizeDollarOption(
      getCoverageValue(analysis, "comprehensive"),
      deductibleOptions,
      "$500",
    ),
    uninsuredMotoristIncluded: coverageEnabled(analysis, "uninsuredMotorist"),
    roadsideIncluded: coverageEnabled(analysis, "roadsideAssistance"),
    rentalIncluded: coverageEnabled(analysis, "rentalReimbursement"),
  };
}

function getCoverageValue(analysis: PolicyAnalysis, type: CoverageType) {
  return analysis.coverages.find((coverage) => coverage.type === type)?.limitOrDeductible ?? "";
}

function coverageEnabled(analysis: PolicyAnalysis, type: CoverageType) {
  const coverage = analysis.coverages.find((item) => item.type === type);
  return coverage ? coverage.status !== "missing" && coverage.status !== "unknown" : false;
}

function normalizeBodilyInjury(value: string) {
  const amounts = extractAmounts(value);

  if (amounts.length < 2) {
    return "50/100";
  }

  const normalized = `${toThousands(amounts[0])}/${toThousands(amounts[1])}`;
  return bodilyInjuryOptions.includes(normalized) ? normalized : "50/100";
}

function normalizeDollarOption(value: string, options: string[], fallback: string) {
  if (value.toLowerCase().includes("not included")) {
    return options.includes("Not included") ? "Not included" : fallback;
  }

  const [amount] = extractAmounts(value);
  if (!amount) {
    return fallback;
  }

  const normalized = currencyFormatter.format(amount);
  return options.includes(normalized) ? normalized : fallback;
}

function extractAmounts(value: string) {
  return [...value.matchAll(/\d[\d,]*/g)]
    .map((match) => Number.parseInt(match[0].replace(/,/g, ""), 10))
    .filter((amount) => Number.isFinite(amount))
    .map((amount) => (amount <= 999 ? amount * 1000 : amount));
}

function toThousands(amount: number) {
  return Math.round(amount / 1000);
}

function buildGlossaryCards(analysis: PolicyAnalysis | null) {
  const types = analysis
    ? Array.from(new Set(analysis.coverages.map((coverage) => coverage.type)))
    : ([
        "bodilyInjuryLiability",
        "uninsuredMotorist",
        "collision",
        "rentalReimbursement",
      ] as CoverageType[]);

  return types.slice(0, 4).map((type) => insuranceGlossary[type]);
}

function buildCurrentPolicyRows(analysis: PolicyAnalysis) {
  return [
    {
      label: "Bodily injury",
      value: getCoverageValue(analysis, "bodilyInjuryLiability") || "Unknown",
    },
    {
      label: "Property damage",
      value: getCoverageValue(analysis, "propertyDamageLiability") || "Unknown",
    },
    {
      label: "Collision",
      value: getCoverageValue(analysis, "collision") || "Unknown",
    },
    {
      label: "Rental",
      value: coverageEnabled(analysis, "rentalReimbursement") ? "Included" : "Missing",
    },
  ];
}

function buildQuotePolicyRows(quoteForm: QuoteFormState) {
  return [
    {
      label: "Bodily injury",
      value: quoteForm.bodilyInjuryLimit,
    },
    {
      label: "Property damage",
      value: quoteForm.propertyDamageLimit,
    },
    {
      label: "Collision",
      value: quoteForm.collisionDeductible,
    },
    {
      label: "Rental",
      value: quoteForm.rentalIncluded ? "Included" : "Missing",
    },
  ];
}

function vehicleLabel(vehicle: PolicyAnalysis["vehicles"][number]) {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

function formatPriceDelta(priceDelta: number) {
  if (priceDelta === 0) {
    return "$0";
  }

  return priceDelta < 0
    ? `-${currencyFormatter.format(Math.abs(priceDelta))}`
    : `+${currencyFormatter.format(priceDelta)}`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  return Number.parseFloat(normalized);
}

function formatMoneyInput(value: string) {
  const numeric = parseMoneyInput(value);

  if (!Number.isFinite(numeric)) {
    return "";
  }

  return currencyFormatter.format(numeric);
}

function formatProtectionGap(scoreDelta: number) {
  if (scoreDelta === 0) {
    return "Even overall protection";
  }

  const absoluteDelta = Math.abs(scoreDelta);
  return `${absoluteDelta} point${absoluteDelta === 1 ? "" : "s"} ${
    scoreDelta > 0 ? "stronger" : "weaker"
  }`;
}

function updateQuoteForm(
  setQuoteForm: React.Dispatch<React.SetStateAction<QuoteFormState>>,
  key: keyof QuoteFormState,
  value: string,
) {
  setQuoteForm((current) => ({
    ...current,
    [key]: value,
  }));
}

function HeroMetric({
  icon,
  title,
  stat,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  stat: string;
  description: string;
}) {
  return (
    <div className="glass-panel rounded-[1.8rem] border border-white/45 p-5 transition hover:-translate-y-0.5">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--panel)] text-[var(--sun)]">
        {icon}
      </div>
      <p className="text-lg font-semibold text-slate-950">{title}</p>
      <p className="mt-3 text-2xl font-semibold leading-tight text-[var(--panel)]">{stat}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function SignalPill({
  text,
  tone,
}: {
  text: string;
  tone: "warning" | "neutral";
}) {
  const styles =
    tone === "warning"
      ? "border-[var(--accent)]/25 bg-[var(--accent)]/8 text-slate-800"
      : "border-white/55 bg-white/78 text-slate-700";

  return (
    <div className={`rounded-full border px-4 py-2 text-sm font-medium shadow-[0_12px_34px_rgba(12,90,67,0.05)] ${styles}`}>
      {text}
    </div>
  );
}

function PreviewTab({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        active ? "bg-[var(--panel)] text-white" : "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

function PreviewDelta({
  label,
  current,
  next,
}: {
  label: string;
  current: string;
  next: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.1rem] bg-white/85 px-3 py-3 text-sm">
      <div>
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-slate-500">{current}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
      <p className="font-semibold text-[var(--accent)]">{next}</p>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] border border-slate-200/75 bg-white/88 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DemoBeat({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200/70 bg-white/78 px-4 py-4 shadow-[0_12px_34px_rgba(12,90,67,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{step}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
    </div>
  );
}

function ProtectionMeterCard({
  currentLabel,
  comparisonLabel,
  currentScore,
  comparisonScore,
}: {
  currentLabel: string;
  comparisonLabel: string;
  currentScore: number;
  comparisonScore: number;
}) {
  const scoreDelta = currentScore - comparisonScore;

  return (
    <div className="meter-stage grid gap-6 xl:grid-cols-[280px_1fr] xl:items-center">
      <div className="rounded-[1.7rem] border border-[var(--panel)]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,248,241,0.94))] p-5 shadow-[0_24px_70px_rgba(12,90,67,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Protection score</p>
          <span className="rounded-full bg-[var(--accent)]/12 px-3 py-1 text-xs font-semibold text-[var(--panel)]">
            {formatProtectionGap(scoreDelta)}
          </span>
        </div>

        <div className="mt-6 space-y-5">
          <ProtectionBarRow label={currentLabel} score={currentScore} tone="current" />
          <ProtectionBarRow label={comparisonLabel} score={comparisonScore} tone="comparison" />
        </div>

        <div className="mt-6 flex items-center justify-between text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[1.4rem] border border-slate-200/75 bg-white/92 p-4 shadow-[0_16px_40px_rgba(12,90,67,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-[var(--panel)]" />
              <span className="text-sm font-semibold text-slate-900">{currentLabel}</span>
            </div>
            <span className="text-2xl font-semibold text-slate-950">{currentScore}</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-[var(--panel)]/10">
            <div
              className="h-full rounded-full bg-[var(--panel)]"
              style={{ width: `${Math.max(8, Math.min(100, currentScore))}%` }}
            />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Stronger overall protection because liability is higher and rental coverage is still included.
          </p>
        </div>

        <div className="rounded-[1.4rem] border border-slate-200/75 bg-white/92 p-4 shadow-[0_16px_40px_rgba(12,90,67,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-[var(--accent)]" />
              <span className="text-sm font-semibold text-slate-900">{comparisonLabel}</span>
            </div>
            <span className="text-2xl font-semibold text-slate-950">{comparisonScore}</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-[var(--accent)]/12">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${Math.max(8, Math.min(100, comparisonScore))}%` }}
            />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Lower price, but weaker overall protection once you normalize deductibles, liability, and optional coverage.
          </p>
        </div>

        <div className="rounded-[1.4rem] border border-[var(--accent)]/24 bg-[var(--accent)]/8 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Protection takeaway</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            This chart makes the coverage gap easy to read before price becomes the only thing driving the decision.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProtectionBarRow({
  label,
  score,
  tone,
}: {
  label: string;
  score: number;
  tone: "current" | "comparison";
}) {
  const fillClass = tone === "current" ? "bg-[var(--panel)]" : "bg-[var(--accent)]";
  const badgeClass =
    tone === "current"
      ? "bg-[var(--panel)] text-white"
      : "bg-[var(--accent)]/12 text-[var(--panel)]";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{label}</span>
        <span className="text-3xl font-semibold leading-none text-slate-950">{score}</span>
      </div>
      <div className="relative h-4 overflow-hidden rounded-full bg-[var(--panel)]/8">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${fillClass}`}
          style={{ width: `${Math.max(6, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}

function ComparisonSummaryBoard({
  currentLabel,
  comparisonLabel,
  comparison,
  coverageCuts,
}: {
  currentLabel: string;
  comparisonLabel: string;
  comparison: QuoteComparison;
  coverageCuts: Array<QuoteComparison["coverageDifferences"][number]>;
}) {
  const priceDeltaLabel = formatPriceDelta(comparison.priceDelta);
  const protectionGap = comparison.currentProtectionScore - comparison.comparisonProtectionScore;
  const executiveHeadline =
    comparison.priceDelta < 0
      ? `${comparisonLabel} saves ${currencyFormatter.format(Math.abs(comparison.priceDelta))}/mo, but ${currentLabel} stays meaningfully better protected.`
      : comparison.priceDelta > 0
        ? `${comparisonLabel} costs more and still does not beat ${currentLabel} on protection.`
        : `${currentLabel} and ${comparisonLabel} land at the same monthly price, so coverage decides the better option.`;
  const priceDeltaBody =
    comparison.priceDelta < 0
      ? `${comparisonLabel} is cheaper each month.`
      : comparison.priceDelta > 0
        ? `${comparisonLabel} costs more each month.`
        : "Both options are priced the same.";

  return (
    <div className="rounded-[1.75rem] border border-[var(--panel)]/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(232,248,238,0.94))] p-5 shadow-[0_20px_60px_rgba(12,90,67,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">At a glance</p>
          <p className="mt-3 text-2xl font-semibold leading-9 text-slate-950">{executiveHeadline}</p>
          <p className="mt-3 text-sm leading-6 text-slate-700">{comparison.summary}</p>
        </div>
        <div className="min-w-[172px] rounded-[1.4rem] bg-[var(--panel)] px-4 py-4 text-right text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
            Protection winner
          </p>
          <p className="mt-3 text-2xl font-semibold">{comparison.betterForProtection}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <PitchMetric
          label="Price delta"
          value={priceDeltaLabel}
          body={priceDeltaBody}
        />
        <PitchMetric
          label="Protection gap"
          value={formatProtectionGap(protectionGap)}
          body={`${currentLabel} stays ahead once limits, deductibles, and add-ons are normalized.`}
        />
        <PitchMetric
          label="Coverage cuts"
          value={String(coverageCuts.length)}
          body={
            coverageCuts.length > 0
              ? coverageCuts.slice(0, 2).map((cut) => cut.coverage).join(" and ")
              : "No material cuts surfaced"
          }
        />
      </div>
    </div>
  );
}

function PitchMetric({
  label,
  value,
  body,
}: {
  label: string;
  value: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200/75 bg-white/92 p-4 shadow-[0_16px_40px_rgba(12,90,67,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold leading-none text-slate-950">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function SectionHeader({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{kicker}</p>
      <h3 className="display-type mt-2 text-3xl text-slate-950">{title}</h3>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function AnalysisStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-300">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ScoreCard({
  icon,
  label,
  value,
  body,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  body: string;
}) {
  return (
    <article className="glass-panel rounded-[1.6rem] border border-white/45 p-5">
      <div className="flex items-center gap-3 text-[var(--panel)]">
        <div className="rounded-2xl bg-white p-2 shadow-[0_10px_24px_rgba(12,90,67,0.08)]">{icon}</div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      </div>
      <p className="mt-5 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </article>
  );
}
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function OptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option === value;

          return (
            <button
              key={option}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-[var(--panel)] bg-[var(--panel)] text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[var(--accent)]/35 hover:bg-white"
              }`}
              type="button"
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PolicySideCard({
  badge,
  title,
  premium,
  rows,
  tone,
}: {
  badge: string;
  title: string;
  premium: string;
  rows: Array<{ label: string; value: string }>;
  tone: "current" | "alternate";
}) {
  const toneStyles =
    tone === "current"
      ? "border-[var(--panel)]/14 bg-[var(--panel)] text-white"
      : "border-[var(--accent)]/22 bg-[var(--accent)]/8 text-slate-900";
  const mutedText = tone === "current" ? "text-slate-200" : "text-slate-600";
  const divider = tone === "current" ? "border-white/10" : "border-slate-200/75";

  return (
    <div className={`rounded-[1.6rem] border p-5 ${toneStyles}`}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${mutedText}`}>{badge}</p>
          <p className="mt-2 break-words text-2xl font-semibold">{title}</p>
        </div>
        <div
          className={`w-full rounded-[1.35rem] px-4 py-3 sm:w-[160px] ${
            tone === "current" ? "bg-white/10" : "bg-white/82"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-[0.26em] ${mutedText}`}>Monthly</p>
          <p className="mt-2 text-3xl font-semibold leading-none">{premium}</p>
        </div>
      </div>

      <div className={`mt-5 space-y-3 border-t pt-4 ${divider}`}>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
            <span className={mutedText}>{row.label}</span>
            <span className="text-right font-semibold">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TogglePill({
  checked,
  icon,
  label,
  onChange,
}: {
  checked: boolean;
  icon: React.ReactNode;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      className={`flex items-center justify-between rounded-[1.4rem] border px-4 py-3 text-left transition ${
        checked
          ? "border-[var(--accent)] bg-[var(--accent)]/8 text-slate-900"
          : "border-slate-200 bg-white/80 text-slate-600"
      }`}
      type="button"
      onClick={onChange}
    >
      <span className="flex items-center gap-3">
        <span className="text-[var(--panel)]">{icon}</span>
        <span className="font-medium">{label}</span>
      </span>
      <span
        className={`h-3 w-3 rounded-full ${checked ? "bg-[var(--accent)]" : "bg-slate-300"}`}
      />
    </button>
  );
}

function StatusBadge({ status }: { status: CoverageStatus }) {
  const tone = {
    included: "bg-emerald-100 text-emerald-800",
    limited: "bg-amber-100 text-amber-800",
    missing: "bg-rose-100 text-rose-700",
    optional: "bg-sky-100 text-sky-700",
    unknown: "bg-slate-200 text-slate-700",
  }[status];

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{titleCase(status)}</span>;
}

function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const tone = {
    high: "bg-rose-100 text-rose-700",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-sky-100 text-sky-700",
  }[severity];

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{titleCase(severity)}</span>;
}

function MiniOutcome({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200/75 bg-white/88 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ImpactBadge({ impact }: { impact: "better" | "worse" | "same" }) {
  const tone = {
    better: "bg-emerald-100 text-emerald-800",
    worse: "bg-rose-100 text-rose-700",
    same: "bg-slate-200 text-slate-700",
  }[impact];

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{titleCase(impact)}</span>;
}



