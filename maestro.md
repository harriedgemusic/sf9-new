# Maestro Workflow Context — Beatspotto (sf9-new)
Updated: 2026-07-23

## Detailed Architecture & Context
For the comprehensive project topology, module relationships, and data flow map, see:
👉 [.maestro/context.md](file:///Users/harriedgemusic/Documents/repos/sf9-new/.maestro/context.md)

## Models & Environment
- **Primary Model**: Gemini 3.6 Flash
- **Environment**: IDE Agent Environment
- **Context Window**: ~1,000,000 tokens

## High-Level Architecture & Modules
- **Frontend UI**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Shadcn UI, Zustand.
- **API & SSE Layer**: Next.js API Routes, Server-Sent Events (`EventEmitter`), Prisma ORM (`MySQL`).
- **Core Jobs Engine**: Per-user `JobsManager` singleton (`src/lib/jobs.ts`), `process-runner.ts` (Layer 5 Timeout Controls), `log-buffer.ts`, `file-manager.ts`.
- **Processing Scripts**: Python 3 (`spotify_dl.py`, `simple_dl.py`, `lossless_core.py`), `yt-dlp`, Mutagen ID3 tagger, Go decryptor (`go-decryptor/`).

## Quality & Test Baseline
- **Automated Tests**: Vitest 4 suite (97/97 tests passing across 9 test files).
- **Core Objective**: Zero code regressions during refactoring and feature implementation.
