import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

const MIN_TEXT_LENGTH_FOR_DIRECT_PARSE = 160;
const OCR_HELPER_TIMEOUT_MS = 120_000;
const OCR_HELPER_PATH = path.join(process.cwd(), "scripts", "extract-ocr-text.mjs");

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
    const child = spawn(process.execPath, [OCR_HELPER_PATH, pdfPath], {
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
