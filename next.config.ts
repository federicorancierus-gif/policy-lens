import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/policies/analyze": [
      "./scripts/extract-pdf-text.mjs",
      "./scripts/extract-ocr-text.mjs",
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdf-to-img/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@napi-rs/**/*",
      "./node_modules/regenerator-runtime/**/*",
    ],
  },
};

export default nextConfig;
