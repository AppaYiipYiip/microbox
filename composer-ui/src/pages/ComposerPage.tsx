import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ReactFlowProvider, useNodesState, useEdgesState, addEdge, getNodesBounds, getViewportForBounds, type Connection, type Edge } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { NodePalette } from '../components/NodePalette'
import { PipelineCanvas } from '../components/PipelineCanvas'
import { TOOL_CATALOG } from '../data/toolCatalog'
import type { ToolNodeType, ToolNodeData } from '../components/ToolNode'
import { updateNodeParam as mergeNodeParam } from '../utils/updateNodeParam'
import { toggleNodeEnabled as toggleNodeEnabledInList } from '../utils/toggleNodeEnabled'
import { nextNodeId } from '../utils/nodeId'
import { EMPTY_HISTORY, pushSnapshot, undo as undoHistory, redo as redoHistory } from '../utils/history'
import { parseCanvasSnapshot, type ImportError } from '../utils/importCanvasSnapshot'
import { KRAKEN2_DB_VARIANTS, conventionalKraken2DbPath } from '../data/kraken2DbVariants'
import { recommendKraken2Db } from '../utils/recommendKraken2Db'
import { estimateDeviceMemoryGiB } from '../utils/estimateDeviceMemory'
import { computeAutoLayout } from '../utils/autoLayout'
import { normalizeConnection } from '../utils/normalizeConnection'
import { convertCanvasToParams } from '../utils/pipelineConverter'
import { deriveToolRunStatuses, type ToolRunStatus } from '../utils/nodeRunStatus'
import { RunStatusContext } from '../components/RunStatusContext'
import './ComposerPage.css'

// Narrower than data/toolCatalog.ts's own ToolFamily ('shared' only makes sense as a
// per-tool tag, never as a whole-canvas selection - there is no "shared" pipeline).
type PipelineFamily = 'metagenomics' | 'wgs'

// React Flow's own per-node `.selected` boolean (what actually drives the
// blue border/resize-handle overlay on the canvas, via NodeProps.selected)
// only stays in sync with our own `selectedNodeId` tracker automatically
// when a SELECTION CHANGE comes from React Flow itself (a real node/pane
// click always also dispatches its own 'select' NodeChange through
// onNodesChange). Any place THIS file changes the selection programmatically
// - duplicate, paste, undo/redo, Escape, the Close button - bypasses that
// dispatch entirely, so without this, the detail panel would silently point
// at the right node while the canvas highlight stayed on the old one (found
// testing paste: pasted a node twice, the panel correctly showed the new
// node but the blue border never left the original). Keeps unaffected node
// object references stable (only remaps entries whose `selected` actually
// needs to change) so it doesn't cause needless re-renders elsewhere.
function withNoSelection(nodes: ToolNodeType[]): ToolNodeType[] {
  return nodes.some((n) => n.selected) ? nodes.map((n) => (n.selected ? { ...n, selected: false } : n)) : nodes
}

// Downloads a JSON snapshot of the canvas via a Blob + temporary <a
// download> - genuinely works client-side, no backend needed for this much.
// Real fidelity requirement (PLAN.md §6.11): a re-imported file must
// reconstruct the canvas exactly, so this includes everything
// importCanvasSnapshot.ts needs to do that - width/height (so a resized node
// comes back the size it was left at, not the default), sourceHandle/
// targetHandle (which of a node's 4 handles a connection actually used -
// omitting these would make every re-imported edge silently snap to
// whichever handle React Flow picks first, not the one originally drawn),
// and enabled (skip state). Named for a human reading the download, not a
// hash, so it's obviously "a microbox pipeline" in a Downloads folder.
function downloadCanvasSnapshot(nodes: ToolNodeType[], edges: Edge[]) {
  const snapshot = {
    formatVersion: 1,
    savedAt: new Date().toISOString(),
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, width: n.width, height: n.height, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
  }
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `microbox-pipeline-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Downloads the canvas as a real PNG - owner 2026-09-13: "we should have an
// option to download it as image." Uses React Flow's own documented pattern
// for this exact feature (reactflow.dev/examples/misc/download-image):
// getNodesBounds/getViewportForBounds compute a viewport that fits every
// node (not just whatever's currently visible/panned-to on screen), and
// html-to-image's toPng renders the real `.react-flow__viewport` DOM node
// (actual node content and edges, not a redrawn approximation) into that
// framing. A generous 100px margin on each side keeps a node's own border
// from getting cropped flush against the image edge.
function downloadCanvasImage(nodes: ToolNodeType[]) {
  const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewportEl || nodes.length === 0) return

  const bounds = getNodesBounds(nodes)
  const imageWidth = Math.round(bounds.width) + 200
  const imageHeight = Math.round(bounds.height) + 200
  const viewport = getViewportForBounds(bounds, imageWidth, imageHeight, 0.1, 2, 0.1)

  toPng(viewportEl, {
    backgroundColor: '#141414',
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  })
    .then((dataUrl) => {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `microbox-pipeline-${Date.now()}.png`
      a.click()
    })
    .catch((error: unknown) => {
      // Deliberately no user-facing error beyond this - a failed image
      // export (an unsupported CSS feature in some node's rendering, a
      // browser quirk) isn't destructive like a failed Save/Import would
      // be; the canvas itself is completely unaffected either way. Still
      // logged, not swallowed outright, in case it needs debugging later.
      console.error('Composer image export failed', error)
    })
}

function ComposerInner() {
  const { t } = useTranslation()
  const [nodes, setNodes, onNodesChange] = useNodesState<ToolNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  // Tracks the selected NODE instance, not just its tool type - two nodes
  // of the same tool can hold different parameter values, so the detail/
  // edit panel needs to know exactly which node is selected, not just
  // which kind of tool it is (corrected 2026-09-13 alongside adding
  // per-node parameter editing).
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedTool = selectedNode ? TOOL_CATALOG.find((tool) => tool.id === selectedNode.data.toolId) : null

  // Full-UI-architecture Phase 3, item 1: which fixed pipeline shape the converter
  // targets and the palette filters to (default matches nextflow.config's own
  // params.pipeline default). Switching family does NOT remove existing canvas nodes
  // from the other family - the converter (utils/pipelineConverter.ts) simply ignores
  // any node whose tool isn't in the currently-selected family, same as it already
  // ignores a disabled node. A user switching families mid-build keeps their old
  // nodes visible (nothing destructive happens silently) but should expect them to
  // have no effect on the launched run until they switch back.
  const [pipelineFamily, setPipelineFamily] = useState<PipelineFamily>('metagenomics')

  // Kraken2 DB variant helper (owner, 2026-09-13: "let the user select
  // which version they want, and have one written as (recommended) based
  // on their hardware. we automatically detect their hardware
  // capabilities."). `deviceMemoryGiB` is read once (it can't change at
  // runtime) via navigator.deviceMemory - Chromium-only, and capped at 8 by
  // the browser for privacy, so it's used only to PRE-FILL an editable
  // input, never shown as an authoritative reading (estimateDeviceMemory.ts
  // has the full explanation). `kraken2RamInput` stays a string so the
  // field can be genuinely empty (browser didn't/couldn't detect anything)
  // rather than defaulting to a misleading 0 or a guessed number.
  const [deviceMemoryGiB] = useState(estimateDeviceMemoryGiB)
  const [kraken2RamInput, setKraken2RamInput] = useState(() => (deviceMemoryGiB !== null ? String(deviceMemoryGiB) : ''))
  const kraken2RamGiB = Number.parseFloat(kraken2RamInput)
  const recommendedKraken2Db = Number.isFinite(kraken2RamGiB) && kraken2RamGiB > 0 ? recommendKraken2Db(kraken2RamGiB) : null

  // Undo/redo (owner feedback 2026-09-13: "many quality of life elements").
  // A snapshot is the canvas state right BEFORE the mutation about to be
  // applied - taken explicitly at each user-initiated structural edit (add
  // node, delete, duplicate, connect, drag-start) rather than on every low-
  // level onNodesChange/onEdgesChange call, which would otherwise push a
  // new history entry per pixel of a drag. Deliberately does NOT cover
  // in-progress param edits or node resizing yet - narrower scope than "undo
  // literally everything," documented in composer-ui/README.md.
  const [history, setHistory] = useState(EMPTY_HISTORY)
  const takeSnapshot = useCallback(() => setHistory((h) => pushSnapshot(h, { nodes, edges })), [nodes, edges])

  const handleUndo = useCallback(() => {
    const result = undoHistory(history, { nodes, edges })
    if (!result) return
    setHistory(result.history)
    setNodes(withNoSelection(result.snapshot.nodes))
    setEdges(result.snapshot.edges)
    setSelectedNodeId(null)
  }, [history, nodes, edges, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    const result = redoHistory(history, { nodes, edges })
    if (!result) return
    setHistory(result.history)
    setNodes(withNoSelection(result.snapshot.nodes))
    setEdges(result.snapshot.edges)
    setSelectedNodeId(null)
  }, [history, nodes, edges, setNodes, setEdges])

  // New edges are explicitly typed 'deletable' (DeletableEdge, the X-on-
  // click component) rather than relying on ReactFlow's defaultEdgeOptions
  // prop to apply automatically through this custom onConnect handler -
  // addEdge() is a plain utility function and doesn't know about that prop
  // on its own, so it's set here directly to be certain, not assumed.
  const onConnect = useCallback(
    (connection: Connection) => {
      takeSnapshot()
      // See normalizeConnection.ts - loose connectionMode lets a drag start
      // from either a target or a source handle, so the raw connection can
      // come back with source/target reversed relative to our fixed
      // top/left=target, right/bottom=source roles; this puts it back.
      setEdges((eds) => addEdge({ ...normalizeConnection(connection), type: 'deletable' }, eds))
    },
    [takeSnapshot, setEdges],
  )

  // onBeforeDelete is the one React Flow hook guaranteed to run before a
  // Delete/Backspace-key or edge-"x" removal is actually applied to state -
  // used here purely to snapshot; always allows the deletion through.
  const handleBeforeDelete = useCallback(async () => {
    takeSnapshot()
    return true
  }, [takeSnapshot])

  const handleNodesDelete = useCallback(
    (deleted: ToolNodeType[]) => {
      if (deleted.some((n) => n.id === selectedNodeId)) setSelectedNodeId(null)
    },
    [selectedNodeId],
  )

  const updateNodeParam = useCallback(
    (nodeId: string, key: string, value: string) => setNodes((nds) => mergeNodeParam(nds, nodeId, key, value)),
    [setNodes],
  )

  // Enabled/skipped state (PLAN.md §6.11: node state "needs to be visible,
  // not just silently enforced") - toggled from the detail panel; the
  // resulting dimmed styling + badge render directly on the canvas node
  // itself regardless of selection (ToolNode.tsx), so it's visible without
  // needing to click back into the panel.
  const toggleNodeEnabled = useCallback(
    (nodeId: string) => {
      takeSnapshot()
      setNodes((nds) => toggleNodeEnabledInList(nds, nodeId))
    },
    [takeSnapshot, setNodes],
  )

  // Duplicates the selected node's tool + params (not its connections - a
  // copy that inherited its source's edges would silently create a second
  // pipeline branch the user didn't ask for). Offset so the copy doesn't
  // land exactly on top of the original and is immediately draggable apart.
  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      takeSnapshot()
      const newNode: ToolNodeType = {
        ...node,
        id: nextNodeId(),
        position: { x: node.position.x + 24, y: node.position.y + 24 },
        selected: true,
      }
      // The new node becomes the selection - deselect whatever was
      // selected before it in the same update (see withNoSelection above).
      setNodes((nds) => [...withNoSelection(nds), newNode])
      setSelectedNodeId(newNode.id)
    },
    [nodes, takeSnapshot, setNodes],
  )

  // Auto-arrange (PLAN.md §6.16 canvas nice-to-have: "auto-layout/auto-
  // arrange"). Only repositions nodes - never touches connections/params/
  // enabled state - and takes a history snapshot first like every other
  // mutation here, so a layout the user doesn't like is one Ctrl+Z away
  // from being undone.
  const autoArrange = useCallback(() => {
    const positions = computeAutoLayout(nodes, edges)
    if (Object.keys(positions).length === 0) return
    takeSnapshot()
    setNodes((nds) => nds.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n)))
  }, [nodes, edges, takeSnapshot, setNodes])

  // Copy/cut/paste (owner, 2026-09-13: "i assume ctrl+c or x or z or r are
  // working") - scoped to the single selected node, same as Duplicate, not
  // the whole multi-selection, so it doesn't introduce a second, different
  // notion of "the current selection." Clipboard lives in component state,
  // not the real OS clipboard - pasting into a different tab/session isn't
  // a requirement here, and the Clipboard API would need its own permission
  // prompt for no real benefit. pasteOffset staircases repeated pastes from
  // the same copy apart instead of stacking them exactly on top of each
  // other; resets whenever something new is copied/cut.
  const [clipboard, setClipboard] = useState<{ data: ToolNodeData; position: { x: number; y: number }; width?: number; height?: number } | null>(null)
  const [pasteOffset, setPasteOffset] = useState(0)

  const copyNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      setClipboard({ data: { ...node.data, params: { ...node.data.params } }, position: node.position, width: node.width, height: node.height })
      setPasteOffset(0)
    },
    [nodes],
  )

  const pasteClipboard = useCallback(() => {
    if (!clipboard) return
    takeSnapshot()
    const offset = 24 * (pasteOffset + 1)
    const newNode: ToolNodeType = {
      id: nextNodeId(),
      type: 'tool',
      position: { x: clipboard.position.x + offset, y: clipboard.position.y + offset },
      width: clipboard.width,
      height: clipboard.height,
      data: { ...clipboard.data, params: { ...clipboard.data.params } },
      selected: true,
    }
    setNodes((nds) => [...withNoSelection(nds), newNode])
    setSelectedNodeId(newNode.id)
    setPasteOffset((n) => n + 1)
  }, [clipboard, pasteOffset, takeSnapshot, setNodes])

  const cutNode = useCallback(
    (nodeId: string) => {
      copyNode(nodeId)
      takeSnapshot()
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setSelectedNodeId(null)
    },
    [copyNode, takeSnapshot, setNodes, setEdges],
  )

  // Deselects everything - both our own tracker (closes the detail panel)
  // and every node's underlying `.selected` flag (clears the canvas
  // highlight); see withNoSelection above for why both are needed.
  const clearSelection = useCallback(() => {
    setSelectedNodeId(null)
    setNodes(withNoSelection)
  }, [setNodes])

  // Keyboard shortcuts (PLAN.md §6.16 canvas nice-to-have: "keyboard
  // shortcuts") - all skipped while focus is inside a text field so the
  // browser's own native behavior (e.g. text-field undo) still works for
  // in-progress param edits, and none of them fire on a bare keypress
  // without a modifier except Escape, which only acts when something is
  // actually selected.
  //   Ctrl/Cmd+Z          undo
  //   Ctrl/Cmd+Shift+Z/Y  redo
  //   Ctrl/Cmd+D          duplicate the selected node (mirrors the
  //                       detail panel's own Duplicate button)
  //   Ctrl/Cmd+C/X/V      copy/cut/paste the selected node
  //   Escape              close the detail panel / clear selection
  // Deliberately NOT bound: Ctrl/Cmd+R (browser refresh) - hijacking a
  // fundamental browser affordance like page refresh is a materially
  // different, more invasive choice than the others above (all of which
  // shadow browser shortcuts with no real everyday use inside this app -
  // bookmarking a SPA route, "find in page" isn't wired to anything here);
  // left alone unless there's a specific feature it should actually do.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target
      const isEditableTarget = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isEditableTarget) return

      if (event.key === 'Escape') {
        if (selectedNodeId) clearSelection()
        return
      }

      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        handleUndo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        handleRedo()
      } else if (key === 'd') {
        // preventDefault is load-bearing here, not just tidy - Ctrl/Cmd+D is
        // the browser's own "bookmark this page" shortcut; without it,
        // duplicating a node would also pop open the browser's bookmark
        // dialog.
        event.preventDefault()
        if (selectedNodeId) duplicateNode(selectedNodeId)
      } else if (key === 'c') {
        // Don't hijack a normal text-copy just because a node also happens
        // to be selected (e.g. the user selected the page title and
        // pressed Ctrl+C) - only intercept when there's no active text
        // selection to copy instead.
        if (selectedNodeId && !window.getSelection()?.toString()) {
          event.preventDefault()
          copyNode(selectedNodeId)
        }
      } else if (key === 'x') {
        if (selectedNodeId) {
          event.preventDefault()
          cutNode(selectedNodeId)
        }
      } else if (key === 'v') {
        event.preventDefault()
        pasteClipboard()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo, duplicateNode, copyNode, cutNode, pasteClipboard, clearSelection, selectedNodeId])

  // Import (PLAN.md §6.11: "save/import/export a pipeline configuration as a
  // portable file"). A hidden <input type="file"> triggered by the visible
  // toolbar button - the standard way to get a real file picker without
  // reimplementing browser chrome. Parsing/validation lives in
  // importCanvasSnapshot.ts (pure, unit-tested); this handler is just the
  // FileReader/DOM plumbing around it, verified live in-browser instead
  // (same split as every other browser-only interaction this project can't
  // faithfully simulate in jsdom).
  const [importError, setImportError] = useState<ImportError | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportClick = useCallback(() => fileInputRef.current?.click(), [])

  const handleImportFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = '' // allow re-importing the same filename consecutively
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        const result = parseCanvasSnapshot(String(reader.result))
        if (!result.ok) {
          setImportError(result.error)
          return
        }
        setImportError(null)
        // Replacing the whole canvas is a real, deliberate "Load a file"
        // action (the user just picked one on purpose) - but it's still a
        // destructive overwrite of whatever was on the canvas before, so it
        // gets a history snapshot first like every other mutation here: one
        // Ctrl+Z instantly recovers the pre-import canvas if this wasn't
        // what they meant to do.
        takeSnapshot()
        setNodes(result.nodes)
        setEdges(result.edges)
        setSelectedNodeId(null)
      }
      reader.onerror = () => setImportError('invalid-json')
      reader.readAsText(file)
    },
    [takeSnapshot, setNodes, setEdges],
  )

  // Full-UI-architecture Phase 3, item 2: the real samplesheet input step Composer had
  // no equivalent of before this - the canvas only ever held tool nodes/params, never a
  // file to actually run against. A per-tool DB/reference-path param (wgs_reference_fasta
  // included, same treatment as bowtie2's existing host_fasta) is a host filesystem path
  // the pipeline reads directly, not something that needs uploading - only the reads
  // samplesheet CSV itself does, since bin/run.sh takes it as a real file argument
  // (POST /api/runs's own `samplesheet: UploadFile`, server/main.py).
  const [runDialogOpen, setRunDialogOpen] = useState(false)
  const [runSamplesheet, setRunSamplesheet] = useState<File | null>(null)
  const [runProfile, setRunProfile] = useState<'dev' | 'test' | 'prod'>('test')
  const [runState, setRunState] = useState<
    { status: 'idle' | 'submitting' } | { status: 'error'; message: string } | { status: 'success'; runId: string }
  >({ status: 'idle' })

  const openRunDialog = useCallback(() => {
    setRunState({ status: 'idle' })
    setRunDialogOpen(true)
  }, [])

  const closeRunDialog = useCallback(() => {
    setRunDialogOpen(false)
    setRunSamplesheet(null)
    setRunState({ status: 'idle' })
  }, [])

  // Full-UI-architecture Phase 4 ("per-node live status on the canvas"): once a run has
  // actually launched, poll its real status and highlight the canvas - same 5s cadence
  // as Run History's own live poll (HistoryPage.tsx), and the same rationale: short
  // enough to feel live, long enough not to hammer the backend for a single local user.
  // `activeRunId` is set on a successful launch and cleared once the run reaches a
  // terminal state (or the user starts a new one) - polling an already-finished run
  // forever would be pure waste.
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [toolRunStatuses, setToolRunStatuses] = useState<Record<string, ToolRunStatus>>({})

  useEffect(() => {
    if (!activeRunId) return
    let cancelled = false
    const poll = () => {
      fetch(`/api/runs/${activeRunId}`)
        .then((response) => {
          if (!response.ok) throw new Error('status check failed')
          return response.json() as Promise<{ status: string; processes: Record<string, string> }>
        })
        .then((data) => {
          if (cancelled) return
          setToolRunStatuses(deriveToolRunStatuses(data.processes))
          if (data.status === 'completed' || data.status === 'failed') setActiveRunId(null)
        })
        // A transient network hiccup shouldn't kill the whole polling loop - just skip
        // this tick and try again next interval, same as HistoryPage's own loadRuns.
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [activeRunId])

  const launchRun = useCallback(() => {
    if (!runSamplesheet) {
      setRunState({ status: 'error', message: t('composer.runDialog.needsSamplesheet') })
      return
    }
    setRunState({ status: 'submitting' })
    setToolRunStatuses({}) // a fresh launch starts with a clean canvas, not the last run's leftover badges
    const params = convertCanvasToParams(pipelineFamily, nodes)
    const body = new FormData()
    body.set('samplesheet', runSamplesheet)
    body.set('profile', runProfile)
    body.set('pipeline', pipelineFamily)
    body.set('params', JSON.stringify(params))

    fetch('/api/runs', { method: 'POST', body })
      .then((response) => {
        if (!response.ok) throw new Error('launch failed')
        return response.json() as Promise<{ run_id: string; pid: number }>
      })
      .then((data) => {
        setRunState({ status: 'success', runId: data.run_id })
        setActiveRunId(data.run_id)
      })
      .catch(() => setRunState({ status: 'error', message: t('composer.runDialog.error') }))
  }, [runSamplesheet, runProfile, pipelineFamily, nodes, t])

  return (
    <div className="composer-page">
      <div className="composer-page__toolbar">
        <h1 className="composer-page__title">{t('composer.title')}</h1>
        <label className="composer-page__family">
          <span>{t('composer.familyLabel')}</span>
          <select value={pipelineFamily} onChange={(e) => setPipelineFamily(e.target.value as PipelineFamily)}>
            <option value="metagenomics">{t('composer.familyMetagenomics')}</option>
            <option value="wgs">{t('composer.familyWgs')}</option>
          </select>
        </label>
        <div className="composer-page__actions">
          <button
            type="button"
            className="composer-page__btn composer-page__btn--icon"
            title={`${t('composer.undo')} (Ctrl+Z)`}
            aria-label={t('composer.undo')}
            disabled={history.past.length === 0}
            onClick={handleUndo}
          >
            ↺
          </button>
          <button
            type="button"
            className="composer-page__btn composer-page__btn--icon"
            title={`${t('composer.redo')} (Ctrl+Shift+Z)`}
            aria-label={t('composer.redo')}
            disabled={history.future.length === 0}
            onClick={handleRedo}
          >
            ↻
          </button>
          <button
            type="button"
            className="composer-page__btn"
            title={t('composer.autoArrangeHint')}
            disabled={nodes.length === 0}
            onClick={autoArrange}
          >
            {t('composer.autoArrange')}
          </button>
          <button
            type="button"
            className="composer-page__btn"
            title={t('composer.saveHint')}
            onClick={() => downloadCanvasSnapshot(nodes, edges)}
          >
            {t('composer.save')}
          </button>
          <button
            type="button"
            className="composer-page__btn"
            title={t('composer.downloadImageHint')}
            disabled={nodes.length === 0}
            onClick={() => downloadCanvasImage(nodes)}
          >
            {t('composer.downloadImage')}
          </button>
          <button type="button" className="composer-page__btn" title={t('composer.importHint')} onClick={handleImportClick}>
            {t('composer.import')}
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
          <button
            type="button"
            className="composer-page__btn composer-page__btn--primary"
            disabled={nodes.length === 0}
            title={nodes.length === 0 ? t('composer.runDisabledHint') : undefined}
            onClick={openRunDialog}
          >
            {t('composer.run')}
          </button>
        </div>
      </div>
      {runDialogOpen && (
        <div className="composer-page__warning" role="dialog" aria-label={t('composer.runDialog.title')}>
          <p className="composer-page__warning-title">{t('composer.runDialog.title')}</p>
          {runState.status === 'success' ? (
            <>
              <p>{t('composer.runDialog.success', { runId: runState.runId })}</p>
              <div className="composer-page__actions">
                <Link className="composer-page__btn" to="/history">
                  {t('composer.runDialog.viewHistory')}
                </Link>
                <button type="button" className="composer-page__btn" onClick={closeRunDialog}>
                  {t('composer.runDialog.cancel')}
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="composer-page__param-field">
                <span>{t('composer.runDialog.samplesheetLabel')}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setRunSamplesheet(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="composer-page__param-field">
                <span>{t('composer.runDialog.profileLabel')}</span>
                <select value={runProfile} onChange={(e) => setRunProfile(e.target.value as 'dev' | 'test' | 'prod')}>
                  <option value="dev">{t('composer.runDialog.profileDev')}</option>
                  <option value="test">{t('composer.runDialog.profileTest')}</option>
                  <option value="prod">{t('composer.runDialog.profileProd')}</option>
                </select>
              </label>
              {runState.status === 'error' && <p className="composer-page__warning-title">{runState.message}</p>}
              <div className="composer-page__actions">
                <button type="button" className="composer-page__btn" onClick={closeRunDialog}>
                  {t('composer.runDialog.cancel')}
                </button>
                <button
                  type="button"
                  className="composer-page__btn composer-page__btn--primary"
                  disabled={runState.status === 'submitting'}
                  onClick={launchRun}
                >
                  {runState.status === 'submitting' ? t('composer.runDialog.launching') : t('composer.runDialog.launch')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {importError && (
        <div className="composer-page__warning composer-page__warning--error" role="alert">
          <p className="composer-page__warning-title">{t(`composer.importError.${importError}`)}</p>
        </div>
      )}
      <div className="composer-page__layout">
        <div className="composer-page__canvas-area">
          <RunStatusContext.Provider value={toolRunStatuses}>
            <PipelineCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectNode={setSelectedNodeId}
              onBeforeDelete={handleBeforeDelete}
              onNodesDelete={handleNodesDelete}
              onNodeDragStart={takeSnapshot}
              onSelectionDragStart={takeSnapshot}
              onBeforeAddNode={takeSnapshot}
            />
          </RunStatusContext.Provider>
          {selectedNode && selectedTool && (
            <aside className="composer-page__detail" aria-label={t('composer.nodeSelected')}>
              <div className="composer-page__detail-actions">
                <button type="button" className="composer-page__detail-duplicate" title="Ctrl+D" onClick={() => duplicateNode(selectedNode.id)}>
                  {t('composer.duplicate')}
                </button>
                <button type="button" className="composer-page__detail-close" onClick={clearSelection}>
                  {t('composer.clearSelection')}
                </button>
              </div>
              <h3>{t(selectedTool.nameKey)}</h3>
              <p>{t(selectedTool.descriptionKey)}</p>
              <label className="composer-page__enabled-toggle">
                <input
                  type="checkbox"
                  checked={selectedNode.data.enabled !== false}
                  onChange={() => toggleNodeEnabled(selectedNode.id)}
                />
                {t('composer.enabled')}
              </label>
              {selectedTool.params && selectedTool.params.length > 0 ? (
                <form className="composer-page__params" onSubmit={(e) => e.preventDefault()}>
                  {selectedTool.params.map((param) => (
                    <label key={param.key} className="composer-page__param-field">
                      <span>{t(param.labelKey)}</span>
                      <input
                        type="text"
                        value={selectedNode.data.params[param.key] ?? ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, param.key, e.target.value)}
                      />
                    </label>
                  ))}
                </form>
              ) : (
                <p className="composer-page__no-params">{t('composer.noParams')}</p>
              )}
              {selectedTool.id === 'kraken2' && (
                <div className="composer-page__kraken2-helper">
                  <label className="composer-page__param-field">
                    <span>{t('composer.kraken2.ramLabel')}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={kraken2RamInput}
                      onChange={(e) => setKraken2RamInput(e.target.value)}
                    />
                  </label>
                  <p className="composer-page__kraken2-hint">
                    {deviceMemoryGiB !== null ? t('composer.kraken2.ramAutoHint') : t('composer.kraken2.ramManualHint')}
                  </p>
                  <ul className="composer-page__kraken2-variants">
                    {KRAKEN2_DB_VARIANTS.map((variant) => {
                      const isRecommended = recommendedKraken2Db?.id === variant.id
                      return (
                        <li
                          key={variant.id}
                          className={isRecommended ? 'composer-page__kraken2-variant composer-page__kraken2-variant--recommended' : 'composer-page__kraken2-variant'}
                        >
                          <div className="composer-page__kraken2-variant-header">
                            <strong>{t(variant.nameKey)}</strong>
                            {isRecommended && <span className="composer-page__kraken2-badge">{t('composer.kraken2.recommended')}</span>}
                            {!variant.wired && (
                              <span className="composer-page__kraken2-badge composer-page__kraken2-badge--planned">
                                {t('composer.kraken2.notYetAvailable')}
                              </span>
                            )}
                          </div>
                          <p>{t(variant.descriptionKey)}</p>
                          <p className="composer-page__kraken2-ram">{t('composer.kraken2.ramRequirement', { ram: variant.ramGiB })}</p>
                          {variant.wired && (
                            <button
                              type="button"
                              className="composer-page__kraken2-use-path"
                              onClick={() => updateNodeParam(selectedNode.id, 'kraken2_db', conventionalKraken2DbPath(variant.id))}
                            >
                              {t('composer.kraken2.usePath')}
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </aside>
          )}
        </div>
        <NodePalette family={pipelineFamily} />
      </div>
    </div>
  )
}

export function ComposerPage() {
  return (
    <ReactFlowProvider>
      <ComposerInner />
    </ReactFlowProvider>
  )
}
