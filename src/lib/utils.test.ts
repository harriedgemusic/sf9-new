import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn (class name utility)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'end')).toBe('base end')
  })

  it('handles undefined and null', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })

  it('merges tailwind conflicts correctly', () => {
    // tailwind-merge should keep the last conflicting class
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })

  it('handles arrays via clsx', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })
})
