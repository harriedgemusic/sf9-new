/**
 * Maestro Guardrails & Safety Module - Input Guards, Output Guards, PII Masking, Cost & Permission Controls.
 *
 * Implements safety boundaries for AI agents and application workflows:
 *  - Threat 1: Prompt Injection & Malicious Input Sanitization
 *  - Threat 2: PII & Credential Leakage Prevention
 *  - Threat 3: Cost Explosion & Budget Enforcement
 *  - Threat 4: Unauthorized & Destructive Action Controls
 */

import { ValidationError } from './resilience'

// ---------------------------------------------------------------------------
// 1. Input Guards & Injection Defense
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /ignore\s+all\s+prior\s+directives/i,
  /system\s+prompt\s+override/i,
  /you\s+are\s+now\s+in\s+dan\s+mode/i,
  /reveal\s+(?:your\s+)?system\s+prompt/i,
  /jailbreak/i,
]

export function sanitizePrompt(input: string): string {
  if (!input || typeof input !== 'string') return ''

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      throw new ValidationError('Potential prompt injection attack detected')
    }
  }

  return input
}

// ---------------------------------------------------------------------------
// 2. Output Guards & PII Masking
// ---------------------------------------------------------------------------

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  apiKey: /(?:ghp_[a-zA-Z0-9]{36}|sk-[a-zA-Z0-9]{32,}|bearer\s+[a-zA-Z0-9._-]{20,})/gi,
  creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
}

export function maskPII(text: string): string {
  if (!text || typeof text !== 'string') return ''

  return text
    .replace(PII_PATTERNS.apiKey, '[REDACTED_API_KEY]')
    .replace(PII_PATTERNS.email, '[REDACTED_EMAIL]')
    .replace(PII_PATTERNS.creditCard, '[REDACTED_CARD_NUMBER]')
}

// ---------------------------------------------------------------------------
// 3. Cost & Budget Guards
// ---------------------------------------------------------------------------

export interface CostGuardConfig {
  maxDailyBudgetUsd: number
  maxPerRequestBudgetUsd: number
}

export class CostGuard {
  private spentTodayUsd = 0
  private lastResetDate: string = new Date().toISOString().split('T')[0]

  constructor(private config: CostGuardConfig) {}

  private checkDailyReset() {
    const today = new Date().toISOString().split('T')[0]
    if (today !== this.lastResetDate) {
      this.spentTodayUsd = 0
      this.lastResetDate = today
    }
  }

  checkAndTrackCost(estimatedCostUsd: number) {
    this.checkDailyReset()

    if (estimatedCostUsd > this.config.maxPerRequestBudgetUsd) {
      throw new ValidationError(
        `Estimated request cost ($${estimatedCostUsd.toFixed(4)}) exceeds per-request limit ($${this.config.maxPerRequestBudgetUsd})`
      )
    }

    if (this.spentTodayUsd + estimatedCostUsd > this.config.maxDailyBudgetUsd) {
      throw new ValidationError(
        `Estimated request cost ($${estimatedCostUsd.toFixed(4)}) exceeds remaining daily budget ($${(this.config.maxDailyBudgetUsd - this.spentTodayUsd).toFixed(4)})`
      )
    }

    this.spentTodayUsd += estimatedCostUsd
  }

  getSpentTodayUsd(): number {
    this.checkDailyReset()
    return this.spentTodayUsd
  }
}

// ---------------------------------------------------------------------------
// 4. Permission & Action Guards
// ---------------------------------------------------------------------------

const DESTRUCTIVE_COMMAND_PATTERNS = [
  /rm\s+-rf/i,
  /drop\s+database/i,
  /prisma\s+migrate\s+reset/i,
  /format\s+[a-z]:/i,
]

export function isDestructiveOperation(command: string): boolean {
  if (!command || typeof command !== 'string') return false
  return DESTRUCTIVE_COMMAND_PATTERNS.some((pattern) => pattern.test(command))
}

export function checkPermission(userRole: string, allowedRoles: string[], actionName: string) {
  if (!allowedRoles.includes(userRole)) {
    throw new ValidationError(`Role '${userRole}' is not authorized to execute action '${actionName}'`)
  }
}
