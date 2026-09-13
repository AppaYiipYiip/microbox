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
  QUAST, geNomad, CheckV, MaxBin2, MultiQC — not invented examples). Also includes **Pavian**
  (`bin/run-pavian.sh`), even though it's a standalone report viewer deliberately NOT wired into the Nextflow
  DAG (PLAN.md §6.6 item 2) — added 2026-09-13 at the owner's request ("i would love to see it in the
  pipeline"), since this catalog's job is representing every real tool the project has, not strictly the DAG.
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
- **Connections are validated against what the real pipeline can actually execute** (owner, 2026-09-13,
  after asking about a saved canvas: "doesnt each node have a set of parametres... i see only input field
  for paths" led into a bigger realization - the canvas let you draw connections the real fixed-backbone
  pipeline structurally cannot run, e.g. QUAST → MaxBin2, or MEGAHIT → Kraken2 which looks plausible but
  isn't real - fastq-entry Kraken2 always classifies reads, never an assembler's contigs). `src/data/
  pipelineTopology.ts` is a hardcoded "what can actually feed what" map, grounded directly in
  `workflows/microbox.nf`'s real channel wiring (every entry cites the specific behavior it's based on, not
  guessed from tool names) - `src/utils/validatePipeline.ts` (unit-tested) checks every drawn edge against
  it. Invalid connections render as a dashed amber line on the canvas (instead of the normal solid one) and
  are listed in a warning banner above the canvas, translated, non-blocking (Save/interaction still work
  fine - Run is already disabled for other reasons). Deliberately does **not** check whether a node has ALL
  the inputs it needs (MaxBin2 genuinely requires both a contigs edge AND a reads edge simultaneously - a
  node fed only one would still fail for real) - a known, documented gap, not an oversight; this pass only
  checks "is each individual drawn connection real," which is what was asked for and what caught the actual
  mistake in a real user-drawn graph. Verified live in-browser: recreating the user's own QUAST → MaxBin2
  connection renders the dashed-amber edge and the exact warning text, in real time as the edge is drawn.
- **Node state is visible on the canvas, not just in the detail panel** (PLAN.md §6.11's Pipeline-page
  refinement: "node state (enabled/skipped/incompatible-connection) needs to be visible, not just silently
  enforced," and "nodes need a visual distinction between default and user-overridden parameters"). Every
  node has an "Enabled" checkbox in its detail panel (`src/utils/toggleNodeEnabled.ts`, unit-tested); a
  disabled node renders dimmed with a "Skipped" badge directly on the canvas, regardless of selection. Any
  tool with at least one real param set away from empty shows a small amber dot next to its name. The hover
  tooltip shows the tool's description plus every currently-set param's *current value* (not the default) —
  §6.11 explicitly calls out "tooltips should show current values, not defaults." Verified live in-browser
  and via `ToolNode.test.tsx` (rendered through a real `ReactFlow` instance, same pattern as the 4-handle
  test).
- **Save and Import, with real fidelity** (PLAN.md §6.11: "save/import/export a pipeline configuration as a
  portable file... importing it into a different microbox instance should reconstruct the pipeline exactly
  as if it had been built there natively"). Save downloads a JSON snapshot via a `Blob` + `<a download>`;
  Import (a hidden `<input type="file">` behind a visible toolbar button) reads it back and replaces the
  canvas. **A real fidelity bug found and fixed while building this**: Save previously dropped `width`/
  `height` and each edge's `sourceHandle`/`targetHandle` entirely — since every `ToolNode` has 4 handles, an
  edge missing that information would have silently rendered from whichever handle React Flow finds first
  (confirmed by reading `@xyflow/system`'s own `getHandle$1`: `"if no handleId is given, we use the first
  handle"`), not the one actually drawn. Both are now saved and restored. `src/utils/
  importCanvasSnapshot.ts` (pure, unit-tested, no FileReader/DOM) validates the file and **rejects the whole
  import** on any structural problem (invalid JSON, wrong `formatVersion`, a referenced tool id that doesn't
  exist in the catalog, malformed node/edge shape) rather than partially loading a broken graph — PLAN.md
  §6.11: "basic sanity validation on import (a malformed or hostile file shouldn't be trusted blindly)."
  Every imported node gets a **fresh id** via the same counter the palette-drop/duplicate paths use, never
  the file's own ids verbatim, so importing can never collide with nodes already on the canvas; edges are
  rebuilt through React Flow's own `addEdge()` utility (the same one `onConnect` uses) so the id/shape stays
  identical to a freshly-drawn connection. Import is a real, deliberate "Load a file" action (destructive to
  whatever's currently on the canvas), so it takes an undo-history snapshot first — confirmed live: importing
  over an existing canvas, then pressing Ctrl+Z, restored the pre-import canvas exactly. A translated,
  non-blocking error banner reports why a bad file was rejected. **Verified live in-browser**: exported a
  real 2-node, 1-edge canvas (a disabled Kraken2 with a set param, connected to Bracken), re-imported it via
  a real `File`/`DataTransfer` dispatched to the actual file input, and confirmed every field round-tripped
  exactly (position, size, enabled state, param value, and which specific handles the edge used) — plus
  confirmed a deliberately malformed file is rejected with a clear message and leaves the canvas untouched.
- **Save/Run buttons** — Run is visible but genuinely disabled, with a tooltip explaining why - there's no
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
  Delete confirmed to remove an entire multi-selection as a single undo step. Recreating the user's own
  reported QUAST → MaxBin2 connection confirmed the dashed-amber edge and warning banner both appear, live.
  A disabled node with a set param confirmed to render dimmed with a "Skipped" badge and an override dot; a
  real Save→Import round trip (via a real `File`/`DataTransfer` dispatched to the actual file input, not
  simulated) confirmed every field survives exactly, and a deliberately malformed import confirmed to show a
  clear error and leave the canvas untouched; Undo confirmed to recover the pre-import canvas.
- `npm test` (Vitest + React Testing Library, 56 tests) — i18n key-structure parity between `en.json`/
  `fr.json`, every catalog tool resolves to real translated text in both locales, the language toggle
  actually switches rendered text (not just a visual state), the active page-nav link gets the right class,
  route navigation actually swaps the rendered page for all three pages, every `ToolNode` renders exactly 4
  handles with the correct fixed target/source roles, self-connection rejected by `isValidConnection`, the
  param-merge logic (`updateNodeParam`) correctly updates one node's one param without touching siblings, the
  undo/redo stack (`src/utils/history.ts`) round-trips correctly, discards redo on a new change, and caps its
  length, `findInvalidEdges` (`src/utils/validatePipeline.ts`) accepts real dependencies and flags
  connections that don't exist in the real pipeline (including two that look plausible but aren't - MEGAHIT
  → Kraken2, metaSPAdes → MultiQC), `toggleNodeEnabled` flips only the targeted node, `ToolNode` renders the
  disabled/override-dot states correctly, and `parseCanvasSnapshot` (`src/utils/importCanvasSnapshot.ts`)
  round-trips a full snapshot, remaps ids, defaults missing fields sensibly, and rejects invalid JSON, the
  wrong format version, an unknown tool id, and structurally malformed nodes/edges.
- `npm run build` — a real production build succeeds. **Note**: `npx tsc --noEmit` alone is not sufficient -
  it missed a real type error (`Object.fromEntries` losing type narrowing through a `.filter()`) that only
  `npm run build`'s `tsc -b` (project-reference build) caught, presumably a difference in which tsconfig each
  resolves. Always verify with a real `npm run build`, not just `tsc --noEmit`, going forward.
- `npm run lint` (oxlint) clean.

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
- **Save/Import now cover §6.11's core fidelity requirement (position, size, params, enabled state, edge
  handles, real id-collision safety) but not everything the section describes.** No schema-version migration
  story (a v2 format would just be rejected outright by v1's parser, not translated forward); no name/
  description metadata on a saved pipeline; positions are saved as raw canvas coordinates, not the
  logical/viewport-independent scheme §6.11 flags as the standard fix for cross-screen-size portability
  (not yet a problem in practice since React Flow's canvas is itself pannable/zoomable and nothing here
  depends on absolute screen pixels, but worth revisiting if that ever changes).
- **Validation is a warning, not enforcement** — any node can still be connected to any other node on the
  canvas; invalid connections (per `src/data/pipelineTopology.ts`) get a dashed-amber edge and a banner
  entry, but nothing blocks drawing or saving them. §6.10's confirmed requirement (the Bracken/contigs-report
  bug) still isn't structurally prevented, just flagged.
- **Validation checks individual edges only, not whether a node has ALL the inputs it needs** — e.g. MaxBin2
  genuinely requires both a contigs edge and a reads edge simultaneously in the real pipeline; a MaxBin2 node
  fed only one (even a "valid" one) would still fail for real, and the composer doesn't catch that yet.
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

Same split applied to Import: `src/utils/importCanvasSnapshot.ts` (the parsing/validation) is fully
unit-tested with plain strings, no FileReader or DOM at all; the actual `<input type="file">`/FileReader
wiring in `ComposerPage.tsx` was verified live in a real browser instead, by constructing a real `File` +
`DataTransfer` and dispatching a genuine `change` event to the input - not simulated, a real browser File
API call, just scripted instead of clicked through an OS file picker (which browser automation can't drive
directly either way).

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
- **Save silently dropped `width`/`height` and each edge's `sourceHandle`/`targetHandle`** — found while
  building Import, not by testing Save in isolation (Save alone can't reveal a fidelity gap; only trying to
  reconstruct FROM the saved data can). Since every `ToolNode` has 4 handles, an edge missing which one it
  used would have rendered from whichever handle React Flow finds first on import (confirmed by reading
  `@xyflow/system`'s own source: `getHandle$1`, `"if no handleId is given, we use the first handle"`) — not
  a crash, just a silently wrong-looking reconstruction. Fixed by including both in `downloadCanvasSnapshot`.

None of this is an oversight - PLAN.md §6.16 scoped this pass as "requirements + a working prototype of the
UI shell," not a full build. See `docs/KNOWN_ISSUES.md` for the dated entry with full context.
