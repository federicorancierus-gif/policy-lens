import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

const MIN_TEXT_LENGTH_FOR_DIRECT_PARSE = 160;
const OCR_HELPER_TIMEOUT_MS = 120_000;
const OCR_HELPER_SOURCE = String.raw`
(async () => {
  require("regenerator-runtime/runtime");
  const os = require("node:os");
  const path = require("node:path");
  const { mkdir, readFile } = require("node:fs/promises");
  const { pdf } = await import("pdf-to-img");
  const { createWorker, OEM, PSM } = await import("tesseract.js");

  const pdfPath = process.argv[1];
  const cachePath = path.join(os.tmpdir(), "policy-lens-tesseract-cache");
  await mkdir(cachePath, { recursive: true });

  const pdfBuffer = await readFile(pdfPath);
  const document = await pdf(pdfBuffer, { scale: 2.2 });
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    cachePath,
  });

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
        { rotateAuto: true },
        { text: true },
      );

      const pageText = result.data.text
        .replace(/\r/g, "\n")
        .replace(/[^\S\r\n]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (pageText) {
        pages.push(pageText);
      }

      if (processedPages >= 3) {
        break;
      }
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }

  process.stdout.write(JSON.stringify({
    processedPages,
    text: pages.join("\n\n"),
  }));
})().catch((error) => {
  console.error(error instanceof Error ? error.message : "OCR helper failed.");
  process.exit(1);
});
`;

type OcrResult = {
  processedPages: number;
  text: string;
};

export function shouldUseOcrFallback(text: string) {
  return text.trim().length < MIN_TEXT_LENGTH_FOR_DIRECT_PARSE;
}

export async function extractPdfTextWithOcr(pdfBuffer: Buffer): Promise<OcrResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "policy-lens-ocr-"));
  const pdfPath = path.join(tempDir, "input.pdf");

  await writeFile(pdfPath, pdfBuffer);

  try {
    return await runOcrHelper(pdfPath);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function runOcrHelper(pdfPath: string): Promise<OcrResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", OCR_HELPER_SOURCE, pdfPath], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("OCR timed out before the scanned PDF could be read."));
    }, OCR_HELPER_TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(stderr.trim() || `OCR helper exited with code ${code}.`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as OcrResult);
      } catch {
        reject(new Error("OCR helper returned an unreadable response."));
      }
    });
  });
}
