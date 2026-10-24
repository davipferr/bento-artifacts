import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Command Palette',
  tagline: '⌘K: fuzzy search for every action.',
  description:
    'A ⌘K / Ctrl+K launcher inside a little notes app. Fuzzy search finds the best alignment of your ' +
    'letters (word starts, camelCase and runs score more), highlights them, and explains the score. ' +
    'It has keyboard navigation, nested pages, recents that persist, shortcuts that really work, and ' +
    'commands that jump to every other artifact in the gallery.',
  category: 'ui',
  tags: ['fuzzy search', 'keyboard', 'combobox', 'dynamic programming'],
  size: 'M',
  difficulty: 'easy',
  glyph: '⌘K',
}
