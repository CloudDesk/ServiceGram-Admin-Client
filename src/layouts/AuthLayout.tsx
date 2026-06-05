import type { PropsWithChildren } from 'react'

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="grid min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_32%),linear-gradient(135deg,#f8fafc_0%,#e0f2fe_100%)] lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
      <div className="flex items-center justify-center px-6 py-10 lg:px-10">
        <div className="w-full max-w-md rounded-[1.5rem] border border-white/50 bg-white/90 p-8 shadow-[var(--shadow-overlay)] backdrop-blur">
          {children}
        </div>
      </div>
      <div className="hidden border-l border-white/30 bg-[linear-gradient(180deg,rgba(15,23,42,0.05),rgba(15,23,42,0.15))] p-10 lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            ServiceGram
          </p>
          <h1 className="mt-4 max-w-lg text-5xl font-semibold leading-tight text-foreground">
            Admin operations foundation for Release 1.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted">
            Role-aware navigation, typed mock services, reusable shells, and a
            backend-ready structure for customers, vendors, orders, finance,
            content, and platform operations.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {['Role-aware shell', 'Mock service layer', 'Reusable data patterns'].map(
            (item) => (
              <div
                className="rounded-surface border border-white/50 bg-white/60 p-4 text-sm font-medium text-foreground shadow-sm"
                key={item}
              >
                {item}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
