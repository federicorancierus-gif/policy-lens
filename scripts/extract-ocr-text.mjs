import { readFile } from "node:fs/promises";

import { pdf } from "pdf-to-img";
import { createWorker, OEM, PSM } from "tesseract.js";

const MAX_OCR_PAGES = 3;
const OCR_SCALE = 2.2;

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    throw new Error("A PDF file path is required for OCR.");
  }

  const pdfBuffer = await readFile(pdfPath);
  const document = await pdf(pdfBuffer, { scale: OCR_SCALE });
  const worker = await createWorker("eng", OEM.LSTM_ONLY);
  const pages = [];
  let processedPages = 0;

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
    });

    for await (const image of document) {
      processedPages += 1;

      const result = await worker.recognize(
        image,
        {
          rotateAuto: true,
        },
        {
          text: true,
        },
      );

      const pageText = normalizeOcrText(result.data.text);
      if (pageText) {
        pages.push(pageText);
      }

      if (processedPages >= MAX_OCR_PAGES) {
        break;
      }
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }

  process.stdout.write(
    JSON.stringify({
      processedPages,
      text: pages.join("\n\n"),
    }),
  );
}

function normalizeOcrText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "OCR helper failed.");
  process.exit(1);
});
