import type { PointerEvent } from 'react'
import { isBlackKey, noteName } from './music'

interface PianoProps {
  /** First and last MIDI notes; `from` should be a white key. */
  from: number
  to: number
  /** Notes drawn as pressed. */
  active: ReadonlySet<number>
  /** Optional per-key captions, e.g. the computer key that plays it. */
  captions?: Partial<Record<number, string>>
  onDown?: (midi: number) => void
  onUp?: (midi: number) => void
}

/** A small HTML piano. Without onDown it's display-only. */
export function Piano({ from, to, active, captions, onDown, onUp }: PianoProps) {
  const notes = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const whites = notes.filter((n) => !isBlackKey(n))
  const whiteWidth = 100 / whites.length
  const interactive = Boolean(onDown)

  const handlers = (midi: number) =>
    interactive
      ? {
          onPointerDown: (e: PointerEvent) => {
            e.preventDefault()
            onDown!(midi)
          },
          onPointerUp: () => onUp?.(midi),
          onPointerLeave: (e: PointerEvent) => {
            if (e.buttons) onUp?.(midi)
          },
          onPointerEnter: (e: PointerEvent) => {
            if (e.buttons) onDown!(midi) // glissando
          },
        }
      : {}

  return (
    <div className={`piano${interactive ? ' interactive' : ''}`} role={interactive ? 'group' : 'img'} aria-label="Piano keyboard">
      {notes.map((midi) => {
        const black = isBlackKey(midi)
        const whiteIndex = whites.filter((w) => w < midi).length
        const left = black ? whiteIndex * whiteWidth - whiteWidth * 0.3 : whiteIndex * whiteWidth
        return (
          <div
            key={midi}
            className={`key ${black ? 'black' : 'white'}${active.has(midi) ? ' down' : ''}`}
            style={{ left: `${left}%`, width: `${black ? whiteWidth * 0.6 : whiteWidth}%` }}
            title={noteName(midi)}
            {...handlers(midi)}
          >
            {captions?.[midi] && <span className="key-caption">{captions[midi]}</span>}
          </div>
        )
      })}
    </div>
  )
}
