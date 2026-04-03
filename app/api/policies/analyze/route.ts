import { PDFParse } from "pdf-parse";

import { analyzePolicyDocument } from "@/lib/insurance-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Upload a PDF policy document first." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "Only PDF uploads are supported in this MVP." }, { status: 400 });
  }

  let text = "";
  let parseIssue: string | undefined;

  try {
    const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
    const result = await parser.getText();
    await parser.destroy();
    text = result.text ?? "";
  } catch {
    parseIssue =
      "The PDF parser could not fully read this file, so the app is falling back to a conservative low-confidence summary.";
  }

  const analysis = analyzePolicyDocument({
    fileName: file.name,
    text,
    parseIssue,
  });

  return Response.json(analysis);
}

