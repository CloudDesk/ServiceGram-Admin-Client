import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { useLocation } from 'react-router-dom'
import type {
  MediaViewerItem,
  OpenMediaViewerInput,
} from './MediaViewer.types'
import { MediaViewerContext } from './MediaViewerContext'

const MediaViewerDialog = lazy(() =>
  import('./MediaViewerDialog').then((module) => ({
    default: module.MediaViewerDialog,
  })),
)

interface MediaViewerState {
  items: MediaViewerItem[]
  startIndex: number
}

export function MediaViewerProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<MediaViewerState | null>(null)
  const location = useLocation()
  const locationKeyRef = useRef(location.key)

  const closeMediaViewer = useCallback(() => {
    setState(null)
  }, [])

  // The dialog is plain component state, decoupled from the router, so the
  // browser back/forward buttons navigate underneath it without ever
  // closing it. Closing on every location change (any push, replace, or
  // pop) keeps the two in sync regardless of which caused the navigation.
  useEffect(() => {
    if (location.key !== locationKeyRef.current) {
      locationKeyRef.current = location.key
      setState(null)
    }
  }, [location.key])

  const openMediaViewer = useCallback((input: OpenMediaViewerInput) => {
    if (!input.items.length) return

    setState({
      items: input.items,
      startIndex: Math.min(
        Math.max(input.startIndex ?? 0, 0),
        input.items.length - 1,
      ),
    })
  }, [])

  const value = useMemo(
    () => ({ closeMediaViewer, openMediaViewer }),
    [closeMediaViewer, openMediaViewer],
  )

  return (
    <MediaViewerContext.Provider value={value}>
      {children}
      {state ? (
        <Suspense fallback={null}>
          <MediaViewerDialog
            items={state.items}
            startIndex={state.startIndex}
            onClose={closeMediaViewer}
          />
        </Suspense>
      ) : null}
    </MediaViewerContext.Provider>
  )
}
