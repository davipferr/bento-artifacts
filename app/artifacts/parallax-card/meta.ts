import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Parallax Depth Card',
  tagline: 'A card that tilts after your pointer, with real depth.',
  description:
    'A six-layer landscape card that tilts after your pointer or your phone’s motion sensor, with a moving glare. ' +
    'Set the maximum tilt, the depth between layers, the perspective and the smoothing, then compare real 3D ' +
    '(translateZ inside preserve-3d) with a 2D version that only slides the layers. The exploded view turns the ' +
    'card sideways so you can see how far apart the layers are.',
  category: 'motion',
  tags: ['3D transforms', 'parallax', 'pointer', 'device orientation'],
  size: 'M',
  difficulty: 'easy',
  glyph: '◩',
}
