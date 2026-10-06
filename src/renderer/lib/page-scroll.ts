import { createContext, useContext } from 'react'

/**
 * Scrolls the page body (the one scroll container every screen shares, owned by Layout) back to the top. Layout does
 * it on every screen switch; a screen with its own sections (Settings' tabs) calls it when the section changes.
 */
export const PageScrollResetContext = createContext<() => void>(() => {})

export function usePageScrollReset(): () => void {
  return useContext(PageScrollResetContext)
}
