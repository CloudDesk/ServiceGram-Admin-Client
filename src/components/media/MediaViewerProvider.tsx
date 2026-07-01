import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
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

  const closeMediaViewer = useCallback(() => {
    setState(null)
  }, [])

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
