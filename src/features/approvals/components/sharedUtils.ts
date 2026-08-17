import { formatDate } from '../../../utils/formatDate'
import type { ApprovalWorkflowStatus } from '../types/approval.types'

export const workflowStatuses: ApprovalWorkflowStatus[] = [
  'ACTIVE',
  'DRAFT',
  'INACTIVE',
  'ARCHIVED',
]

// ─── Pure Utility Functions ───────────────────────────────────────────────────

export function humanizeCode(value: null | string | undefined): string {
  if (!value) return 'N/A'

  return value
    .replace(/[._-]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((part) => {
      const lowerPart = part.toLowerCase()
      if (['api', 'id', 'ocr', 'sla', 'upi'].includes(lowerPart)) {
        return part.toUpperCase()
      }
      return lowerPart.charAt(0).toUpperCase() + lowerPart.slice(1)
    })
    .join(' ')
}

export function humanizeField(value: string) {
  return value.split('.').map(humanizeCode).join(' › ')
}

export function operatorLabel(value: string) {
  const labels: Record<string, string> = {
    between: 'between',
    contains: 'contains',
    eq: 'is',
    gt: '>',
    gte: '≥',
    in: 'is one of',
    is_empty: 'is empty',
    is_false: 'is no',
    is_not_empty: 'is set',
    is_true: 'is yes',
    lt: '<',
    lte: '≤',
    neq: 'is not',
    not_in: 'is none of',
  }
  return labels[value] ?? value
}

export function formatSla(minutes: null | number) {
  if (!minutes) return 'No time limit'
  if (minutes < 60) return `${minutes}m`

  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const remainder = minutes % 60

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`
}

/**
 * Stage mode only matters when a stage has more than one approver — with one
 * approver, "sequential" and "parallel" describe the same thing. Kept as
 * assistive text rather than a visible pill for that reason.
 */
export function stageModeHint(stageMode: string, approverCount: number) {
  if (approverCount < 2) return 'One approver decides.'
  return stageMode === 'PARALLEL'
    ? 'Approvers decide at the same time.'
    : 'Approvers decide in order.'
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function formatDateTime(value: null | string | undefined) {
  if (!value) return '—'
  try {
    return formatDate(value, true)
  } catch {
    return value
  }
}

export function formatUnknown(value: unknown): string {
  if (value === undefined) return 'missing'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export function sortRules<T extends { priority: number }>(rules: T[]) {
  return rules.slice().sort((a, b) => b.priority - a.priority)
}

/** Paise are a storage detail. Admins think in rupees. */
export function formatPaise(value: unknown) {
  if (typeof value !== 'number') return formatUnknown(value)
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: value % 100 === 0 ? 0 : 2,
    style: 'currency',
  }).format(value / 100)
}

export interface ConditionLeaf {
  field: string
  label: string
  op: string
  value: unknown
}

/**
 * Flattens a condition tree into readable phrases.
 *
 * The registry supplies the human label and data type for a field path, so
 * `refund.amountPaise lte 50000` reads as "Refund amount ≤ ₹500" rather than
 * "Refund › Amount Paise <= 50000". Without a registry entry it degrades to the
 * humanized path.
 */
export function collectConditionLeaves(
  condition: Record<string, unknown>,
  fields: { dataType: string; fieldPath: string; label: string }[] = [],
): ConditionLeaf[] {
  const leaves: ConditionLeaf[] = []
  const byPath = new Map(fields.map((field) => [field.fieldPath, field]))

  function describeValue(path: string, value: unknown): string {
    const dataType = byPath.get(path)?.dataType

    if (Array.isArray(value)) {
      return value.map((entry) => describeValue(path, entry)).join(', ')
    }
    if (dataType === 'money_paise') return formatPaise(value)
    if (typeof value === 'string') return humanizeCode(value)
    return formatUnknown(value)
  }

  function visit(node: unknown) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const record = node as Record<string, unknown>

    if (Array.isArray(record.all)) {
      record.all.forEach(visit)
      return
    }
    if (Array.isArray(record.any)) {
      record.any.forEach(visit)
      return
    }
    if (record.not) {
      visit(record.not)
      return
    }
    if (typeof record.field === 'string' && typeof record.op === 'string') {
      const fieldLabel = byPath.get(record.field)?.label ?? humanizeField(record.field)
      // Unary operators read as a phrase; everything else as "field op value".
      const label = ['is_true', 'is_false', 'is_empty', 'is_not_empty'].includes(record.op)
        ? `${fieldLabel} ${operatorLabel(record.op)}`
        : `${fieldLabel} ${operatorLabel(record.op)} ${describeValue(record.field, record.value)}`

      leaves.push({ field: record.field, label, op: record.op, value: record.value })
    }
  }

  visit(condition)
  return leaves
}

/** Whether a condition tree joins its top-level branches with "or" rather than "and". */
export function conditionJoiner(condition: Record<string, unknown>) {
  return Array.isArray(condition.any) ? 'or' : 'and'
}

export function sumWorkflowCounts(
  workflows: { counts: { rules: number; stages: number } }[],
  key: 'rules' | 'stages',
) {
  return workflows.reduce((total, wf) => total + wf.counts[key], 0)
}

export function readWorkflowStatus(value: null | string): ApprovalWorkflowStatus | undefined {
  if (workflowStatuses.includes(value as ApprovalWorkflowStatus))
    return value as ApprovalWorkflowStatus
  return undefined
}

// ─── parseContextDraft ────────────────────────────────────────────────────────

export function parseContextDraft(value: string):
  | { context: Record<string, unknown>; ok: true }
  | { error: string; ok: false } {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'Context must be a JSON object.', ok: false }
    }
    return { context: parsed as Record<string, unknown>, ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Invalid JSON.',
      ok: false,
    }
  }
}

// ─── Simulation context ───────────────────────────────────────────────────────

/**
 * The simulation form works on a flat `fieldPath -> value` map, because that is
 * what the condition-field registry describes. These two helpers convert between
 * that shape and the nested object the simulate endpoint expects.
 */
export function flattenContext(
  context: Record<string, unknown>,
  fieldPaths: string[],
): Record<string, unknown> {
  const flat: Record<string, unknown> = {}

  for (const path of fieldPaths) {
    const value = path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
      return (current as Record<string, unknown>)[key]
    }, context)

    if (value !== undefined) flat[path] = value
  }

  return flat
}

export function expandContext(flat: Record<string, unknown>): Record<string, unknown> {
  const context: Record<string, unknown> = {}

  for (const [path, value] of Object.entries(flat)) {
    if (value === undefined || value === '') continue

    const keys = path.split('.')
    let cursor = context

    keys.slice(0, -1).forEach((key) => {
      const existing = cursor[key]
      if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
        cursor[key] = {}
      }
      cursor = cursor[key] as Record<string, unknown>
    })

    cursor[keys[keys.length - 1] as string] = value
  }

  return context
}

/** The values a string field is allowed to take, when the registry pins them down. */
export function allowedValues(source: Record<string, unknown>): string[] {
  return Array.isArray(source.values)
    ? source.values.filter((value): value is string => typeof value === 'string')
    : []
}

/** Groups fields by their leading path segment, e.g. `refund.*` and `vendor.*`. */
export function groupFieldsByEntity<T extends { fieldPath: string }>(fields: T[]) {
  const groups = new Map<string, T[]>()

  for (const field of fields) {
    const entity = field.fieldPath.split('.')[0] ?? 'context'
    groups.set(entity, [...(groups.get(entity) ?? []), field])
  }

  return [...groups.entries()]
}

// ─── Sample Templates ─────────────────────────────────────────────────────────

interface SampleTemplate {
  context: Record<string, unknown>
  label: string
}

export function sampleTemplatesForWorkflow(workflow: {
  triggerEvent: string
  workflowId: string
}): SampleTemplate[] {
  const trigger = workflow.triggerEvent

  if (trigger === 'REFUND_REQUESTED') {
    return [
      {
        context: {
          order: { orderStatus: 'CANCELLED' },
          payment: { status: 'CAPTURED' },
          refund: { amountPaise: 35000, hasDispute: false, reasonCode: 'CUSTOMER_CANCELLATION' },
          vendor: { city: 'Bengaluru' },
        },
        label: 'Small refund',
      },
      {
        context: {
          order: { orderStatus: 'DELIVERED' },
          payment: { status: 'SUCCESS' },
          refund: { amountPaise: 750000, hasDispute: false, reasonCode: 'SERVICE_ISSUE' },
          vendor: { city: 'Bengaluru' },
        },
        label: 'High value',
      },
      {
        context: {
          order: { orderStatus: 'DELIVERED' },
          payment: { status: 'CAPTURED' },
          refund: { amountPaise: 90000, hasDispute: true, reasonCode: 'DISPUTE' },
          vendor: { city: 'Mumbai' },
        },
        label: 'Disputed',
      },
    ]
  }

  if (trigger === 'PAYOUT_CREATED') {
    return [
      {
        context: {
          payout: { hasHold: false, totalAmountPaise: 1_800_000 },
          vendor: { bankAccountStatus: 'VERIFIED', recentBankChange: false, vendorStatus: 'ACTIVE' },
        },
        label: 'Verified payout',
      },
      {
        context: {
          payout: { hasHold: false, totalAmountPaise: 4_200_000 },
          vendor: { bankAccountStatus: 'VERIFIED', recentBankChange: false, vendorStatus: 'ACTIVE' },
        },
        label: 'High value',
      },
      {
        context: {
          payout: { hasHold: true, totalAmountPaise: 900_000 },
          vendor: {
            bankAccountStatus: 'SUBMITTED',
            recentBankChange: true,
            vendorStatus: 'APPROVED',
          },
        },
        label: 'Hold / bank change',
      },
    ]
  }

  if (trigger === 'REEL_SUBMITTED_FOR_REVIEW') {
    return [
      {
        context: {
          reel: {
            durationSeconds: 45,
            hasPolicyFlags: false,
            priorRejectionCount: 0,
            uploaderType: 'VENDOR',
          },
          vendor: { vendorStatus: 'ACTIVE' },
        },
        label: 'Standard reel',
      },
      {
        context: {
          reel: {
            durationSeconds: 38,
            hasPolicyFlags: true,
            priorRejectionCount: 0,
            uploaderType: 'VENDOR',
          },
          vendor: { vendorStatus: 'ACTIVE' },
        },
        label: 'Flagged reel',
      },
      {
        context: {
          reel: {
            durationSeconds: 62,
            hasPolicyFlags: false,
            priorRejectionCount: 1,
            uploaderType: 'INFLUENCER',
          },
          vendor: { vendorStatus: 'APPROVED' },
        },
        label: 'Influencer reel',
      },
    ]
  }

  if (trigger === 'VENDOR_BANK_ACCOUNT_SUBMITTED') {
    return [
      {
        context: {
          bank: { accountHolderMatches: true, ocrConfidence: 0.94 },
          vendor: { city: 'Bengaluru', pendingPayoutAmountPaise: 45_000, recentBankRejectionCount: 0 },
        },
        label: 'Clean proof',
      },
      {
        context: {
          bank: { accountHolderMatches: false, ocrConfidence: 0.74 },
          vendor: { city: 'Mumbai', pendingPayoutAmountPaise: 45_000, recentBankRejectionCount: 0 },
        },
        label: 'Mismatch',
      },
      {
        context: {
          bank: { accountHolderMatches: true, ocrConfidence: 0.91 },
          vendor: {
            city: 'Hyderabad',
            pendingPayoutAmountPaise: 180_000,
            recentBankRejectionCount: 1,
          },
        },
        label: 'Payout exposure',
      },
    ]
  }

  return [{ context: {}, label: 'Blank context' }]
}
