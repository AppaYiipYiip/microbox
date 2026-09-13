import '@testing-library/jest-dom/vitest'

// React Flow (used by PipelineCanvas) reads ResizeObserver at module init
// time, which jsdom doesn't implement - found the hard way running the
// first component test that imported it. A minimal no-op stub is the
// standard workaround for testing React Flow-based components.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub
