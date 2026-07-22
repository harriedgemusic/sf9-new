import { describe, it, expect } from 'vitest'
import { getDict, LOCALES, type Locale, type Dict } from '@/lib/i18n'

const ALL_LOCALES: Locale[] = LOCALES.map((l) => l.code)

describe('i18n', () => {
  describe('LOCALES metadata', () => {
    it('has at least 2 locales', () => {
      expect(LOCALES.length).toBeGreaterThanOrEqual(2)
    })

    it('each locale has code, nativeName, and flag', () => {
      for (const l of LOCALES) {
        expect(l.code).toBeTruthy()
        expect(l.nativeName).toBeTruthy()
        expect(l.flag).toBeTruthy()
      }
    })

    it('includes Russian as default', () => {
      expect(ALL_LOCALES).toContain('ru')
    })
  })

  describe('getDict', () => {
    it('returns a dictionary for each supported locale', () => {
      for (const locale of ALL_LOCALES) {
        const dict = getDict(locale)
        expect(dict).toBeDefined()
        expect(typeof dict.appTitle).toBe('string')
        expect(dict.appTitle.length).toBeGreaterThan(0)
      }
    })

    it('falls back to Russian for unknown locale', () => {
      const ruDict = getDict('ru')
      const fallback = getDict('xx' as Locale)
      expect(fallback.appTitle).toBe(ruDict.appTitle)
    })

    it('all locales have the same set of keys', () => {
      const ruDict = getDict('ru')
      const ruKeys = Object.keys(ruDict).sort()

      for (const locale of ALL_LOCALES) {
        if (locale === 'ru') continue
        const dict = getDict(locale)
        const keys = Object.keys(dict).sort()
        expect(keys).toEqual(ruKeys)
      }
    })

    it('no translation value is empty string', () => {
      for (const locale of ALL_LOCALES) {
        const dict = getDict(locale)
        for (const [key, value] of Object.entries(dict)) {
          if (typeof value === 'string') {
            expect(value.length, `${locale}.${key} is empty`).toBeGreaterThan(0)
          }
        }
      }
    })

    it('function-typed dict entries return strings', () => {
      for (const locale of ALL_LOCALES) {
        const dict = getDict(locale)
        // trackCount(n) should return a string
        expect(typeof dict.trackCount(5)).toBe('string')
        expect(typeof dict.archiveCount(3)).toBe('string')
        expect(typeof dict.mp3Count(10)).toBe('string')
      }
    })
  })
})
