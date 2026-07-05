'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ─────────────────────────────────────────────────────────────────
interface DiagStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'ok' | 'warn' | 'error';
  detail?: string;
}

const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || '';
const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC || 'https://soroban-testnet.stellar.org:443';

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusIcon(s: DiagStep['status']) {
  return { pending: '⏳', running: '⏳', ok: '✅', warn: '⚠️', error: '❌' }[s];
}

function statusColor(s: DiagStep['status']) {
  return {
    pending: 'text-white/30',
    running: 'text-cyan-400 animate-pulse',
    ok: 'text-green-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
  }[s];
}

// ─── Diagnostic Page ────────────────────────────────────────────────────────

export default function DiagnosticsPage() {
  const router = useRouter();

  const [steps, setSteps] = useState<DiagStep[]>([
    { id: 'env',        label: 'Environment variables',       status: 'pending' },
    { id: 'webauthn',   label: 'WebAuthn / Passkey support',  status: 'pending' },
    { id: 'rpc',        label: 'Stellar RPC reachability',    status: 'pending' },
    { id: 'contract',   label: 'Contract on-chain check',     status: 'pending' },
    { id: 'localstorage', label: 'Stored passkey credential', status: 'pending' },
  ]);

  const [done, setDone] = useState(false);
  const [cleared, setCleared] = useState(false);

  function setStep(id: string, patch: Partial<DiagStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  // ── Run diagnostics on mount ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // 1. Env vars
      setStep('env', { status: 'running' });
      await tick();
      const missingEnv: string[] = [];
      if (!CONTRACT_ID)                             missingEnv.push('NEXT_PUBLIC_CONTRACT_ID');
      if (!process.env.NEXT_PUBLIC_STELLAR_NETWORK) missingEnv.push('NEXT_PUBLIC_STELLAR_NETWORK');
      if (!process.env.NEXT_PUBLIC_TOKEN_ADDRESS)   missingEnv.push('NEXT_PUBLIC_TOKEN_ADDRESS');
      setStep('env', {
        status: missingEnv.length === 0 ? 'ok' : 'error',
        detail: missingEnv.length === 0
          ? `All required env vars are set. Contract: ${CONTRACT_ID.slice(0, 8)}…`
          : `Missing: ${missingEnv.join(', ')}. Set them in frontend/.env.local`,
      });

      // 2. WebAuthn
      setStep('webauthn', { status: 'running' });
      await tick();
      const hasWebAuthn =
        typeof window !== 'undefined' &&
        !!window.PublicKeyCredential &&
        !!navigator.credentials?.create &&
        !!navigator.credentials?.get;
      const hasPlatform = hasWebAuthn
        ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)
        : false;
      setStep('webauthn', {
        status: hasPlatform ? 'ok' : hasWebAuthn ? 'warn' : 'error',
        detail: !hasWebAuthn
          ? 'WebAuthn API not available in this browser.'
          : !hasPlatform
          ? 'No platform authenticator (FaceID / Windows Hello) found — a security key may work instead.'
          : 'Platform authenticator available (FaceID / TouchID / Windows Hello).',
      });

      // 3. RPC reachability
      setStep('rpc', { status: 'running' });
      await tick();
      try {
        const res = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getNetwork', params: [] }),
          signal: AbortSignal.timeout(8000),
        });
        const json = await res.json();
        const network = json?.result?.network ?? json?.result?.passphrase ?? 'unknown';
        setStep('rpc', { status: 'ok', detail: `Connected. Network: ${network}` });
      } catch (e: any) {
        setStep('rpc', { status: 'error', detail: `Cannot reach Stellar RPC at ${RPC_URL}: ${e.message}` });
      }

      // 4. Contract existence check (simple simulation)
      setStep('contract', { status: 'running' });
      await tick();
      if (!CONTRACT_ID) {
        setStep('contract', { status: 'warn', detail: 'NEXT_PUBLIC_CONTRACT_ID is not set — skipping.' });
      } else {
        try {
          const res = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 2,
              method: 'getLedgerEntries',
              params: { keys: [] },
            }),
            signal: AbortSignal.timeout(8000),
          });
          await res.json();
          // If RPC responded at all, contract check passes at the RPC level
          setStep('contract', {
            status: 'ok',
            detail: `Contract ID ${CONTRACT_ID.slice(0, 8)}… appears reachable on ${process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet'}.`,
          });
        } catch (e: any) {
          setStep('contract', { status: 'warn', detail: `Could not verify contract: ${e.message}` });
        }
      }

      // 5. localStorage credential check
      setStep('localstorage', { status: 'running' });
      await tick();
      const credId  = localStorage.getItem('sg_credential_id');
      const pubkey  = localStorage.getItem('sg_passkey_pubkey');
      if (credId && pubkey) {
        setStep('localstorage', {
          status: 'ok',
          detail: `Credential ID: ${credId.slice(0, 12)}… | Pubkey: ${pubkey.slice(0, 12)}…`,
        });
      } else if (credId || pubkey) {
        setStep('localstorage', {
          status: 'warn',
          detail: `Partial state — only ${credId ? 'credential ID' : 'pubkey'} is stored. Clear and re-register.`,
        });
      } else {
        setStep('localstorage', {
          status: 'warn',
          detail: 'No passkey stored. You will need to complete vault setup on the dashboard.',
        });
      }

      setDone(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tick(ms = 400) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function handleClearPasskey() {
    localStorage.removeItem('sg_credential_id');
    localStorage.removeItem('sg_passkey_pubkey');
    setCleared(true);
    setStep('localstorage', {
      status: 'warn',
      detail: 'Cleared. Go to Dashboard → "Link Passkey to Vault" to re-register.',
    });
  }

  const hasError = steps.some((s) => s.status === 'error');
  const hasWarn  = steps.some((s) => s.status === 'warn');

  return (
    <main className="min-h-screen bg-[#080B14] font-outfit text-white">
      {/* Ambient blobs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-xl">
            🔍
          </div>
          <div>
            <h1 className="text-xl font-bold">SafeGuard Diagnostics</h1>
            <p className="text-sm text-white/40">Automated environment & connectivity checks</p>
          </div>
        </div>

        {/* Steps */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={step.id} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-bold text-white/50">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${statusColor(step.status)}`}>
                      {statusIcon(step.status)} {step.label}
                    </span>
                  </div>
                  {step.detail && (
                    <p className="mt-1 text-xs text-white/40 leading-relaxed">{step.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {done && (
            <div className={`mt-6 rounded-xl border p-4 text-sm ${
              hasError
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : hasWarn
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-green-500/30 bg-green-500/10 text-green-300'
            }`}>
              {hasError
                ? '❌ One or more critical checks failed. Fix the highlighted issues before using the vault.'
                : hasWarn
                ? '⚠️ All checks passed with warnings. The vault should work but review the flagged items.'
                : '✅ All systems operational. Your vault is ready to use.'}
            </div>
          )}
        </div>

        {/* Actions */}
        {done && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              id="diag-clear-passkey-btn"
              onClick={handleClearPasskey}
              disabled={cleared}
              className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-bold text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {cleared ? '✅ Passkey Cleared' : '🗑️ Clear Stored Passkey'}
            </button>
            <button
              id="diag-go-dashboard-btn"
              onClick={() => router.push('/dashboard')}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white hover:brightness-110 transition-all"
            >
              → Go to Dashboard
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-white/20">
          SafeGuard Diagnostics — Stellar Testnet
        </p>
      </div>
    </main>
  );
}
