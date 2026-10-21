import type { ReactNode } from 'react'

interface SliderProps {
  label: ReactNode
  value: number
  min: number
  max: number
  step?: number
  /** What the readout shows; defaults to the raw value. */
  format?: (value: number) => ReactNode
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step = 1, format, onChange }: SliderProps) {
  return (
    <label className="slider">
      <span className="slider-label">
        <span>{label}</span>
        <output>{format ? format(value) : value}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

interface SegmentedProps<T extends string> {
  label?: ReactNode
  value: T
  options: readonly { value: T; label: ReactNode }[]
  onChange: (value: T) => void
}

/** A row of chips where exactly one is selected. */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={typeof label === 'string' ? label : undefined}>
      {label && <span className="segmented-label">{label}</span>}
      <div className="presets">
        {options.map((option) => (
          <button
            key={option.value}
            role="radio"
            aria-checked={option.value === value}
            className={`chip${option.value === value ? ' active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}
