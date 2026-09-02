import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hash, Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { reelService } from '../services/reel.service'
import type { AdminHashtag, AdminHashtagModerationAction, AdminHashtagStatus } from '../types/reel.types'

const PAGE_SIZE = 20

export function ReelHashtagsModerationQueue({ canModerate }: { canModerate: boolean }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdminHashtagStatus | ''>('SUSPICIOUS')
  const [selected, setSelected] = useState<AdminHashtag | null>(null)
  const [action, setAction] = useState<AdminHashtagModerationAction>('BLOCK')
  const [reason, setReason] = useState('')
  const counts = useQuery({ queryKey: ['hashtags', 'counts'], queryFn: () => reelService.getHashtags({ page: 1, limit: 1 }) })
  const queue = useQuery({
    queryKey: ['hashtags', { page, search, status }],
    queryFn: () => reelService.getHashtags({ page, limit: PAGE_SIZE, search: search.trim() || undefined, status: status || undefined }),
    enabled: open,
    placeholderData: (previous) => previous,
  })
  const mutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Choose a hashtag to moderate.')
      return reelService.moderateHashtag(selected.hashtagId, {
        action,
        expectedVersion: selected.version,
        reason: reason.trim(),
      })
    },
    onSuccess: async () => {
      setSelected(null); setReason('')
      await client.invalidateQueries({ queryKey: ['hashtags'] })
    },
  })
  const summary = queue.data?.summary ?? counts.data?.summary
  return <>
    <Button className="h-9" size="sm" type="button" variant="secondary" onClick={() => setOpen(true)}>
      <Hash className="size-4 sm:mr-2" /><span className="hidden sm:inline">Hashtags</span>
      {(summary?.suspicious ?? 0) > 0 ? <span className="ml-2 rounded-full bg-warning/15 px-1.5 py-0.5 text-[0.65rem] font-bold text-warning">{summary?.suspicious}</span> : null}
    </Button>
    {open ? createPortal(<div className="premium-overlay flex items-center justify-center p-3 sm:p-5">
      <section aria-modal="true" className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)]" role="dialog">
        <header className="flex items-start border-b border-border p-5">
          <div className="flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Release 2 · Social</p><h2 className="mt-1 text-xl font-semibold">Hashtag moderation</h2><p className="mt-1 text-sm text-muted">Review suspicious tags. Blocking hides the tag immediately and queues exact-token caption cleanup.</p></div>
          <button aria-label="Close" className="p-2 text-muted" onClick={() => setOpen(false)}><X className="size-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-2"><Metric label="Active" value={summary?.active ?? 0} /><Metric label="Suspicious" value={summary?.suspicious ?? 0} /><Metric label="Blocked" value={summary?.blocked ?? 0} /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
            <label className="relative"><Search className="absolute left-3 top-3 size-4 text-muted" /><input className="form-input pl-9" placeholder="Search hashtags…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></label>
            <select className="form-input" value={status} onChange={(e) => { setStatus(e.target.value as AdminHashtagStatus | ''); setPage(1) }}><option value="">All states</option><option value="SUSPICIOUS">Suspicious</option><option value="ACTIVE">Active</option><option value="BLOCKED">Blocked</option></select>
          </div>
          <div className="mt-4 space-y-2">{queue.isLoading ? <p className="py-10 text-center text-sm text-muted">Loading…</p> : (queue.data?.data ?? []).map((tag) => <article className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4" key={tag.hashtagId}>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong>#{tag.displayTag}</strong><Badge tone={tag.status === 'BLOCKED' ? 'danger' : tag.status === 'SUSPICIOUS' ? 'warning' : 'success'}>{tag.status}</Badge></div><p className="mt-1 text-xs text-muted">{tag.visibleReelCount} visible · {tag.usageCount7d} uses / 7d · refreshed {tag.aggregateRefreshedAt ? new Date(tag.aggregateRefreshedAt).toLocaleString() : 'pending'}</p>{tag.moderationReason ? <p className="mt-1 text-xs text-muted">Reason: {tag.moderationReason}</p> : null}</div>
            {canModerate ? <div className="flex gap-2">{tag.status !== 'SUSPICIOUS' ? <Button size="xs" variant="ghost" onClick={() => { setSelected(tag); setAction('MARK_SUSPICIOUS') }}>Suspicious</Button> : null}<Button size="xs" variant={tag.status === 'BLOCKED' ? 'secondary' : 'danger'} onClick={() => { setSelected(tag); setAction(tag.status === 'BLOCKED' ? 'ALLOW' : 'BLOCK') }}>{tag.status === 'BLOCKED' ? 'Allow' : 'Block'}</Button></div> : null}
          </article>)}</div>
          {(queue.data?.pagination.totalPages ?? 1) > 1 ? <div className="mt-4 flex justify-between"><Button disabled={page === 1} size="xs" variant="ghost" onClick={() => setPage((p) => p - 1)}>Previous</Button><span className="text-xs text-muted">Page {page} of {queue.data?.pagination.totalPages}</span><Button disabled={!queue.data?.pagination.hasNextPage} size="xs" variant="ghost" onClick={() => setPage((p) => p + 1)}>Next</Button></div> : null}
        </div>
      </section>
    </div>, document.body) : null}
    {selected ? createPortal(<div className="premium-overlay flex items-center justify-center p-4"><form className="w-full max-w-md rounded-xl border border-border bg-surface p-5" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}><h3 className="text-lg font-semibold">{action.replace('_', ' ')} #{selected.displayTag}</h3><p className="mt-2 text-sm text-muted">A reason is required and recorded in the audit log.</p><textarea autoFocus className="form-input mt-4 min-h-24" minLength={3} required value={reason} onChange={(e) => setReason(e.target.value)} />{mutation.isError ? <p className="mt-2 text-sm text-danger">{mutation.error instanceof Error ? mutation.error.message : 'Moderation failed.'}</p> : null}<div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setSelected(null)}>Cancel</Button><Button disabled={mutation.isPending || reason.trim().length < 3} type="submit" variant={action === 'BLOCK' ? 'danger' : 'primary'}>Confirm</Button></div></form></div>, document.body) : null}
  </>
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div> }
