import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * jsdom has no ResizeObserver, which the responsive DataList uses to measure
 * available width. A no-op observer keeps the component at its fallback width.
 */
class NoopResizeObserver implements ResizeObserver {
  observe() {
    // no layout in jsdom
  }

  unobserve() {
    // no layout in jsdom
  }

  disconnect() {
    // no layout in jsdom
  }
}

globalThis.ResizeObserver ??= NoopResizeObserver

afterEach(() => {
  cleanup()
})
