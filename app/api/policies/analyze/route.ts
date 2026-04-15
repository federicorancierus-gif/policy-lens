import { analyzePolicyDocument } from "@/lib/insurance-engine";
import { enhancePolicyAnalysisWithLlm, isOpenAiPolicyEnhancementEnabled } from "@/lib/openai-policy";
import {
  buildUnsupportedPolicyMessage,
  detectPolicyDocumentType,
} from "@/lib/policy-document";
import { extractPdfTextWithOcr, shouldUseOcrFallback } from "@/lib/ocr";
import { extractSearchablePdfText } from "@/lib/pdf-text";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "The upload could not be read. Try selecting the PDF again." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Upload a PDF policy document first." }, { status: 400 });
  }

  const looksLikePdf =
    file.name.toLowerCase().endsWith(".pdf") ||
    file.type === "application/pdf" ||
    file.type === "application/x-pdf";

  if (!looksLikePdf) {
    return Response.json({ error: "Only PDF uploads are supported in this MVP." }, { status: 400 });
  }

  if (file.size === 0) {
    return Response.json(
      { error: "That PDF looks empty. Try another file or use the sample policy." },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: "That PDF is too large for this prototype. Try a file under 8 MB." },
      { status: 413 },
    );
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let text = "";
    let parseIssue: string | undefined;
    let ocrPages = 0;
    let usedOcr = false;

    try {
      text = await extractSearchablePdfText(fileBuffer);
    } catch {
      parseIssue =
        "The PDF parser could not fully read this file, so the app is falling back to a conservative low-confidence summary.";
    }

    if (shouldUseOcrFallback(text)) {
      try {
        const ocrResult = await extractPdfTextWithOcr(fileBuffer);

        if (ocrResult.text.trim()) {
          text = [text.trim(), ocrResult.text].filter(Boolean).join("\n\n");
          ocrPages = ocrResult.processedPages;
          usedOcr = true;
          parseIssue = undefined;
        }
      } catch (error) {
        console.error("OCR fallback failed", error);

        if (!text.trim()) {
          parseIssue =
            "This PDF appears to be scanned or image-based, and OCR could not recover enough text to summarize it confidently.";
        }
      }
    }

    const documentType = detectPolicyDocumentType(text, file.name);

    if (documentType !== "auto" && documentType !== "unknown") {
      return Response.json(
        {
          error: buildUnsupportedPolicyMessage(documentType),
        },
        { status: 422 },
      );
    }

    const analysis = analyzePolicyDocument({
      fileName: file.name,
      text,
      parseIssue,
    });

    if (isOpenAiPolicyEnhancementEnabled()) {
      try {
        const llmResult = await enhancePolicyAnalysisWithLlm({
          fileName: file.name,
          text,
          analysis,
        });

        if (llmResult.documentType === "homeowners" || llmResult.documentType === "other") {
          return Response.json(
            {
              error: buildUnsupportedPolicyMessage(
                llmResult.documentType === "homeowners" ? "homeowners" : "unknown",
              ),
            },
            { status: 422 },
          );
        }

        Object.assign(analysis, llmResult.analysis);
      } catch (error) {
        console.error("LLM enrichment failed", error);
        analysis.extractionNotes.push(
          "LLM enrichment was unavailable for this upload, so the app used the deterministic parser only.",
        );
      }
    }

    if (usedOcr) {
      analysis.extractionNotes.unshift(
        `OCR reviewed ${ocrPages} page${ocrPages === 1 ? "" : "s"} because the PDF looked scanned or lightly searchable.`,
      );

      if (analysis.confidence === "high") {
        analysis.confidence = "medium";
      }
    }

    return Response.json(analysis);
  } catch (error) {
    console.error("Policy analysis failed", error);

    return Response.json(
      {
        error:
          "The policy could not be analyzed right now. Please try again in a moment.",
      },
      { status: 500 },
    );
  }
}
