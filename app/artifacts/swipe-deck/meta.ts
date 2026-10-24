import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Swipe Deck',
  tagline: 'Drag, tilt, flick and throw, with the physics showing.',
  description:
    'Tinder-style cards with real throw physics: the release velocity comes from your last few pointer ' +
    'samples, a quick flick decides as well as a long drag, the tilt depends on where you grabbed, and an ' +
    'undecided card springs back. Turn on the overlay to see the thresholds, the velocity vector and what ' +
    'releasing right now would do. The deck is ideas for future artifacts.',
  category: 'ui',
  tags: ['gestures', 'pointer events', 'springs', 'velocity'],
  size: 'M',
  difficulty: 'easy',
  glyph: '♥ ✕',
}
