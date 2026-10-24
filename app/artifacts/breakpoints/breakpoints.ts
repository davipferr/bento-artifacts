/**
 * Breakpoint maths for a mobile-first layout: which `min-width` queries match a width,
 * the band each width falls in, and how a sample page reflows at each tier.
 */
export interface Breakpoint {
  name: string
  min: number
}

export const SETS = {
  tailwind: {
    label: 'Tailwind',
    points: [
      { name: 'sm', min: 640 },
      { name: 'md', min: 768 },
      { name: 'lg', min: 1024 },
      { name: 'xl', min: 1280 },
      { name: '2xl', min: 1536 },
    ],
  },
  bootstrap: {
    label: 'Bootstrap',
    points: [
      { name: 'sm', min: 576 },
      { name: 'md', min: 768 },
      { name: 'lg', min: 992 },
      { name: 'xl', min: 1200 },
      { name: 'xxl', min: 1400 },
    ],
  },
  material: {
    label: 'Material 3',
    points: [
      { name: 'medium', min: 600 },
      { name: 'expanded', min: 840 },
      { name: 'large', min: 1200 },
      { name: 'xlarge', min: 1600 },
    ],
  },
} satisfies Record<string, { label: string; points: Breakpoint[] }>

export type SetName = keyof typeof SETS

export const DEVICES = [
  { name: 'Small phone', width: 320 },
  { name: 'Phone', width: 390 },
  { name: 'Tablet', width: 768 },
  { name: 'Tablet landscape', width: 1024 },
  { name: 'Laptop', width: 1366 },
  { name: 'Desktop', width: 1920 },
]

export const MIN_WIDTH = 320
export const MAX_WIDTH = 1920

export const clampWidth = (w: number) => Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w)))

/** How many breakpoints match: 0 = the base (mobile) styles only. */
export const tier = (width: number, points: Breakpoint[]) => points.filter((p) => width >= p.min).length

/** The name you'd use for this width: the largest matching breakpoint, or "base". */
export const current = (width: number, points: Breakpoint[]) => points[tier(width, points) - 1]?.name ?? 'base'

/** Bands between breakpoints: base [0, sm), sm [sm, md), …, last [last, ∞). */
export function bands(points: Breakpoint[]): { name: string; from: number; to: number }[] {
  const edges = [0, ...points.map((p) => p.min), Infinity]
  return ['base', ...points.map((p) => p.name)].map((name, i) => ({ name, from: edges[i], to: edges[i + 1] }))
}

export interface Layout {
  /** Below the 2nd breakpoint the nav collapses into a menu button. */
  menuButton: boolean
  heroSplit: boolean
  sidebar: boolean
  columns: number
  footerColumns: number
}

/**
 * The sample page's rules, mobile-first: each tier adds to the one before.
 * Tier 1 → 2 card columns; 2 → full nav, side-by-side hero; 3 → sidebar, 3 columns; 4 → 4 columns.
 */
export function layout(width: number, points: Breakpoint[]): Layout {
  const t = tier(width, points)
  return {
    menuButton: t < 2,
    heroSplit: t >= 2,
    sidebar: t >= 3,
    columns: t >= 4 ? 4 : t >= 3 ? 3 : t >= 1 ? 2 : 1,
    footerColumns: t >= 2 ? 4 : t >= 1 ? 2 : 1,
  }
}

export interface Rule {
  query: string
  /** Breakpoint name, or "base". */
  name: string
  css: string
  active: boolean
}

/** The stylesheet behind `layout`, written out, with the rules in force at `width` marked. */
export function stylesheet(width: number, points: Breakpoint[]): Rule[] {
  const t = tier(width, points)
  const at = (i: number) => points[i]
  const rules: Rule[] = [
    {
      query: '',
      name: 'base',
      css: '.nav-links { display: none; }\n.cards { grid-template-columns: 1fr; }\n.footer { grid-template-columns: 1fr; }',
      active: true,
    },
  ]
  const tiers = [
    '.cards { grid-template-columns: repeat(2, 1fr); }\n.footer { grid-template-columns: repeat(2, 1fr); }',
    '.nav-links { display: flex; }\n.menu-button { display: none; }\n.hero { grid-template-columns: 1fr 1fr; }\n.footer { grid-template-columns: repeat(4, 1fr); }',
    '.layout { grid-template-columns: 220px 1fr; }\n.cards { grid-template-columns: repeat(3, 1fr); }',
    '.cards { grid-template-columns: repeat(4, 1fr); }',
  ]
  tiers.forEach((css, i) => {
    if (!at(i)) return
    rules.push({ query: `@media (min-width: ${at(i).min}px)`, name: at(i).name, css, active: t > i })
  })
  // Breakpoints past the fourth exist but this page doesn't use them.
  for (let i = tiers.length; i < points.length; i++) {
    rules.push({ query: `@media (min-width: ${at(i).min}px)`, name: at(i).name, css: '/* no changes: the layout tops out at 4 columns */', active: t > i })
  }
  return rules
}

/** Human-readable changes between two layouts, for the "what just changed" log. */
export function diff(a: Layout, b: Layout): string[] {
  const out: string[] = []
  if (a.menuButton !== b.menuButton) out.push(b.menuButton ? 'Nav links fold into a ☰ menu' : 'Nav links appear; ☰ menu hides')
  if (a.heroSplit !== b.heroSplit) out.push(b.heroSplit ? 'Hero splits into two columns' : 'Hero stacks')
  if (a.sidebar !== b.sidebar) out.push(b.sidebar ? 'Sidebar slides in' : 'Sidebar hides')
  if (a.columns !== b.columns) out.push(`Cards: ${a.columns} → ${b.columns} column${b.columns > 1 ? 's' : ''}`)
  if (a.footerColumns !== b.footerColumns) out.push(`Footer: ${a.footerColumns} → ${b.footerColumns} columns`)
  return out
}
