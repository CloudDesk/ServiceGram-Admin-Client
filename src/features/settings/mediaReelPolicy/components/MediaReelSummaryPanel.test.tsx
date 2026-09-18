import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FormProvider, useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import { recordToFormValues } from '../mappers/mediaReelPolicy.mappers'
import type { MediaReelPolicyFormValues } from '../types/mediaReelPolicy.types'
import { MediaReelSummaryPanel } from './MediaReelSummaryPanel'

function Harness({ overrides = {} }: { overrides?: Partial<MediaReelPolicyFormValues> }) {
  const defaultValues = { ...recordToFormValues(null), displayName: 'Default content rules', ...overrides }
  const form = useForm<MediaReelPolicyFormValues>({ defaultValues })

  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FormProvider {...form}>
        <MediaReelSummaryPanel />
      </FormProvider>
    </QueryClientProvider>
  )
}

describe('MediaReelSummaryPanel', () => {
  it('shows the human-readable reel length and size from the default config', () => {
    render(<Harness />)

    expect(screen.getByText('1–60 sec')).toBeInTheDocument()
    expect(screen.getByText('Up to 100 MB')).toBeInTheDocument()
  })

  it('shows a warning when the preview is longer than the track', () => {
    render(
      <Harness overrides={{ maxMusicTrackMinutes: 1, maxMusicPreviewSeconds: 120 }} />,
    )

    expect(screen.getByText('Preview length cannot be longer than the track length.')).toBeInTheDocument()
  })

  it('describes the GLOBAL scope as applying platform-wide', () => {
    render(<Harness />)

    expect(screen.getByText('Every vendor, platform-wide')).toBeInTheDocument()
  })
})
