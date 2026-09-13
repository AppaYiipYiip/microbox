# composer-ui — pipeline composer prototype

**Status: prototype/research artifact, not connected to the real pipeline.** Built 2026-09-13 to answer
`docs/planning/PLAN.md` §6.16's requirements list with a real, working proof of concept — not a mockup, but
also not yet wired to `bin/run.sh`/Nextflow execution (that's the FastAPI/`-with-weblog` backend described in
§6.12, a separate, not-yet-built piece). This is a **separate React application** from the existing
Streamlit thin launcher (`ui/`) — the two are unrelated and both currently exist; see `docs/planning/PLAN.md`
§6.10 for why (Streamlit's server-rendered model is a poor fit for a Figma-like drag/connect canvas).

## Layout, corrected 2026-09-13 after owner testing

The first pass had the page-navigation and node-palette sides backwards - fixed after real feedback from
actually clicking through it, not from re-reading the requirements:

- **Left**: page navigation (Home / Composer / Run History) — `src/components/PageNav.tsx`.
- **Top**: brand + French/English toggle — `src/components/TopBar.tsx`.
- **Right** (on the Composer page): the categorized, draggable tool palette — `src/components/NodePalette.tsx`.
- **Center**: the canvas.

## What's actually built and verified

- **Three real pages**: Home (`/`) — a "currently running" section, honestly empty since there's no backend
  yet; Composer (`/composer`) — the canvas; Run History (`/history`) — a placeholder proving the route works.
- A categorized, draggable node palette listing this pipeline's real tools (`src/data/toolCatalog.ts` mirrors
  `workflows/microbox.nf`'s actual stages — fastp, FastQC, Bowtie2, MEGAHIT, metaSPAdes, Kraken2, Bracken,
  QUAST, geNomad, CheckV, MaxBin2, MultiQC — not invented examples).
- A React Flow canvas (`src/components/PipelineCanvas.tsx`, `colorMode="dark"`) — drag a tool from the
  palette, drop it on the canvas, connect nodes, click to select (a floating detail panel over the canvas,
  not a fixed column), hover for a tooltip. Zoom/fit-view/lock controls render in the library's dark theme,
  not the default light one (a real legibility bug found in testing — the default `Controls` icons were
  unreadable against this app's dark background).
- **Save and Run buttons** on the Composer toolbar. Save genuinely works client-side today — downloads a
  JSON snapshot of the canvas (node ids/types/positions/data, edge connections) via a `Blob` + `<a
  download>`. This is a real first step toward §6.11's full export/import fidelity requirement, not the
  finished feature (no per-node parameter editing exists yet to serialize, no import path, no schema
  migration story). Run is visible but genuinely disabled, with a tooltip explaining why - there's no
  backend to run anything against yet; a disabled button with an honest reason beats a missing one.
- Live French/English switching (`src/i18n/`, react-i18next) — every piece of UI chrome, every node
  label/description, and now the Save/Run button labels are translated, verified live to actually re-render
  when the toggle is clicked, including already-placed canvas nodes.

**Verified for real, not just written and assumed to work:**
- Manual browser testing (`claude-in-chrome`) against the actual running dev server: drag-and-drop node
  creation, click-to-select with the floating detail panel, the FR/EN toggle re-rendering live UI text
  including a node already on the canvas and the Save/Run buttons, the Run button's `disabled` state and
  reduced opacity confirmed directly via the DOM (not just visually assumed), the Save button's click handler
  executing without error, real client-side navigation between all three pages (URL genuinely changes each
  time), and the zoom/fit-view controls' icons actually legible against the dark canvas.
- `npm test` (Vitest + React Testing Library, 17 tests) — i18n key-structure parity between `en.json`/
  `fr.json`, every catalog tool resolves to real translated text in both locales, the language toggle
  actually switches rendered text (not just a visual state), the active page-nav link gets the right class,
  and route navigation actually swaps the rendered page for all three pages.
- `npm run build` — a real production build succeeds.
- `npx tsc -b` and `npm run lint` (oxlint) both clean.

**Real bug hit and fixed while doing this pass**: after bulk-syncing changed files between the Windows and
WSL copies (this project's established dual-copy workflow, `CONTRIBUTING.md` §0), Vite's dev server threw a
stale-HMR `SyntaxError` claiming a component wasn't exported, even though it genuinely was — a Vite
dev-cache staleness issue from many files changing near-simultaneously via `tar`, not a real code bug.
Fixed by clearing `node_modules/.vite` and restarting the dev server fresh, not by chasing a phantom export
bug. Worth knowing if this happens again after a bulk sync.

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
  connection, no way to actually execute what's built on the canvas. The Run button reflects this honestly
  (visible, disabled, with a tooltip) rather than pretending to work. That's real, separate, unbuilt scope
  (`docs/planning/PLAN.md` §6.12).
- **Save is a partial step, not §6.11's full requirement.** It downloads node/edge structure and positions,
  but there's no per-node parameter editing yet to serialize, and no matching Import/load path at all.
- **Does not enforce type-compatibility between connected nodes** — any node can currently connect to any
  other node on the canvas. §6.10's confirmed requirement (the Bracken/contigs-report bug) is not yet
  implemented.
- **Home and Run History are honest placeholders** — real pages/routes, but no real run data, since there's
  no backend to report it from.

None of this is an oversight - PLAN.md §6.16 scoped this pass as "requirements + a working prototype of the
UI shell," not a full build. See `docs/KNOWN_ISSUES.md` for the dated entry with full context.
