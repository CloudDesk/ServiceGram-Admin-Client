import { usePageChrome } from '../providers/pageChromeContext'

/**
 * Stands in for the admin Topbar, which is what renders the page chrome action
 * node in the real shell. Without it, header actions never reach the DOM.
 */
export function PageChromeOutlet() {
  const { pageChrome } = usePageChrome()

  return (
    <div
      data-page-layout={pageChrome.layout ?? 'document'}
      data-testid="page-chrome-actions"
    >
      {pageChrome.actionNode}
    </div>
  )
}
