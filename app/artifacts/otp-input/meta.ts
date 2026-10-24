import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'OTP / PIN Input',
  tagline: 'Six little boxes that behave like one field.',
  description:
    'A verification-code input done properly: typing advances, Backspace on an empty box steps back, ' +
    'a pasted or autofilled code spreads across every box, arrows and Home/End move around, and a wrong ' +
    'code shakes and clears. A log shows what each keystroke did, and you can switch length, alphabet and PIN masking.',
  category: 'ui',
  tags: ['forms', 'focus management', 'paste', 'accessibility'],
  size: 'S',
  difficulty: 'easy',
  glyph: '▢▢▢',
}
