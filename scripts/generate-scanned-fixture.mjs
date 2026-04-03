import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pngPath = path.join(root, "public", "sample-scanned-policy.png");
const pdfPath = path.join(root, "public", "sample-scanned-policy.pdf");

async function main() {
  const pngBytes = await readFile(pngPath);
  const pdf = await PDFDocument.create();
  const embeddedImage = await pdf.embedPng(pngBytes);
  const { width, height } = embeddedImage.scale(1);
  const page = pdf.addPage([width, height]);

  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width,
    height,
  });

  const pdfBytes = await pdf.save();
  await writeFile(pdfPath, pdfBytes);

  console.log(`Generated ${path.relative(root, pdfPath)}`);
}

main().catch((error) => {
  console.error("Unable to generate the scanned OCR fixture PDF.");
  console.error(error);
  process.exit(1);
});
