import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Context Menu',
  tagline: 'Submenus that don’t slam shut on a diagonal.',
  description:
    'Right-click a desktop full of files for a menu with submenus. Move diagonally from “Share” into its ' +
    'submenu and the safe triangle keeps it open while you cross other items, which a debug overlay draws live. ' +
    'Compare it with instant switching and with a hover delay. Menus flip to stay on screen and work fully ' +
    'from the keyboard: Shift+F10, arrows, type-ahead and Escape.',
  category: 'ui',
  tags: ['menus', 'pointer intent', 'geometry', 'keyboard'],
  size: 'M',
  difficulty: 'medium',
  glyph: '☰›',
}
