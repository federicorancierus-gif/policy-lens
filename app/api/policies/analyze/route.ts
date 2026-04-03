import { PDFParse } from "pdf-parse";

import { analyzePolicyDocument } from "@/lib/insurance-engine";

export const runtime = "nodejs";

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

  let text = "";
  let parseIssue: string | undefined;
  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
    const result = await parser.getText();
    text = result.text ?? "";
  } catch {
    parseIssue =
      "The PDF parser could not fully read this file, so the app is falling back to a conservative low-confidence summary.";
  } finally {
    if (parser) {
      await parser.destroy().catch(() => undefined);
    }
  }

  const analysis = analyzePolicyDocument({
    fileName: file.name,
    text,
    parseIssue,
  });

  return Response.json(analysis);
}
