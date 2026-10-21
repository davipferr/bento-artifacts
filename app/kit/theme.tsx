import { useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const KEY = 'bento-theme'
const order: Theme[] = ['system', 'light', 'dark']
const icons: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' }

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/** Sets `data-theme` on <html> and tells canvases to redraw with the new colours. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Storage blocked (private window): the choice just won't persist.
  }
  window.dispatchEvent(new Event('themechange'))
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(storedTheme)
  const next = order[(order.indexOf(theme) + 1) % order.length]
  return (
    <button
      className="icon-button"
      title={`Theme: ${theme} (switch to ${next})`}
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      onClick={() => {
        applyTheme(next)
        setTheme(next)
      }}
    >
      {icons[theme]}
    </button>
  )
}
