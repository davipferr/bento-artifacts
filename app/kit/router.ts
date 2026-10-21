import { useSyncExternalStore } from 'react'

/**
 * Hash routing (`#/sorting-race`) so the static build works on GitHub Pages without rewrites.
 * An artifact may keep shareable state after a `?`: `#/step-sequencer?p=…`.
 */
const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}
const hash = () => location.hash.replace(/^#\/?/, '')
const current = () => decodeURIComponent(hash().split('?')[0])

/** The slug after `#/`, or '' on the gallery. */
export function useRoute(): string {
  return useSyncExternalStore(subscribe, current)
}

export const href = (slug = '') => `#/${slug}`

/** The `?…` part of the current route. */
export function routeParams(): URLSearchParams {
  const query = hash().split('?')[1]
  return new URLSearchParams(query ?? '')
}

/** Replace the route's `?…` part without adding a history entry (or firing hashchange). */
export function setRouteParams(params: URLSearchParams) {
  const query = params.toString()
  history.replaceState(null, '', `#/${hash().split('?')[0]}${query ? `?${query}` : ''}`)
}
