# Policy Lens

Policy Lens is a Next.js app that turns a confusing auto policy PDF into a plain-English coverage review.

Upload an auto policy PDF and the app will:
- translate coverages into plain English
- flag likely gaps like low liability, missing roadside, or no rental reimbursement
- compare an alternate quote against the current policy on an apples-to-apples basis

## Stack
- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- `pdf-parse` for searchable PDF text extraction
- deterministic insurance logic for gap flags and quote comparison

## What is implemented
- `POST /api/policies/analyze`
  - accepts a policy PDF upload
  - validates file type and size for the prototype
  - extracts searchable text
  - normalizes coverages, deductibles, exclusions, vehicles, and policy period
  - produces confidence labels, a protection score, and gap flags
- `POST /api/quotes/compare`
  - compares a normalized current policy against a manually entered alternate quote
  - returns price delta, coverage differences, and a final recommendation
- polished frontend with:
  - upload flow
  - sample policy fallback
  - coverage cards
  - risk flags
  - exclusions and extraction notes
  - quote comparison workspace
  - insurance glossary cards

## Run locally
```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Notes
- This is an educational prototype, not legal or underwriting advice.
- The app works best with text-searchable PDFs.
- If a PDF is image-based or messy, the app falls back to a lower-confidence summary.
- The repo includes a realistic sample scenario so you can try the full experience without a live customer policy.

## Validation
```bash
npm run lint
npm run build
```
