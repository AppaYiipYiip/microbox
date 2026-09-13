import { describe, it, expect, afterEach } from 'vitest'
import { estimateDeviceMemoryGiB } from './estimateDeviceMemory'

describe('estimateDeviceMemoryGiB', () => {
  afterEach(() => {
    // @ts-expect-error - test-only cleanup of a property we may have added
    delete navigator.deviceMemory
  })

  it('returns the browser-reported value when supported', () => {
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true })
    expect(estimateDeviceMemoryGiB()).toBe(8)
  })

  it('returns null when the browser does not support the Device Memory API', () => {
    expect(estimateDeviceMemoryGiB()).toBeNull()
  })
})
