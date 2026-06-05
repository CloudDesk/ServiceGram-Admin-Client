import type { PropsWithChildren } from 'react'

export function PageContainer({ children }: PropsWithChildren) {
  return <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
}
