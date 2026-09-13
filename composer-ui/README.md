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
- **Exactly 4 handles per node, fixed direction** (`src/components/ToolNode.tsx`) — top/left are always
  incoming (target, blue), right/bottom are always outgoing (source, green). Corrected 2026-09-13 from an
  earlier 8-handle version (a source+target pair on every side) after owner feedback: "i only asked for 4 in
  total, not 8... we assume both the left and top are connections to previous nodes, while bottom and right
  are connection to the next nodes." Any handle accepts any number of simultaneous edges (React Flow's
  default, no extra config needed) — verified in-browser with two separate source nodes both connected into
  the same target handle.
- **Self-connection is blocked** (`src/utils/isValidConnection.ts`, passed to `<ReactFlow isValidConnection>`)
  — a node can never connect to itself; dragging a handle back onto its own node's handle is rejected and
  just selects the node instead. Unit-tested and confirmed live in-browser.
- **Connections are deletable** (`src/components/DeletableEdge.tsx`) — clicking a connection selects it and
  shows an "×" button at its midpoint; clicking that removes just that edge. Confirmed live in-browser
  (jsdom cannot simulate this interaction — see Testing section below for why).
- **Per-node parameter editing** — clicking a node opens the same floating detail panel used for
  select/hover, now with an editable form for any real pipeline parameters that tool has (grounded in actual
  `nextflow.config` params, not invented: `bowtie2` → `host_fasta`, `kraken2` → `kraken2_db`, `genomad` →
  `genomad_db`, `checkv` → `checkv_db`). Tools with no configurable params show an honest "no configurable
  parameters" message instead of an empty form. Params are per-node-instance (two Kraken2 nodes can hold
  different DB paths) and are included in the Save snapshot. The pure merge logic is unit-tested
  (`src/utils/updateNodeParam.test.ts`); the click-to-select interaction that triggers it is verified live
  in-browser only (see Testing section).
- **All nodes share one fixed default size** (180×68px, set in `src/components/PipelineCanvas.tsx`'s
  `DEFAULT_NODE_WIDTH`/`DEFAULT_NODE_HEIGHT`) regardless of the tool name/category text length — owner
  feedback 2026-09-13: "the nodes should all have the same size by default no matter their content." Text
  that overflows is truncated with an ellipsis rather than growing the box.
- **Nodes are resizable** — selecting a node reveals React Flow's `NodeResizer` handles (min 120×56px);
  dragging them resizes just that node, persisted the same way a position drag is (through the normal
  `onNodesChange` stream onto `node.width`/`node.height`). Verified live in-browser.
- **Undo/redo, multi-select + bulk move/delete, Delete key + duplicate** (owner feedback 2026-09-13: "many
  quality of life elements when it comes to the ui" - these three were the ones picked when asked to
  prioritize). `Ctrl/Cmd+Z` to undo, `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` to redo (also visible Undo/Redo
  toolbar buttons, disabled when there's nothing to undo/redo - a visible affordance, not keyboard-only, per
  this project's own established lesson that hidden-until-you-know controls get missed). The undo stack
  (`src/utils/history.ts`, a plain past/future array pair, unit-tested) covers node add (palette drop), node
  delete (Delete/Backspace or an edge's "×"), duplicate, connect, and node/selection drag - each snapshotted
  right before its mutation is applied. Deliberately does **not** yet cover in-progress param edits or node
  resizing (documented scope cut, not an oversight). Multi-select uses React Flow's own defaults - Ctrl/Cmd
  click to add a node to the selection, Shift-drag an empty area for a box-select - and both bulk move
  (dragging any selected node moves the whole selection) and bulk delete (Delete/Backspace removes every
  selected node/edge, snapshotted as a single undo step) came free from that, no new code needed beyond
  wiring `deleteKeyCode={['Backspace', 'Delete']}` (React Flow's own default is Backspace only). A node
  detail-panel "Duplicate" button clones the selected node's tool + params (not its connections) at a small
  position offset. **Real testing-tool gotcha found verifying this, not an app bug**: simulating "Ctrl+click"
  by setting a modifier flag on a single synthetic click event does not trigger React Flow's multi-select -
  it tracks the modifier key via its own real `keydown`/`keyup` listener on `window`
  (`multiSelectionActive`/`useKeyPress`), which a single click's `ctrlKey` flag never fires. Confirmed
  multi-select genuinely works by dispatching real `keydown`/`keyup` events around the clicks instead - a
  real user physically holding Ctrl hits the real listener, this only affects automated click simulation.
- **Save and Run buttons** on the Composer toolbar. Save genuinely works client-side today — downloads a
  JSON snapshot of the canvas (node ids/types/positions/data including params, edge connections) via a
  `Blob` + `<a download>`. This is a real step toward §6.11's full export/import fidelity requirement, not
  the finished feature (still no import path, no schema migration story). Run is visible but genuinely
  disabled, with a tooltip explaining why - there's no backend to run anything against yet; a disabled
  button with an honest reason beats a missing one.
- Live French/English switching (`src/i18n/`, react-i18next) — every piece of UI chrome, every node
  label/description, and now the Save/Run button labels are translated, verified live to actually re-render
  when the toggle is clicked, including already-placed canvas nodes.

**Verified for real, not just written and assumed to work:**
- Manual browser testing (`claude-in-chrome`) against the actual running dev server: drag-and-drop node
  creation, click-to-select with the floating detail panel, the FR/EN toggle re-rendering live UI text
  including a node already on the canvas and the Save/Run buttons, the Run button's `disabled` state and
  reduced opacity confirmed directly via the DOM (not just visually assumed), the Save button's click handler
  executing without error, real client-side navigation between all three pages (URL genuinely changes each
  time), the zoom/fit-view controls' icons actually legible against the dark canvas, exactly 4 handles per
  node with the correct fixed target/source roles, self-connection genuinely rejected, a real cross-node
  connection drawn and confirmed in the DOM, two separate edges landing on the same target handle confirmed
  in the DOM (multi-edge-per-handle), a selected edge's "×" button confirmed to actually remove just that
  edge, real parameter editing (typing into a Kraken2 node's DB-path field and having it retained), two nodes
  with very different label lengths rendering at the identical default size with ellipsis truncation, a node
  resize confirmed to persist after dragging its `NodeResizer` handle, the target/source handle colors
  confirmed (via computed style) to survive React Flow's own `connectingfrom`/`connectionindicator` states,
  Undo/Redo toolbar buttons confirmed to enable/disable correctly and to genuinely add/remove nodes on click,
  the Duplicate button confirmed to create a real independent second node, Delete/Backspace confirmed to
  remove a selected node and close its now-stale detail panel, real multi-select (Ctrl+click, using actual
  dispatched `keydown`/`keyup` events - see the testing-tool gotcha noted above) confirmed via the DOM to
  select both nodes, a drag of one multi-selected node confirmed to move the whole selection together, and
  Delete confirmed to remove an entire multi-selection as a single undo step.
- `npm test` (Vitest + React Testing Library, 31 tests) — i18n key-structure parity between `en.json`/
  `fr.json`, every catalog tool resolves to real translated text in both locales, the language toggle
  actually switches rendered text (not just a visual state), the active page-nav link gets the right class,
  route navigation actually swaps the rendered page for all three pages, every `ToolNode` renders exactly 4
  handles with the correct fixed target/source roles, self-connection rejected by `isValidConnection`, the
  param-merge logic (`updateNodeParam`) correctly updates one node's one param without touching siblings, and
  the undo/redo stack (`src/utils/history.ts`) round-trips correctly, discards redo on a new change, and caps
  its length.
- `npm run build` — a real production build succeeds.
- `npx tsc --noEmit` and `npm run lint` (oxlint) both clean.

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
- **Save is a partial step, not §6.11's full requirement.** It downloads node/edge structure, positions, and
  per-node params, but there's no matching Import/load path at all, and no schema-version migration story.
- **Does not enforce type-compatibility between connected nodes** — any node can currently connect to any
  other node on the canvas. §6.10's confirmed requirement (the Bracken/contigs-report bug) is not yet
  implemented.
- **Home and Run History are honest placeholders** — real pages/routes, but no real run data, since there's
  no backend to report it from.
- **Undo/redo doesn't cover every kind of edit** — node add/delete/duplicate/connect and node/selection drags
  are covered; in-progress parameter edits and node resizing are not yet wired into the history stack. A
  deliberate scope cut (matches what was actually asked for), not a gap that snuck in unnoticed.
- **No minimap or snap-to-grid** — raised as candidate QoL items alongside undo/redo/multi-select but not
  picked when the owner was asked to prioritize (`docs/KNOWN_ISSUES.md` Open #8 has the full candidate list).

## Testing limitations found this pass (2026-09-13), and how they're covered instead

React Flow's node/edge interactions rely on browser APIs jsdom doesn't implement (`ResizeObserver`,
`DOMMatrixReadOnly`, and real `getBoundingClientRect`/pointer-capture on individual handle elements). Two
real ceilings were hit and are not worth chasing further:
- **Edges cannot be rendered at all in jsdom**, even after stubbing `ResizeObserver` (to synchronously report
  a fake measured size — a no-op stub left nodes permanently "unmeasured") and `DOMMatrixReadOnly` (which
  React Flow's zoom-level reading needs). `.react-flow__edges` stays empty with no thrown error regardless —
  `src/components/DeletableEdge.test.tsx` was written, confirmed to hit this ceiling, and deleted rather than
  kept as a perpetually-failing or fake test.
- **Node click-to-select cannot be simulated in jsdom** — `userEvent.click`, `fireEvent.click`, and a manual
  pointerdown/pointerup/click sequence all fail to trigger React Flow's internal `onNodeClick` (it relies on
  `setPointerCapture`, unimplemented in jsdom).

Both are covered the same way this codebase already covers drag-and-drop (`NodePalette.test.tsx` tests the
`dataTransfer` contract, not a full simulated drop-and-render cycle): extract the underlying pure logic into
a directly-testable function (`src/utils/isValidConnection.ts`, `src/utils/updateNodeParam.ts`), unit-test
that, and verify the actual pointer interaction live in a real browser instead of faking it in jsdom.

## Bugs found and fixed this pass (2026-09-13), from real owner testing

- **Connection-point colors intermittently reverted to the library's default grey.** Root cause: React
  Flow's base stylesheet has a same-specificity `.react-flow__handle { background-color: var(...) }` rule
  that also applies to its own `.connectingfrom`/`.connectionindicator` states during an active connection
  drag, so our `.tool-node__handle--target`/`--source` color rules could lose the cascade mid-drag. Fixed
  with `!important` on those two rules (justified in a comment in `ToolNode.css` — not a habit, a specific
  answer to a specific same-specificity collision); confirmed fixed by adding those state classes via script
  and checking the computed background color stays our blue/green.
- **Node size varied with content length**, e.g. a long category label made one node visibly wider than a
  short one. Fixed by giving every new node an explicit default `width`/`height` (180×68, in
  `PipelineCanvas.tsx`) that `ToolNode`'s CSS fills at 100%/100%, with overflowing text ellipsis-truncated
  instead of growing the box.
- **No way to resize a node** — added via React Flow's own `NodeResizer` component, shown only while a node
  is selected.

None of this is an oversight - PLAN.md §6.16 scoped this pass as "requirements + a working prototype of the
UI shell," not a full build. See `docs/KNOWN_ISSUES.md` for the dated entry with full context.
