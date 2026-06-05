interface ErrorLayoutProps {
  title: string
  description: string
}

export function ErrorLayout({ description, title }: ErrorLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-xl rounded-surface border border-border bg-surface p-8 text-center shadow-[var(--shadow-surface)]">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-muted">{description}</p>
      </div>
    </div>
  )
}
