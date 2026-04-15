import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

const PDF_TEXT_HELPER_TIMEOUT_MS = 45_000;

export async function extractSearchablePdfText(pdfBuffer: Buffer) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "policy-lens-pdf-"));
  const pdfPath = path.join(tempDir, "input.pdf");

  await writeFile(pdfPath, pdfBuffer);

  try {
    return await runPdfTextHelper(pdfPath);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function runPdfTextHelper(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const helperPath = path.join(process.cwd(), "scripts", "extract-pdf-text.mjs");
    const child = spawn(process.execPath, [helperPath, pdfPath], {
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
      reject(new Error("Searchable PDF extraction timed out."));
    }, PDF_TEXT_HELPER_TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(stderr.trim() || `PDF text helper exited with code ${code}.`));
        return;
      }

      try {
        const payload = JSON.parse(stdout) as { text?: string };
        resolve(payload.text?.trim() ?? "");
      } catch {
        reject(new Error("PDF text helper returned an unreadable response."));
      }
    });
  });
}
