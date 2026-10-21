import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Mandelbrot Zoomer',
  tagline: 'Click to fall into the set.',
  description:
    'Pan and zoom the Mandelbrot set on the GPU, fly to famous spots, and watch each point’s Julia ' +
    'set in a side view. When the zoom gets so deep that 32-bit floats run out of digits, the page ' +
    'switches to 64-bit maths on the CPU, so you can see exactly where GPU precision ends.',
  category: 'math',
  tags: ['fractals', 'WebGL2', 'GLSL', 'floating point'],
  size: 'M',
  difficulty: 'medium',
  glyph: '✺',
}
