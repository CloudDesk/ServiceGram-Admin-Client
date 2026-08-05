import loginVisual from '../assets/new.png'
import type { PropsWithChildren } from 'react'

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="auth-premium-shell relative flex min-h-dvh items-center justify-center overflow-x-hidden overflow-y-auto px-6 py-6 text-foreground lg:px-10 lg:py-8 xl:px-14">
      <div className="auth-premium-noise pointer-events-none absolute inset-0 opacity-20" />
      <div className="auth-soft-shape auth-soft-shape-primary absolute left-[8%] top-[10%] hidden h-[21.25rem] w-[21.25rem] rounded-full blur-[28px] lg:block" />
      <div className="auth-soft-shape auth-soft-shape-secondary auth-soft-shape-delayed absolute bottom-[12%] right-[8%] hidden h-[17.5rem] w-[17.5rem] rounded-full blur-[28px] lg:block" />

      <div className="auth-compact-shell relative z-10 grid w-full max-w-[102.5rem] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(30rem,32rem)] lg:gap-12 xl:gap-14">
        <section className="auth-login-hero flex min-w-0 flex-col justify-center">
          <h1 className="auth-hero-title max-w-[61.25rem] font-semibold leading-[0.92] tracking-normal text-[color:var(--sg-color-auth-title)]">
            One command center to run your{' '}
            <span className="text-[color:var(--sg-color-auth-title-accent)]">
              ROOT operations.
            </span>
          </h1>

          <div className="auth-compact-grid mt-7 min-h-0 w-full">
            <div className="auth-hero-visual-card flex items-center justify-center overflow-hidden rounded-[2rem] p-3 backdrop-blur-[28px]">
              <img
                alt="ServiceGram admin preview"
                className="auth-hero-visual h-full w-full rounded-[1.5rem] object-contain"
                src={loginVisual}
              />
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-start">
          <div className="auth-compact-form auth-login-card relative w-full max-w-[32rem] overflow-hidden rounded-[2.25rem] p-6 backdrop-blur-[36px] sm:p-8">
            {children}
          </div>
        </section>
      </div>
    </div>
  )
}
