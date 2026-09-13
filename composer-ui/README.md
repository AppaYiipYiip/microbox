# composer-ui — pipeline composer prototype

**Status: prototype/research artifact, not connected to the real pipeline.** Built 2026-09-13 to answer
`docs/planning/PLAN.md` §6.16's requirements list with a real, working proof of concept — not a mockup, but
also not yet wired to `bin/run.sh`/Nextflow execution (that's the FastAPI/`-with-weblog` backend described in
§6.12, a separate, not-yet-built piece). This is a **separate React application** from the existing
Streamlit thin launcher (`ui/`) — the two are unrelated and both currently exist; see `docs/planning/PLAN.md`
§6.10 for why (Streamlit's server-rendered model is a poor fit for a Figma-like drag/connect canvas).

## What's actually built and verified

- A categorized, draggable node palette (`src/components/NodePalette.tsx`) listing this pipeline's real
  tools (`src/data/toolCatalog.ts` mirrors `workflows/microbox.nf`'s actual stages — fastp, FastQC, Bowtie2,
  MEGAHIT, metaSPAdes, Kraken2, Bracken, QUAST, geNomad, CheckV, MaxBin2, MultiQC — not invented examples).
- A React Flow canvas (`src/components/PipelineCanvas.tsx`) — drag a tool from the palette, drop it on the
  canvas, connect nodes, click to select (shows a detail panel), hover for a tooltip.
- Multi-page navigation (`src/App.tsx`, React Router v8) — a Composer page and a placeholder History page,
  with a persistent nav bar.
- Live French/English switching (`src/i18n/`, react-i18next) — every piece of UI chrome and every node
  label/description is translated, verified live (not just written) to actually re-render when the language
  toggle is clicked, including already-placed canvas nodes.

**Verified for real, not just written and assumed to work:**
- Manual browser testing (`claude-in-chrome`) against the actual running dev server: drag-and-drop node
  creation, click-to-select with the detail panel, the FR/EN toggle re-rendering live UI text including a
  node already on the canvas, and real client-side navigation to `/history` (URL genuinely changes).
- `npm test` (Vitest + React Testing Library, 13 tests) — i18n key-structure parity between `en.json`/
  `fr.json` (catches translation drift, not just "does it render"), every catalog tool resolves to real
  translated text in both locales, the language toggle actually switches rendered text (not just a visual
  state), and route navigation actually swaps the rendered page.
- `npm run build` — a real production build succeeds.
- `npx tsc -b` and `npm run lint` (oxlint) both clean.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest
npm run build    # production build to dist/
npm run lint     # oxlint
```

Needs Node.js 24 LTS (installed via NodeSource's apt repo — see `bin/setup-dev.sh` if that step gets added
there later; not yet included since this is still a prototype, not part of the standard dev setup).

## What this deliberately does NOT do yet

- **Does not run the pipeline.** There's no backend here at all — no FastAPI server, no `-with-weblog`
  connection, no way to actually execute what's built on the canvas. That's real, separate, unbuilt scope
  (`docs/planning/PLAN.md` §6.12).
- **Does not save/load a pipeline configuration.** §6.11's full export/import fidelity requirement
  (functional core + presentation layer, one portable file) is not implemented here.
- **Does not enforce type-compatibility between connected nodes** — any node can currently connect to any
  other node on the canvas. §6.10's confirmed requirement (the Bracken/contigs-report bug) is not yet
  implemented.
- **The History page is a literal placeholder** — no real run data, proving only that a second route
  renders correctly.

None of this is an oversight - PLAN.md §6.16 scoped this pass as "requirements + a working prototype of the
UI shell," not a full build. See `docs/KNOWN_ISSUES.md` for the dated entry with full context.
