import type { Preview } from '../types'
import { drawScene } from './draw'
import { allOn } from './principles'

/** The character hopping with every principle on. */
export const preview: Preview = () => {
  const on = { ...allOn(), poseToPose: false }
  return (frame) => drawScene(frame, frame.t * 0.8, on)
}
