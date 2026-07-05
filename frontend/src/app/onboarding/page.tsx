'use client';

import Link from 'next/link';
import { useState } from 'react';

const steps = [
  {
    number: '01',
    icon: '🔗',
    title: 'Connect Your Stellar Wallet',
    description:
      'Install the Freighter browser extension and connect your Stellar testnet account. Your wallet address becomes the vault owner — no account creation required.',
    color: 'from-violet-500 to-violet-700',
    detail: 'Compatible with Freighter Wallet on Chrome, Firefox, and Brave.',
  },
  {
    number: '02',
    icon: '🔐',
    title: 'Register a Biometric Passkey',
    description:
      'Use your device biometrics (FaceID, TouchID, Windows Hello, or fingerprint) to register a cryptographic passkey. Your private key never leaves your device.',
    color: 'from-cyan-500 to-cyan-700',
    detail: 'Supported on iOS, Android, macOS, Windows 11, and Linux with hardware tokens.',
  },
  {
    number: '03',
    icon: '⏱️',
    title: 'Vault Initialized On-Chain',
    description:
      'A Soroban smart contract is deployed with your wallet as owner, your passkey public key stored on-chain, and a designated beneficiary address. The countdown begins.',
    color: 'from-indigo-500 to-indigo-700',
    detail: 'No custodians. No lawyers. 100% self-sovereign.',
  },
  {
    number: '04',
    icon: '💓',
    title: 'Regular Heartbeat Check-ins',
    description:
      'Authenticate with your biometric once per window (default: 24 hours) to reset the countdown. If you forget, the beneficiary can claim your escrowed assets.',
    color: 'from-green-500 to-green-700',
    detail: 'Biometric signature is verified on-chain via secp256r1 / WebAuthn P-256.',
  },
  {
    number: '05',
    icon: '🏦',
    title: 'Beneficiary Claims Inheritance',
    description:
      'If the owner does not check in before the countdown reaches zero, the designated beneficiary can connect their wallet and claim 100% of escrowed assets — instantly.',
    color: 'from-amber-500 to-amber-700',
    detail: 'All transfers are atomic and finalized on the Stellar blockchain.',
  },
];

const faqs = [
  {
    q: 'Is SafeGuard non-custodial?',
    a: 'Yes. Your private keys are never stored or transmitted. The smart contract only stores your passkey public key, which cannot be used to access your funds.',
  },
  {
    q: 'What happens if I lose my device?',
    a: 'You can re-register a new passkey from any device using your wallet. The "Link Passkey to Vault" button on the dashboard updates the on-chain passkey to your new device.',
  },
  {
    q: 'Which tokens can I escrow?',
    a: 'Currently SafeGuard supports XLM via the native Stellar Asset Contract (SAC). Support for custom Soroban tokens will be added in future versions.',
  },
  {
    q: 'What network is this on?',
    a: 'SafeGuard currently runs on Stellar Testnet. The contract is production-architectured and ready for Mainnet deployment.',
  },
  {
    q: 'Is the code open source?',
    a: 'Yes. The smart contract (Rust/Soroban) and frontend (Next.js/TypeScript) are fully open source on GitHub.',
  },
];

export default function OnboardingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-[#080B14] font-outfit">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
            ← Back to Home
          </Link>
        </div>

        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-violet-300 uppercase">
            How It Works
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Your Digital Estate,{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Automated.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/50">
            SafeGuard is a self-custodial inheritance protocol. It automatically transfers your
            Stellar assets to a chosen beneficiary if you stop proving you are alive — using
            just your face, finger, or PIN.
          </p>
        </div>

        {/* Steps */}
        <div className="relative mb-20">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 hidden h-full w-px bg-gradient-to-b from-violet-500/30 via-cyan-500/20 to-transparent sm:block" />

          <div className="flex flex-col gap-10">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-6">
                {/* Icon bubble */}
                <div
                  className={`relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} shadow-lg text-2xl`}
                >
                  {step.icon}
                </div>

                {/* Content */}
                <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <span className="text-xs font-bold tracking-widest text-white/20 uppercase">
                      Step {step.number}
                    </span>
                  </div>
                  <h2 className="mb-1 text-lg font-bold text-white">{step.title}</h2>
                  <p className="text-sm text-white/50">{step.description}</p>
                  <p className="mt-2 text-xs text-white/30">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-white">
            Frequently Asked Questions
          </h2>
          <div className="flex flex-col gap-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-white hover:bg-white/[0.03] transition-colors"
                  aria-expanded={openFaq === i}
                >
                  {faq.q}
                  <span
                    className={`ml-4 shrink-0 text-white/40 transition-transform duration-200 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {openFaq === i && (
                  <div className="border-t border-white/5 px-6 py-4 text-sm text-white/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-10 text-center backdrop-blur-xl">
          <h2 className="mb-2 text-2xl font-bold text-white">Ready to Secure Your Legacy?</h2>
          <p className="mb-6 text-sm text-white/50">
            It takes less than 2 minutes. No email. No password. Just your wallet and your face.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              id="onboarding-launch-btn"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-violet-500/30 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
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
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 text-base font-semibold text-white/70 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:text-white"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-white/20">
          SafeGuard v0.1.0 — Built for Stellar Builder Challenge Level 4 — Stellar Testnet
        </footer>
      </div>
    </main>
  );
}
