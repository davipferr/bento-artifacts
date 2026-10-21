import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Cron Explainer',
  tagline: 'Cron in plain English, with a calendar.',
  description:
    'Type a cron expression (or edit it field by field) and read it as a sentence, see the next ten ' +
    'run times in any time zone, and a month calendar of the days it fires. It also explains the ' +
    'classic gotcha: set both day fields and cron runs when either one matches.',
  category: 'tools',
  tags: ['cron', 'parsing', 'time zones', 'scheduling'],
  size: 'S',
  difficulty: 'easy',
  glyph: '* * *',
}
