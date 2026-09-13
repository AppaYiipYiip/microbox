# composer-ui — pipeline composer prototype

**Status: the Composer itself is a prototype/research artifact - its own Run button is still disabled, and
it does not generate or execute a real pipeline configuration** (that's the FastAPI/`-with-weblog` backend
described in PLAN.md §6.12, a separate, not-yet-built piece). Built 2026-09-13 to answer
`docs/planning/PLAN.md` §6.16's requirements list with a real, working proof of concept, not a mockup.
Composer-ui is still a **separate React application** from the existing Streamlit thin launcher (`ui/`) - see
`docs/planning/PLAN.md` §6.10 for why (Streamlit's server-rendered model is a poor fit for a Figma-like
drag/connect canvas) - **but as of 2026-09-13 the two are no longer reached via separate ports**: this app's
own dev server proxies the real Streamlit launcher in as its own "Run Pipeline" page
(`src/pages/RunPipelinePage.tsx`, alongside Home/Composer/Run History in the same left nav), so
`http://localhost:5173/run` is a real, working way to actually launch the pipeline - see "What's actually
built" below and `docs/KNOWN_ISSUES.md`'s dated entry for exactly how.

## Layout, corrected 2026-09-13 after owner testing

The first pass had the page-navigation and node-palette sides backwards - fixed after real feedback from
actually clicking through it, not from re-reading the requirements:

- **Left**: page navigation (Home / Composer / Run History) — `src/components/PageNav.tsx`.
- **Top**: brand + French/English toggle — `src/components/TopBar.tsx`.
- **Right** (on the Composer page): the categorized, draggable tool palette — `src/components/NodePalette.tsx`.
- **Center**: the canvas.

## What's actually built and verified

- **Four real pages**: Home (`/`) — a "currently running" section, honestly empty since there's no backend
  yet; Composer (`/composer`) — the canvas; **Run Pipeline** (`/run`) — added 2026-09-13, embeds the real,
  separate Streamlit launcher (`ui/app.py`) via Vite's dev-server proxy (`/run-app` -> the Streamlit port,
  `vite.config.ts`) so it's reachable on this same port/nav rather than a separate URL - this is the one page
  that actually runs the pipeline, Composer's own Run button stays disabled; **Run History** (`/history`) —
  no longer a placeholder as of 2026-09-13, a real table listing every retained past run (each one gets its
  own timestamped `results/run_<timestamp>/` directory now, `ui/app.py`/`bin/run.sh`'s `--outdir`, instead of
  one run overwriting the last), with **View** (that run's real MultiQC report inline), **Export** (a real
  browser download of it), and **Delete** (removes that run's whole directory, with a confirmation prompt
  first) per row - backed by `src/pages/HistoryPage.tsx` + `serve-results-plugin.ts` (a dev-server-only Vite
  plugin exposing a `/reports-api/runs` list/delete endpoint and `/reports/*` static file serving over the
  real `results/` directory) - no filesystem/WSL path ever shown, an honest empty state if nothing has
  completed yet.
- A categorized, draggable node palette listing this pipeline's real tools (`src/data/toolCatalog.ts` mirrors
  `workflows/microbox.nf`'s actual stages — fastp, FastQC, Bowtie2, MEGAHIT, metaSPAdes, Kraken2, Bracken,
  QUAST, geNomad, CheckV, MaxBin2, MultiQC — not invented examples). Also includes **Pavian**
  (`bin/run-pavian.sh`), even though it's a standalone report viewer deliberately NOT wired into the Nextflow
  DAG (PLAN.md §6.6 item 2) — added 2026-09-13 at the owner's request ("i would love to see it in the
  pipeline"), since this catalog's job is representing every real tool the project has, not strictly the DAG.
  The palette has a **search/filter box** (PLAN.md §6.16's node-palette nice-to-have) - matches against the
  current UI language's translated tool name *and* description (`src/utils/paletteSearch.ts`, unit-tested),
  so searching in French filters against the French text; categories with no matching tools are hidden
  entirely rather than left as an empty header, and an honest "no tools match" message shows when nothing
  does. Verified live in both languages, including the description-only match case (typing "kraken" also
  surfaces Bracken and Pavian, since their descriptions mention Kraken2, not just the Kraken2 card itself).
  Each category header is also a **collapse/expand toggle** (PLAN.md §6.16's other node-palette nice-to-have,
  "collapsible category groups") - a chevron rotates to show state; collapsing is purely visual state, so a
  collapsed category's tools still surface once a search matches them rather than staying hidden (search
  overrides collapse, not the other way around). Verified live: collapsing/re-expanding a category, and a
  collapsed category's tools reappearing the moment a matching search query is typed.
- **Keyboard shortcuts** (PLAN.md §6.16 canvas nice-to-have; the copy/cut/paste ones were the owner asking
  "i assume ctrl+c or x or z or r are working" - undo/redo/duplicate already did, copy/cut/paste didn't yet,
  built rather than left as an untrue assumption): `Ctrl/Cmd+D` duplicates the selected node (mirrors the
  detail panel's own Duplicate button); `Ctrl/Cmd+C`/`X`/`V` copy/cut/paste it (scoped to the single
  selected node, same as Duplicate - a component-state clipboard, not the real OS one, since cross-tab paste
  isn't a requirement here and the Clipboard API would need its own permission prompt for no benefit;
  repeated pastes from the same copy stagger apart by 24px instead of stacking exactly on top of each
  other); `Escape` closes the detail panel/clears the selection. All of the above `event.preventDefault()`
  their browser default (bookmark dialog for `D`, nothing meaningful for `X`/`V` outside a text field) -
  except `C`, which deliberately does NOT intercept when there's an active text selection elsewhere on the
  page, so selecting the page title and pressing Ctrl+C still copies that text normally rather than being
  silently hijacked into copying a node just because one happens to also be selected. All skip while focus
  is in a text field, same as the undo/redo shortcuts. **Deliberately not bound: `Ctrl/Cmd+R`** (browser
  refresh) - hijacking page refresh is a materially more invasive choice than shadowing a rarely-used
  browser shortcut (bookmarking a SPA route, copying page text with nothing selected) and wasn't left
  disabled for lack of trying - there's just no specific feature it should map to yet. Undo/Redo are now
  circular-arrow icon buttons (owner: "the circular ones that mean back and forth cycle, not the straight
  ones") rather than text labels, with the action name + shortcut in the tooltip/`aria-label` since the icon
  alone isn't accessible on its own. **A real, previously-unnoticed selection bug found and fixed while
  testing paste**: Duplicate/Paste/Undo/Redo/Escape/Close all update this app's own `selectedNodeId` tracker
  (correctly driving the detail panel) but were never updating each node's own React-Flow-level `.selected`
  flag (what actually drives the blue border/resize-handle overlay on the canvas) - so after a paste, the
  panel would correctly show the new node while the canvas kept highlighting the old one. A real click
  doesn't hit this (React Flow dispatches its own selection change automatically), only this app's own
  programmatic selection changes did. Fixed with a shared `withNoSelection`/`clearSelection` helper used
  everywhere the selection changes outside of a real click. Verified live in-browser (not unit-tested - all
  of these need a selected node, which needs React Flow's click-to-select, the same jsdom limitation noted
  in the Testing section below): copy then paste twice produced two independent staggered nodes with the
  canvas highlight correctly following the newest paste (confirmed via the DOM, not just visually), Ctrl+D
  created a real second node without triggering the browser's bookmark dialog, and Escape closed the panel
  and fully cleared the selection border.
- **Kraken2 database-variant helper** (owner, 2026-09-13: "let the user select which version they want, and
  have one written as (recommended) based on their hardware. we automatically detect their hardware
  capabilities"). Kraken2's detail panel now shows four real database variants (`src/data/
  kraken2DbVariants.ts`, grounded in PLAN.md §2.3's own researched table - name, real RAM requirement, and
  whether `bin/download-dbs.sh` can actually fetch it today, checked directly against that script rather
  than assumed from the table alone: Viral and Standard-8 are wired up, Standard-16/PlusPF-16 are documented
  production candidates the script explicitly hasn't been extended to yet), each with a "Use this path"
  button that fills the real `kraken2_db` field with the download script's own conventional extract path
  (`~/microbox-dbs/kraken2/<variant>` - a copyable convention, not a claim this browser app can see the
  user's actual filesystem) - skipped entirely for the two not-yet-downloadable variants, since offering a
  path for a DB nothing can fetch yet would be actively misleading.
  **On "we automatically detect their hardware capabilities" - the honest version of that, not a fake one**:
  a browser fundamentally cannot read a machine's real total RAM. `navigator.deviceMemory` (Chromium-only,
  unsupported in Firefox/Safari) exists, but is deliberately rounded to a power of two AND CAPPED AT 8 for
  privacy — a machine with 8, 16, 64, or 256 GiB of RAM all report the same "8"
  (`src/utils/estimateDeviceMemory.ts` has the full citation). That cap makes it structurally unable to
  distinguish the cases this feature's bigger recommendations (14.9+ GiB variants) actually depend on. Used
  here ONLY to pre-fill a plainly-editable "Available RAM" number input, never presented as an authoritative
  reading — when the API isn't supported at all, the field starts empty with a message saying so, rather than
  guessing. `src/utils/recommendKraken2Db.ts` (pure, unit-tested) then recommends the largest variant whose
  RAM requirement is at most **half** of that figure — a deliberately conservative margin grounded in this
  project's own real finding (PLAN.md §2.3 / `docs/KNOWN_ISSUES.md`): on an 11 GiB VM, the 7.45 GiB
  Standard-8 DB *did* classify correctly, but only when run completely alone — running it alongside a real
  MEGAHIT assembly OOM-killed the assembly. That's already ~68% utilization proven too tight for a real run;
  50% is a real answer to a real observed failure, not an arbitrary number. **Verified live in-browser**: the
  dev machine's real (Chromium-reported) `deviceMemory` of 4 correctly pre-filled the RAM field and
  recommended Viral; editing it to 32 live-updated the recommendation to Standard-16 (still correctly marked
  "not yet downloadable"); clicking "Use this path" on Viral filled the real path field with
  `~/microbox-dbs/kraken2/viral` and the node's override dot appeared, confirming it's a real, working
  update to that node's actual param, not a cosmetic suggestion.
- **Auto-arrange** (PLAN.md §6.16 canvas nice-to-have: "auto-layout/auto-arrange") — a toolbar button that
  lays every node out top-to-bottom in rows based on its connections (`src/utils/autoLayout.ts`, pure,
  unit-tested). Vertical, matching a real reference pipeline diagram the owner's R&D team provided (2026-09-13)
  - the layout was originally left-to-right, corrected once the owner asked for it to match that diagram's
  shape. Hand-rolled instead of a graph-layout library (dagre/elkjs) - this toolbox is bounded to ~20 nodes
  (PLAN.md §6.7/§6.10's own framing), and a real dependency decision (which library, its bundle-size cost, one
  more thing to keep updated) isn't worth it for a layout this simple. Each node's row is the LONGEST path
  from any root to it (so a node fed by two branches at different depths lands after both, never overlapping
  a predecessor); a node with no incoming edges is row 0 - a normal, valid starting point on this canvas
  (every reads-stage in the real pipeline is independently skippable), not an error case. The composer doesn't
  forbid drawing a cycle - a cycle can't be topologically layered by definition, so any node still unresolved
  once nothing else can move is placed in row 0 alongside the real roots, rather than looping forever. Only
  repositions nodes - never touches connections, params, or enabled state - and takes a history snapshot
  first like every other mutation here. **Verified live in-browser**: two nodes dropped at scattered positions
  and connected, then Auto-arrange placed them at exactly `(0, 0)` and `(0, 120)` (confirmed via each node's
  actual CSS transform, not just eyeballed) - one press of Undo restored their original scattered positions
  exactly.
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
- **Connections are NOT restricted to what the real pipeline can currently execute** - deliberately, as of
  2026-09-13. An earlier pass (same day) built exactly the opposite: a hardcoded "what can actually feed
  what" map (`src/data/pipelineTopology.ts`) checked against `workflows/microbox.nf`'s real channel wiring,
  flagging mismatches with a dashed-amber edge and a warning banner. Removed after real use revealed the
  actual cost: every mismatch it caught (FastQC → fastp, QUAST → MaxBin2) needed real investigation to tell
  apart "the composer found a genuine mistake" from "the composer is comparing a forward-looking design
  against code that hasn't caught up yet, or a reference diagram that's just one example, not a literal spec"
  - and the owner's own R&D reference pipeline kept landing in the second bucket. Owner's call once that
  pattern was clear: "we allow the user to do whatever they want no need for warning" - the composer is a
  free-form design tool, not a gate against the current pipeline implementation. The fixed-role handles
  (top/left = incoming, right/bottom = outgoing) are still the only notion of "direction" enforced -
  `src/utils/isValidConnection.ts` still rejects a same-role pair (genuinely ambiguous, not a real-pipeline
  judgment call) and self-connections, but nothing checks a specific tool pair against `workflows/microbox.nf`
  anymore. See `docs/KNOWN_ISSUES.md`'s dated entries for the full back-and-forth, including the real research
  (nf-core/mag, Galaxy Training Network) that went into confirming QUAST → MaxBin2 genuinely isn't a real data
  dependency (it stays uncaught now, by choice) before the check was removed anyway.
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
  (A follow-up integration test the same day found the edge itself didn't actually *render* despite the data
  round-tripping correctly - see "Imported edges silently failed to render" below; this bullet's round-trip
  claim is accurate for the data, the separate rendering gap is now fixed and verified too.)
- **Save/Run buttons** — Run is visible but genuinely disabled, with a tooltip explaining why - there's no
  backend to run anything against yet; a disabled button with an honest reason beats a missing one.
- **Download Image** (owner, 2026-09-13: "as for the composer, we should have an option to download it as
  image") — a toolbar button next to Save, disabled on an empty canvas the same way. Uses the `html-to-image`
  package's `toPng()` against the live `.react-flow__viewport` DOM node, framed with React Flow's own
  `getNodesBounds`/`getViewportForBounds` helpers (the pattern React Flow's own docs recommend for this
  exact use case) so the PNG matches whatever is actually drawn - node colors, badges, connections - not a
  separately-rendered approximation, regardless of the canvas's current pan/zoom. Verified live: clicking the
  button with two real nodes on the canvas produced a `microbox-pipeline-<timestamp>.png` download.
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
  A disabled node with a set param confirmed to render dimmed with a "Skipped" badge and an override dot; a
  real Save→Import round trip (via a real `File`/`DataTransfer` dispatched to the actual file input, not
  simulated) confirmed every field survives exactly, and a deliberately malformed import confirmed to show a
  clear error and leave the canvas untouched; Undo confirmed to recover the pre-import canvas. Palette
  search confirmed live in both languages: typing "kraken" surfaces Kraken2/Bracken/Pavian (a description-
  text match, not just the name) with every non-matching category hidden, clearing restores the full list,
  and an unmatchable query shows the translated "no tools match" message. Category collapse/expand confirmed
  via `aria-expanded`, including a collapsed category's tools reappearing once a search matches them.
- `npm test` (Vitest + React Testing Library, 95 tests) — i18n key-structure parity between `en.json`/
  `fr.json`, every catalog tool resolves to real translated text in both locales, the language toggle
  actually switches rendered text (not just a visual state), the active page-nav link gets the right class,
  route navigation actually swaps the rendered page for all three pages, every `ToolNode` renders exactly 4
  handles with the correct fixed target/source roles, self-connection rejected by `isValidConnection`, the
  param-merge logic (`updateNodeParam`) correctly updates one node's one param without touching siblings, the
  undo/redo stack (`src/utils/history.ts`) round-trips correctly, discards redo on a new change, and caps its
  length, `toggleNodeEnabled` flips only the targeted node, `ToolNode` renders the
  disabled/override-dot states correctly, and `parseCanvasSnapshot` (`src/utils/importCanvasSnapshot.ts`)
  round-trips a full snapshot, remaps ids, defaults missing fields sensibly, and rejects invalid JSON, the
  wrong format version, an unknown tool id, and structurally malformed nodes/edges, `matchesSearch`
  (`src/utils/paletteSearch.ts`) matches/rejects correctly and treats an empty query as matching everything,
  and `NodePalette` filters to matching tools, hides empty categories, shows the "no results" message, and
  collapses/re-expands a category (with a matching search still surfacing a collapsed category's tools),
  `recommendKraken2Db` (`src/utils/recommendKraken2Db.ts`) recommends the correct variant across a range of
  real RAM figures (including the real 7 GiB/11 GiB cases from this project's own past findings) and never
  returns nothing, `estimateDeviceMemoryGiB` returns the browser-reported value when present and `null`
  when the API isn't supported, and `computeAutoLayout` (`src/utils/autoLayout.ts`) lays out a linear chain
  in increasing columns, places a node after the DEEPER of two ancestors, gives every rootless node the
  same first column, and never infinite-loops on a cycle.
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

The `/run` page (the real pipeline launcher) needs the separate Streamlit process running too -
`bash bin/run-ui.sh` from the repo root - since it's a proxied Python app, not something Vite serves on its
own. Composer/Home/Run History work fine without it; `/run` will just show a proxy error until it's up.

Needs Node.js 24 LTS (installed via NodeSource's apt repo — see `bin/setup-dev.sh` if that step gets added
there later; not yet included since this is still a prototype, not part of the standard dev setup).

## What this deliberately does NOT do yet

- **The Composer itself still does not run what's drawn on its canvas.** There's no FastAPI server or
  `-with-weblog` connection translating a drawn graph into a real pipeline configuration - the Composer's own
  Run button reflects this honestly (visible, disabled, with a tooltip) rather than pretending to work.
  That's real, separate, unbuilt scope (`docs/planning/PLAN.md` §6.12). This is a different thing from the
  separate **Run Pipeline** page (`/run`, added 2026-09-13) - that page genuinely runs the real pipeline
  today, via the pre-existing Streamlit launcher embedded through a dev-server proxy, independent of anything
  drawn in the Composer.
- **Save/Import now cover §6.11's core fidelity requirement (position, size, params, enabled state, edge
  handles, real id-collision safety) but not everything the section describes.** No schema-version migration
  story (a v2 format would just be rejected outright by v1's parser, not translated forward); no name/
  description metadata on a saved pipeline; positions are saved as raw canvas coordinates, not the
  logical/viewport-independent scheme §6.11 flags as the standard fix for cross-screen-size portability
  (not yet a problem in practice since React Flow's canvas is itself pannable/zoomable and nothing here
  depends on absolute screen pixels, but worth revisiting if that ever changes).
- **No connection is checked against what the real pipeline can actually execute** — any node can be
  connected to any other, in any combination, with no warning of any kind (removed 2026-09-13, see "What's
  actually built" above for why). §6.10's confirmed requirement (the Bracken/contigs-report bug) isn't
  structurally prevented at all now, not even flagged - a deliberate choice, not an oversight.
- **Home and Run History are honest placeholders** — real pages/routes, but no real run data, since there's
  no backend to report it from.
- **Undo/redo doesn't cover every kind of edit** — node add/delete/duplicate/connect and node/selection drags
  are covered; in-progress parameter edits and node resizing are not yet wired into the history stack. A
  deliberate scope cut (matches what was actually asked for), not a gap that snuck in unnoticed.
- **No minimap or snap-to-grid** — raised as candidate QoL items alongside undo/redo/multi-select but not
  picked when the owner was asked to prioritize (`docs/KNOWN_ISSUES.md` Open #8 has the full candidate list).
- **Copy/cut/paste is scoped to a single node**, same as Duplicate - not the whole multi-selection. A
  deliberate consistency choice (both features now share one notion of "the current selection"), not an
  oversight; extending both together to real multi-selection is a reasonable future ask, not attempted here.
- **The Kraken2 RAM/variant helper is guidance, not automation** — "Use this path" writes a *conventional*
  path string into the real `kraken2_db` field; it does not (and structurally cannot, from a browser) check
  whether that path actually exists on the user's disk, download anything, or verify the DB is really there.
  Genuinely automatic RAM detection also isn't possible from a browser at all - see the feature's own writeup
  above for why `navigator.deviceMemory`'s 8 GB cap makes this fundamentally a rough hint, not a fact.
- **The RAM/variant helper is Kraken2-only** - geNomad/CheckV/Bowtie2 also take a DB/reference path but don't
  get this treatment. A deliberate scope match to what was actually asked ("when it comes to kraken..."), not
  an oversight; the same pattern would generalize if asked for.

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
- **Imported edges silently failed to render at all, found 2026-09-13 during a self-initiated integration
  test** (a real fastp→Bowtie2(disabled)→Kraken2(param set) chain, exported and re-imported). Nodes and edges
  were both correctly reconstructed in React state (confirmed via a standalone Vitest reproduction and a live
  tracer), but the DOM stayed at 0 edges indefinitely — no timing delay, re-render, or wait fixed it. **Root
  cause**: React Flow can't draw an edge until it has asynchronously measured its endpoint nodes' real handle
  positions; a palette drop always gets a human-timescale gap before a connection is drawn to it, but import
  sets new nodes AND their edges in the same operation, so the edge's first (and, confirmed live, only ever)
  render finds the nodes still unmeasured and silently gives up. Fixed with React Flow's own `Node.handles`
  escape hatch — `defaultNodeHandles()` in `src/data/nodeDefaults.ts` pre-declares approximate handle
  positions so edges can render immediately; real measurement still lands moments later and silently
  overwrites the estimate with the pixel-exact one. Applied to both `importCanvasSnapshot.ts` and
  `PipelineCanvas.tsx`'s palette-drop path. Verified live: the exact failing 3-node scenario now renders both
  edges immediately on import, with the disabled badge and param-override dot both correctly preserved too.
- **Connections silently failed to draw "sometimes," requiring repeated attempts** (owner: "sometimes the
  connection fails and i need to do it / try so many times"). Root cause: React Flow's default
  `connectionMode="strict"` silently rejects a drag that starts and ends on two handles of the SAME declared
  role (target-to-target/source-to-source) — with zero feedback, not even a console warning. Every node shows
  all 4 fixed-role handles at once, so grabbing the "wrong" one is easy and looked exactly like a random,
  unexplained failure. Fixing this took two changes, not one: switching to `connectionMode="loose"` alone
  just traded one silent failure for another (a drag from a target handle now created a connection, but with
  `sourceHandle`/`targetHandle` reversed relative to this app's fixed roles, which then failed to *render* -
  `error008` in the console, same failure class as the import bug above, different cause). The real fix:
  `isValidConnection.ts` still rejects a same-role pair (genuinely ambiguous, no fix possible), and a new
  `normalizeConnection.ts` swaps a mixed-role pair back to the correct direction regardless of which end was
  grabbed first. Verified live: the exact drag that used to silently produce 0 edges is now either correctly
  rejected (same-role) or correctly rendered in the right direction (mixed-role, either drag direction).

None of this is an oversight - PLAN.md §6.16 scoped this pass as "requirements + a working prototype of the
UI shell," not a full build. See `docs/KNOWN_ISSUES.md` for the dated entry with full context.
