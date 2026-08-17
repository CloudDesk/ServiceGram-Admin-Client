import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import type { ContentPage } from '../types/content.types'

export type ContentActionKind = 'PUBLISH' | 'ARCHIVE'

export interface ContentActionSelection {
  kind: ContentActionKind
  page: ContentPage
}

interface ContentActionModalProps {
  action: ContentActionSelection
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}

export function ContentActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: ContentActionModalProps) {
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const isArchive = action.kind === 'ARCHIVE'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedReason = reason.trim()
    setFormError(null)

    if (trimmedReason.length < 5) {
      setFormError('Reason must be at least 5 characters.')
      return
    }

    onSubmit(trimmedReason)
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-[0.875rem] border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isArchive ? 'Archive content' : 'Publish content'}
            </h2>
            <p className="mt-1 text-sm text-muted">{action.page.title}</p>
          </div>
          <button
            aria-label="Close content action"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="mt-5 block space-y-2">
            <span className="text-sm font-semibold text-foreground">Change note *</span>
            <textarea
              className="form-input min-h-28 resize-y"
              placeholder={
                isArchive
                  ? 'Replacing this page with updated content.'
                  : 'Approved after final content review.'
              }
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {formError || error ? (
            <div className="mt-4 rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              size="sm"
              type="submit"
              variant={isArchive ? 'danger' : 'primary'}
            >
              {isArchive ? 'Archive' : 'Publish'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
