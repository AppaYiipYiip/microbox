import '@testing-library/jest-dom/vitest'

// React Flow (used by PipelineCanvas) reads ResizeObserver at module init
// time, which jsdom doesn't implement - found the hard way running the
// first component test that imported it. A no-op stub was the first fix,
// but that left nodes permanently "unmeasured" (jsdom has no real layout
// engine to report real dimensions) - React Flow needs a node's measured
// size before it will render edges connected to it or register its click
// handlers correctly, which silently broke a later edge-deletion test and
// a node-click test (found by actually running them, not assumed). Fixed
// properly: synchronously report a fake-but-real size on observe(), the
// same fix xyflow's own testing guidance and community examples use.
class ResizeObserverStub {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    const entry = {
      target,
      contentRect: { width: 150, height: 50, top: 0, left: 0, bottom: 50, right: 150, x: 0, y: 0, toJSON: () => ({}) },
    } as ResizeObserverEntry
    this.callback([entry], this as unknown as ResizeObserver)
  }

  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub

// jsdom also doesn't implement DOMMatrixReadOnly, which React Flow's node-
// measurement code uses to read the current zoom level out of a CSS
// transform string (`new DOMMatrixReadOnly(style.transform).m22`) -
// surfaced only once the ResizeObserver fix above let measurement actually
// run. A minimal stub reading just the `m22` (vertical scale) component a
// real DOMMatrix would report is enough; nothing else here reads any other
// property of it.
class DOMMatrixReadOnlyStub {
  m22: number
  constructor(transform?: string) {
    const match = transform?.match(/matrix\(([^)]+)\)/)
    const values = match?.[1].split(',').map((v) => Number.parseFloat(v.trim()))
    this.m22 = values?.[3] ?? 1
  }
}
globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyStub as unknown as typeof DOMMatrixReadOnly
