# Certificate Generator

A client-side web app for designing certificate templates and generating personalized certificates in bulk (PDF). Built with React + Vite + Fabric.js. All data stays in the browser (IndexedDB) — no server or database required.

## Features

- **Template editor** — a Fabric.js canvas where you design a certificate by adding text, paragraphs, variables and images (logos / signatures / background).
  - Every template holds **two designs**: an **Organiser** certificate and a **Volunteer** certificate, switchable via tabs in the editor toolbar.
  - Placeholders like `{{recipient_name}}` are shown in **bold** in the editor so they are easy to spot.
- **Mass Producer** — a 6-step wizard:
  1. Pick a template
  2. Fill common event details (`college_name`, `event_name`, `date`, `state`, `committee_name`)
  3. Upload an Excel/CSV recipient list (columns are auto-matched to placeholders) or add rows manually. Each row has an **Organiser?** checkbox — ticked rows get the Organiser design, unticked rows get the Volunteer design (an optional `Certificate Type` column in the file is also respected).
  4. Validate data (missing values, invalid certificate types, duplicate names)
  5. Preview certificates
  6. Generate with live progress and abort support
- **Generation output** — certificates render at full template resolution (300 DPI PDF):
  - Download each certificate as its own PDF
  - **Download All (PDF)** — all certificates merged into a single PDF, named after the event's college name (e.g. `GMC_Alibag.pdf`)
  - **Download All (ZIP)** — one PDF per recipient in a zip archive
- **Generated Certificates** — history of generated batches with preview, re-download, and delete.
- **Assets** — upload and manage logos and signatures for use in templates.

## Tech Stack

- React 18 + Vite 5
- Fabric.js v6 (canvas editing & rendering)
- pdf-lib (PDF generation / merging)
- JSZip (zip archives)
- xlsx (Excel/CSV parsing)
- IndexedDB (browser storage)

## Getting Started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
```

Production build:

```bash
npm run build    # outputs to dist/
npm run preview  # serve the production build
```

## Project Structure

```
src/
├── pages/                  # App pages (Templates, TemplateEditor, MassProducer, GeneratedCertificates, Assets)
├── components/
│   ├── common/             # Reusable UI (Modal, TemplateThumb, Sidebar)
│   ├── template-editor/    # Canvas editor, toolbar, properties panel, add-field modal
│   └── mass-producer/      # Template selector, recipient grid, generation progress
├── services/
│   ├── certificateGenerator.js  # Rendering, PDF conversion, batch generation, zip + merged PDF
│   ├── templateService.js       # Template CRUD + design normalization
│   ├── batchService.js          # Batch history persistence
│   ├── assetService.js          # Asset persistence
│   └── seedService.js           # Example template seeding
├── utils/
│   ├── templateDesigns.js       # Organiser/Volunteer design model helpers
│   ├── validation.js            # Template & recipient-data validation
│   ├── excelParser.js           # Excel/CSV file parsing
│   └── placeholderParser.js     # {{variable}} replacement
├── constants/config.js          # Common variables, default canvas, dimensions
├── db/database.js               # IndexedDB wrapper
└── styles/global.css            # Global styles / theme
```

## How the Design Model Works

Each template stores `designs.organizer` and `designs.volunteer`, each `{ elements, background, backgroundFit }`. A recipient row's certificate type (`Organiser`/`Volunteer`, from the checkbox or file column) selects which design is used when rendering. Legacy templates (created before designs existed) are migrated automatically on read.

## Recipient File Format

- Supports `.csv`, `.xlsx`, `.xls`.
- Headers are matched to placeholders automatically (e.g. `Recipient Name` → `{{recipient_name}}`).
- Optional `Certificate Type` column: values `Volunteer` / `Organiser` (case-insensitive). Missing values default to Volunteer.
- A blank value in any required placeholder flags the row during validation.

## Testing

An end-to-end smoke test drives the app with Puppeteer:

```bash
npm run dev        # in one terminal
node scripts/smoke.mjs
```

It wipes IndexedDB, seeds the example template, switches design tabs, generates a batch (including toggling the Organiser checkbox) and verifies the ZIP and college-named merged PDF downloads.

## Notes

- Template dimensions are fixed per the editor (A4 landscape 3508 × 2480 @ 300 DPI, in `src/constants/config.js`).
- Fonts (Garet, Droid Serif) are declared with `@font-face` in `src/styles/global.css`, referencing files under `/public/fonts` (drop the woff2/ttf files there). If absent, the browser falls back to Arial/Georgia.
- All data is stored locally in the browser's IndexedDB (`certgen-db`).
