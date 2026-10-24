import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'File Tree Explorer',
  tagline: 'An editor sidebar: keys, rename, drag to move.',
  description:
    'A VS Code-style explorer for a copy of this project. It follows the WAI-ARIA tree pattern (arrows, ' +
    'Home/End, type-ahead, * to expand siblings) with a single tab stop. Rename inline with the extension ' +
    'left unselected, drag files into folders that open as you hover, and delete with undo. Every name is ' +
    'validated, and a folder can’t be dropped inside itself.',
  category: 'ui',
  tags: ['tree view', 'drag and drop', 'keyboard', 'ARIA'],
  size: 'S',
  difficulty: 'easy',
  glyph: '📁›',
}
