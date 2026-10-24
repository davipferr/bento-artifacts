import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Modal & Focus Trap',
  tagline: 'Where does Tab go when a dialog is open?',
  description:
    'A small fake app with three nested dialogs. Numbered arrows show the order Tab will visit, and a focus log ' +
    'turns red whenever focus slips behind the dialog or gets dropped. Switch off the focus trap, the inert ' +
    'background, initial focus or focus return one at a time to see what each one is for, and try a positive ' +
    'tabindex to see why it breaks the order.',
  category: 'ui',
  tags: ['dialogs', 'focus management', 'inert', 'accessibility'],
  size: 'M',
  difficulty: 'easy',
  glyph: '⇥▢',
}
