/**
 * A multi-step "create a workspace" form: the steps, per-step validation, which steps you
 * may jump to, and a draft you can save and resume (without the password).
 */
export interface Values {
  name: string
  email: string
  password: string
  workspace: string
  slug: string
  /** True once the slug was edited by hand, so it stops following the workspace name. */
  slugTouched: boolean
  size: string
  theme: 'system' | 'light' | 'dark'
  digest: 'daily' | 'weekly' | 'never'
  mentions: boolean
  agree: boolean
}

export const EMPTY: Values = {
  name: '',
  email: '',
  password: '',
  workspace: '',
  slug: '',
  slugTouched: false,
  size: '',
  theme: 'system',
  digest: 'weekly',
  mentions: true,
  agree: false,
}

export const STEPS = [
  { id: 'account', title: 'Account', hint: 'Who you are' },
  { id: 'workspace', title: 'Workspace', hint: 'Where your team works' },
  { id: 'preferences', title: 'Preferences', hint: 'How it should feel' },
  { id: 'review', title: 'Review', hint: 'Check and confirm' },
] as const

export const SIZES = ['Just me', '2–10', '11–50', '51–200', '200+']

export type Errors = Partial<Record<keyof Values, string>>

/** "My Cool Team!" → "my-cool-team". */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

/** 0 (empty) … 4 (strong), from length and variety. */
export function strength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  if (/^(.)\1+$/.test(password) || /^(password|12345678|qwerty)/i.test(password)) score = 0
  const s = Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4
  return { score: s, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][s] }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Errors for the fields on one step. An empty object means the step is valid. */
export function validate(step: number, v: Values): Errors {
  const e: Errors = {}
  if (step === 0) {
    if (v.name.trim().length < 2) e.name = 'Tell us your name (at least 2 letters).'
    if (!EMAIL.test(v.email.trim())) e.email = 'That doesn’t look like an email address.'
    if (v.password.length < 8) e.password = 'Use at least 8 characters.'
    else if (strength(v.password).score < 2) e.password = 'Too easy to guess: mix in capitals, digits or symbols.'
  }
  if (step === 1) {
    if (v.workspace.trim().length < 3) e.workspace = 'Workspace names need at least 3 characters.'
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug)) e.slug = 'Lowercase letters, digits and single dashes only.'
    else if (['admin', 'api', 'www', 'help'].includes(v.slug)) e.slug = `“${v.slug}” is reserved. Try another.`
    if (!v.size) e.size = 'Pick a team size.'
  }
  if (step === 3 && !v.agree) e.agree = 'Please accept the terms to continue.'
  return e
}

export const isValid = (step: number, v: Values) => Object.keys(validate(step, v)).length === 0

/** The furthest step you may jump to: every step before it must be valid. */
export function reachable(v: Values): number {
  let i = 0
  while (i < STEPS.length - 1 && isValid(i, v)) i++
  return i
}

export const direction = (from: number, to: number) => (to > from ? 1 : to < from ? -1 : 0)

/** Progress through the wizard, 0…1, counting the current step as half done. */
export const progress = (step: number) => Math.min(1, (step + 0.5) / STEPS.length)

// ---- Drafts ------------------------------------------------------------------

export const DRAFT_VERSION = 1

export interface Draft {
  version: number
  step: number
  savedAt: number
  values: Omit<Values, 'password'>
}

/** Serialise a draft. The password is deliberately left out: drafts live in plain storage. */
export function toDraft(values: Values, step: number, now: number): string {
  const { password: _omit, ...rest } = values
  const draft: Draft = { version: DRAFT_VERSION, step, savedAt: now, values: rest }
  return JSON.stringify(draft)
}

/** Read a draft back, or null if it's missing, broken or from an older version. */
export function fromDraft(text: string | null): { values: Values; step: number; savedAt: number } | null {
  if (!text) return null
  try {
    const draft = JSON.parse(text) as Draft
    if (draft.version !== DRAFT_VERSION || typeof draft.step !== 'number' || !draft.values) return null
    const values = { ...EMPTY, ...draft.values, password: '' }
    // Never resume past a step whose data no longer validates (the password is gone, for one).
    return { values, step: Math.max(0, Math.min(draft.step, reachable(values), STEPS.length - 1)), savedAt: draft.savedAt }
  } catch {
    return null
  }
}

export function ago(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s} s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}
