import { describe, it, expect } from 'vitest'
import { formatDuration, formatSize, needsExtendedMix, trackId, findDownloadedFileForTrack } from '@/lib/track-utils'
import type { Track } from '@/lib/spotify-types'

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    title: 'Test Track',
    artist: 'Test Artist',
    duration_ms: 300000, // 5:00
    cover_url: null,
    spotify_url: null,
    track_id: null,
    ...overrides,
  }
}

describe('formatDuration', () => {
  it('formats milliseconds to m:ss', () => {
    expect(formatDuration(180000)).toBe('3:00')  // 3 min
    expect(formatDuration(65000)).toBe('1:05')   // 1:05
    expect(formatDuration(7000)).toBe('0:07')    // 7 sec
  })

  it('returns --:-- for 0', () => {
    expect(formatDuration(0)).toBe('--:--')
  })

  it('handles large durations', () => {
    expect(formatDuration(600000)).toBe('10:00')   // 10 min
    expect(formatDuration(3600000)).toBe('60:00')  // 1 hour
  })

  it('pads seconds correctly', () => {
    expect(formatDuration(61000)).toBe('1:01')
    expect(formatDuration(62000)).toBe('1:02')
    expect(formatDuration(69000)).toBe('1:09')
  })
})

describe('formatSize', () => {
  it('formats bytes', () => {
    expect(formatSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(2560)).toBe('2.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatSize(1048576)).toBe('1.00 MB')
    expect(formatSize(5242880)).toBe('5.00 MB')
  })

  it('handles 0 bytes', () => {
    expect(formatSize(0)).toBe('0 B')
  })
})

describe('needsExtendedMix', () => {
  it('returns true for short tracks (< 4:30)', () => {
    // 4 minutes = 240000 ms
    expect(needsExtendedMix(makeTrack({ duration_ms: 240000 }))).toBe(true)
  })

  it('returns false for long tracks without keywords', () => {
    // 6 minutes = 360000 ms
    expect(needsExtendedMix(makeTrack({ duration_ms: 360000 }))).toBe(false)
  })

  it('returns true for tracks with "Radio Edit" in title', () => {
    expect(needsExtendedMix(makeTrack({
      duration_ms: 360000,
      title: 'Song Name (Radio Edit)',
    }))).toBe(true)
  })

  it('returns true for tracks with "mixed" keyword', () => {
    expect(needsExtendedMix(makeTrack({
      duration_ms: 360000,
      title: 'Song Name - Mixed',
    }))).toBe(true)
  })

  it('returns true for tracks with "cut" keyword', () => {
    expect(needsExtendedMix(makeTrack({
      duration_ms: 360000,
      title: 'Song Name (Cut)',
    }))).toBe(true)
  })

  it('returns false for 0 duration', () => {
    expect(needsExtendedMix(makeTrack({ duration_ms: 0 }))).toBe(false)
  })

  it('boundary: exactly 4:30 (270000 ms) is not short', () => {
    // duration_ms / 1000 = 270 which is NOT less than 270
    expect(needsExtendedMix(makeTrack({
      duration_ms: 270000,
      title: 'Normal Title',
    }))).toBe(false)
  })

  it('boundary: 4:29 (269000 ms) IS short', () => {
    expect(needsExtendedMix(makeTrack({
      duration_ms: 269000,
      title: 'Normal Title',
    }))).toBe(true)
  })
})

describe('trackId', () => {
  it('uses track_id when available', () => {
    expect(trackId(makeTrack({ track_id: 'abc123' }))).toBe('abc123')
  })

  it('falls back to "artist - title" when track_id is null', () => {
    expect(trackId(makeTrack({ track_id: null }))).toBe('Test Artist - Test Track')
  })

  it('falls back to "artist - title" when track_id is empty string', () => {
    expect(trackId(makeTrack({ track_id: '' }))).toBe('Test Artist - Test Track')
  })
})

describe('findDownloadedFileForTrack', () => {
  const files = [
    { name: 'David Guetta - Titanium (Extended Mix).mp3' },
    { name: 'Calvin Harris - Summer.wav' },
    { name: 'Avicii - Levels.mp3' },
  ]

  it('matches track by artist and title in filename', () => {
    const track = makeTrack({ artist: 'David Guetta', title: 'Titanium' })
    const result = findDownloadedFileForTrack(track, files)
    expect(result).toBeDefined()
    expect(result?.name).toBe('David Guetta - Titanium (Extended Mix).mp3')
  })

  it('matches knownFilename directly if present', () => {
    const track = makeTrack({ artist: 'Calvin Harris', title: 'Summer' })
    const result = findDownloadedFileForTrack(track, files, 'Calvin Harris - Summer.wav')
    expect(result?.name).toBe('Calvin Harris - Summer.wav')
  })

  it('returns undefined if no matching file exists', () => {
    const track = makeTrack({ artist: 'Unknown Artist', title: 'Unknown Track' })
    const result = findDownloadedFileForTrack(track, files)
    expect(result).toBeUndefined()
  })

  it('returns undefined if files array is empty', () => {
    const track = makeTrack({ artist: 'Avicii', title: 'Levels' })
    expect(findDownloadedFileForTrack(track, [])).toBeUndefined()
  })
})

