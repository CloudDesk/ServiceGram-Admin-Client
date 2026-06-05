import loginVisual from '../assets/new.png'
import type { PropsWithChildren } from 'react'

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="auth-premium-shell relative flex h-dvh items-center justify-center overflow-hidden px-6 py-6 text-[#111111] lg:px-10 lg:py-8 xl:px-14">
      <div className="auth-premium-noise pointer-events-none absolute inset-0 opacity-20" />
      <div className="auth-soft-shape absolute left-[8%] top-[10%] hidden h-[21.25rem] w-[21.25rem] rounded-full bg-white/50 blur-[28px] shadow-[0_40px_120px_rgba(80,70,60,0.14)] lg:block" />
      <div className="auth-soft-shape auth-soft-shape-delayed absolute bottom-[12%] right-[8%] hidden h-[17.5rem] w-[17.5rem] rounded-full bg-[#252525]/10 blur-[28px] shadow-[0_40px_120px_rgba(80,70,60,0.14)] lg:block" />

      <div className="auth-compact-shell relative z-10 grid w-full max-w-[102.5rem] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(30rem,32rem)] lg:gap-12 xl:gap-14">
        <section className="auth-login-hero flex min-w-0 flex-col justify-center">
          <h1 className="auth-hero-title max-w-[61.25rem] font-semibold leading-[0.92] tracking-[-0.065em] text-[#151515]">
            One command center to run your <span className="text-[#756f66]">ROOT operations.</span>
          </h1>

          <div className="auth-compact-grid mt-7 min-h-0 w-full">
            <div className="auth-hero-visual-card flex items-center justify-center overflow-hidden rounded-[2rem] border border-white/70 bg-white/45 p-3 backdrop-blur-[28px] shadow-[0_20px_60px_rgba(80,70,60,0.1),inset_0_1px_0_rgba(255,255,255,0.72)]">
              <img
                alt="ServiceGram admin preview"
                className="auth-hero-visual h-full w-full rounded-[1.5rem] object-contain"
                src={loginVisual}
              />
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-start">
          <div className="auth-compact-form auth-login-card relative w-full max-w-[32rem] overflow-hidden rounded-[2.25rem] border border-white/80 bg-white/60 p-6 shadow-[0_42px_110px_rgba(55,48,40,0.22),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[36px] sm:p-8">
            {children}
          </div>
        </section>
      </div>
    </div>
  )
}
