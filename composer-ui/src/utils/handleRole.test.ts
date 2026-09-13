import { describe, it, expect } from 'vitest'
import { handleRole } from './handleRole'

describe('handleRole', () => {
  it('identifies the two source-role handle ids', () => {
    expect(handleRole('right')).toBe('source')
    expect(handleRole('bottom')).toBe('source')
  })

  it('identifies the two target-role handle ids', () => {
    expect(handleRole('top')).toBe('target')
    expect(handleRole('left')).toBe('target')
  })

  it('returns null for a missing or unknown handle id', () => {
    expect(handleRole(null)).toBeNull()
    expect(handleRole(undefined)).toBeNull()
    expect(handleRole('')).toBeNull()
    expect(handleRole('not-a-real-handle')).toBeNull()
  })
})
