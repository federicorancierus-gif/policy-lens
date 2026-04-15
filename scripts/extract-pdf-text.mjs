import { readFile } from "node:fs/promises";

import { PDFParse } from "pdf-parse";

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    throw new Error("A PDF file path is required for text extraction.");
  }

  const pdfBuffer = await readFile(pdfPath);
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getText();
    const text = normalizePdfText(result.text ?? "");
    process.stdout.write(JSON.stringify({ text }));
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function normalizePdfText(text) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PDF text helper failed.");
  process.exit(1);
});
