import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#080B14] font-outfit">
      {/* Background blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-violet-600/25 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute -left-20 top-1/3 h-[300px] w-[300px] rounded-full bg-indigo-600/10 blur-[80px]" />
      </div>

      {/* Grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-violet-300 uppercase">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
          </span>
          Live on Stellar Testnet
        </div>

        {/* Hero */}
        <h1 className="mt-2 bg-gradient-to-b from-white via-white to-white/30 bg-clip-text text-5xl font-extrabold leading-tight tracking-tight text-transparent sm:text-6xl lg:text-7xl">
          Your Digital Legacy,
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-sky-400 bg-clip-text text-transparent">
            Secured Forever.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg">
          SafeGuard uses{' '}
          <span className="font-medium text-white/80">biometric Passkeys</span> and{' '}
          <span className="font-medium text-white/80">Soroban smart contracts</span> to
          automatically transfer your assets to your loved ones — no lawyers, no private keys.
        </p>

        {/* Feature pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {[
            { icon: '🔐', label: 'WebAuthn / Passkeys' },
            { icon: '⛓️', label: 'Soroban Smart Contract' },
            { icon: '⏱️', label: 'Heartbeat Countdown' },
            { icon: '🌐', label: 'Self-Custodial' },
          ].map((f) => (
            <span
              key={f.label}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/60"
            >
              <span>{f.icon}</span>
              {f.label}
            </span>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            id="launch-dashboard-btn"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-violet-500/30 transition-all duration-200 hover:shadow-violet-500/50 hover:brightness-110 active:scale-[0.98]"
          >
            <span className="relative z-10 flex items-center gap-2">
              🚀 Launch Dashboard
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
            <span aria-hidden="true" className="absolute inset-0 -translate-x-full bg-white/10 skew-x-12 transition-transform duration-700 group-hover:translate-x-full" />
          </Link>

          <Link
            href="/onboarding"
            id="how-it-works-btn"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 text-base font-semibold text-white/70 backdrop-blur-md transition-all duration-200 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white"
          >
            📖 How It Works
          </Link>

          <a
            href="https://github.com/sakshi26-vfx/SafeGuard"
            target="_blank"
            rel="noopener noreferrer"
            id="view-code-btn"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-4 text-sm font-semibold text-white/50 transition-all duration-200 hover:text-white"
          >
            View Code
          </a>
        </div>
      </div>

      {/* Bottom stats bar */}
      <div className="relative z-10 mt-20 flex items-center gap-8 border-t border-white/5 pt-8 text-center">
        {[
          { label: 'Smart Contract', value: 'Soroban v21' },
          { label: 'Auth Method', value: 'P-256 Passkeys' },
          { label: 'Network', value: 'Stellar Testnet' },
          { label: 'Challenge', value: 'Level 4 Builder' },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <span className="text-lg font-bold text-white">{s.value}</span>
            <span className="text-xs text-white/30">{s.label}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
