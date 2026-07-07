'use client';

import { useState, useEffect, useCallback } from 'react';
import { registerPasskey, getHeartbeatAssertion, bytesToHex } from '@/utils/webauthn';
import { getLastHeartbeat, getHeartbeatWindow, isClaimed, getOwner, submitHeartbeat, submitInitialize, submitUpdatePasskey, submitClaim } from '@/utils/stellar';
import { useWallet } from '@/hooks/useWallet';
import {
  trackHeartbeatTriggered,
  trackSessionError,
  trackClaimFinalized,
  trackPageView,
} from '@/utils/analytics';
import * as Sentry from '@sentry/nextjs';

// ─── Types ───────────────────────────────────────────────────────────────────
interface VaultState {
  owner: string | null;
  lastHeartbeat: bigint;
  heartbeatWindow: bigint;
  isClaimed: boolean;
  loading: boolean;
  error: string | null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/5 ${className}`}
      aria-hidden="true"
    />
  );
}

function CountdownRing({
  secondsRemaining,
  totalSeconds,
}: {
  secondsRemaining: number;
  totalSeconds: number;
}) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsRemaining / totalSeconds)) : 1;
  const strokeDashoffset = circumference * (1 - pct);
  const color = pct > 0.4 ? '#22c55e' : pct > 0.15 ? '#f59e0b' : '#ef4444';

  const days = Math.floor(secondsRemaining / 86400);
  const hours = Math.floor((secondsRemaining % 86400) / 3600);
  const mins = Math.floor((secondsRemaining % 3600) / 60);
  const secs = secondsRemaining % 60;

  return (
    <div className="relative flex flex-col items-center" role="img" aria-label={`Time remaining: ${days}d ${hours}h ${mins}m ${secs}s`}>
      <svg width="200" height="200" className="-rotate-90">
        {/* Track */}
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        {/* Progress */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>
          {String(days).padStart(2, '0')}d {String(hours).padStart(2, '0')}h
        </span>
        <span className="text-xl font-semibold tabular-nums" style={{ color }}>
          {String(mins).padStart(2, '0')}m {String(secs).padStart(2, '0')}s
        </span>
        <span className="text-xs text-white/40 mt-1">until claim</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md">
      <div className="absolute -right-4 -top-4 text-6xl opacity-10 select-none">{icon}</div>
      <p className="text-xs font-medium uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/40">{sub}</p>}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { wallet, connect, disconnect, signTransaction } = useWallet();
  const ownerPublicKey = wallet.status === 'connected' ? wallet.publicKey : '';
  const [contractId, setContractId] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (ownerPublicKey) {
      const saved = localStorage.getItem(`sg_contract_id_${ownerPublicKey}`);
      setContractId(saved || process.env.NEXT_PUBLIC_CONTRACT_ID || '');
    } else {
      setContractId(process.env.NEXT_PUBLIC_CONTRACT_ID || '');
    }
  }, [ownerPublicKey]);

  // Track page view
  useEffect(() => { trackPageView('dashboard'); }, []);

  const [vault, setVault] = useState<VaultState>({
    owner: null,
    lastHeartbeat: 0n,
    heartbeatWindow: 86400n,
    isClaimed: false,
    loading: true,
    error: null,
  });
  const [heartbeatPending, setHeartbeatPending] = useState(false);
  const [heartbeatSuccess, setHeartbeatSuccess] = useState(false);
  const [claimPending, setClaimPending] = useState(false);
  const [nowSeconds, setNowSeconds] = useState(Math.floor(Date.now() / 1000));
  // Persist credential ID across sessions so we reuse the same passkey
  // that was registered against the on-chain public key.
  const [credentialIdHex, setCredentialIdHex] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (ownerPublicKey) {
      setCredentialIdHex(localStorage.getItem(`sg_credential_id_${ownerPublicKey}`));
    } else {
      setCredentialIdHex(null);
    }
  }, [ownerPublicKey]);

  // Load vault state from chain
  const loadVaultState = useCallback(async () => {
    if (!contractId) return;
    try {
      const [lastHb, window, claimed, ownerAddr] = await Promise.all([
        getLastHeartbeat(contractId),
        getHeartbeatWindow(contractId),
        isClaimed(contractId),
        getOwner(contractId).catch(() => null),
      ]);
      setVault({ owner: ownerAddr, lastHeartbeat: lastHb, heartbeatWindow: window, isClaimed: claimed, loading: false, error: null });
    } catch (err: any) {
      const msg = err?.message || 'Failed to load vault state';
      setVault((v) => ({ ...v, owner: null, lastHeartbeat: 0n, heartbeatWindow: 86400n, isClaimed: false, loading: false, error: msg }));
      Sentry.captureException(err);
      trackSessionError({ stage: 'rpc_connection', errorMessage: msg, contractId });
    }
  }, [contractId]);

  useEffect(() => {
    loadVaultState();
  }, [loadVaultState]);

  // Live clock tick
  useEffect(() => {
    const interval = setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const expiresAt = Number(vault.lastHeartbeat) + Number(vault.heartbeatWindow);
  const secondsRemaining = Math.max(0, expiresAt - nowSeconds);
  const totalSeconds = Number(vault.heartbeatWindow);
  const isExpired = secondsRemaining <= 0 && !vault.loading;

  const [setupPending, setSetupPending] = useState(false);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);

  // Detect whether the contract is already initialized by checking if owner exists
  useEffect(() => {
    if (!contractId) return;
    // If we can read a heartbeat, it's initialized
    getLastHeartbeat(contractId)
      .then((hb) => setIsInitialized(hb > 0n))
      .catch(() => setIsInitialized(false));
  }, [contractId]);

  // ─── Setup Handler (first-time: register passkey + initialize contract) ──

  const handleSetup = async () => {
    setSetupPending(true);
    setVault((v) => ({ ...v, error: null }));

    // Snapshot old values so we can rollback if the on-chain call fails
    const prevCredentialId = localStorage.getItem(`sg_credential_id_${ownerPublicKey}`);
    const prevPasskeyPubkey = localStorage.getItem(`sg_passkey_pubkey_${ownerPublicKey}`);

    try {
      const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
      const challengeHex = bytesToHex(challengeBytes);

      const reg = await registerPasskey('safeguard-owner', challengeHex);

      // Persist to localStorage only AFTER we confirm the on-chain call succeeds
      // (see rollback in catch block below)
      if (isInitialized) {
        // Contract already initialized — update the stored passkey to match
        // the newly registered browser credential.
        await submitUpdatePasskey(
          contractId,
          ownerPublicKey,
          reg.publicKeyHex,
          signTransaction
        );
      } else {
        // Fresh contract — initialize it with the new passkey public key.
        const beneficiary = process.env.NEXT_PUBLIC_BENEFICIARY || ownerPublicKey;
        const token = process.env.NEXT_PUBLIC_TOKEN_ADDRESS || '';
        if (!token) throw new Error('NEXT_PUBLIC_TOKEN_ADDRESS is not set in .env.local');

        await submitInitialize(
          contractId,
          ownerPublicKey,
          reg.publicKeyHex,
          beneficiary,
          86400n, // Production 24-hour window
          token,
          signTransaction
        );
      }

      // ✅ On-chain call succeeded — now safe to commit to localStorage
      setCredentialIdHex(reg.credentialIdHex);
      localStorage.setItem(`sg_credential_id_${ownerPublicKey}`, reg.credentialIdHex);
      localStorage.setItem(`sg_passkey_pubkey_${ownerPublicKey}`, reg.publicKeyHex);

      setIsInitialized(true);
      await loadVaultState();
    } catch (err: any) {
      // 🔄 Rollback localStorage to the previous values so the stored credential
      // still matches what's on-chain (prevents secp256r1 verification failures).
      if (prevCredentialId) {
        localStorage.setItem(`sg_credential_id_${ownerPublicKey}`, prevCredentialId);
        setCredentialIdHex(prevCredentialId);
      } else {
        localStorage.removeItem(`sg_credential_id_${ownerPublicKey}`);
        setCredentialIdHex(null);
      }
      if (prevPasskeyPubkey) {
        localStorage.setItem(`sg_passkey_pubkey_${ownerPublicKey}`, prevPasskeyPubkey);
      } else {
        localStorage.removeItem(`sg_passkey_pubkey_${ownerPublicKey}`);
      }

      const msg = err?.message || 'Setup failed';
      setVault((v) => ({ ...v, error: `Setup failed — on-chain update was not applied. Your previous passkey is still active. Details: ${msg}` }));
      Sentry.captureException(err);
    } finally {
      setSetupPending(false);
    }
  };

  // ─── Heartbeat Handler ───────────────────────────────────────────────────

  const handleHeartbeat = async () => {
    setHeartbeatPending(true);
    setHeartbeatSuccess(false);
    const start = Date.now();
    try {
      // Generate a random 32-byte challenge (hex)
      const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
      const challengeHex = bytesToHex(challengeBytes);

      const credId = credentialIdHex;
      if (!credId) {
        throw new Error(
          'No passkey registered. Please complete setup first by clicking "Set Up Vault".'
        );
      }

      const { signatureHex, clientDataJsonHex, authenticatorDataHex } =
        await getHeartbeatAssertion(challengeHex, credId);

      // Submit heartbeat to Soroban via Freighter wallet
      await submitHeartbeat(
        contractId,
        ownerPublicKey,
        signatureHex,
        clientDataJsonHex,
        authenticatorDataHex,
        signTransaction
      );

      const latencyMs = Date.now() - start;
      trackHeartbeatTriggered({ ownerAddress: ownerPublicKey, contractId, status: 'success', latencyMs });
      setHeartbeatSuccess(true);
      await loadVaultState();
    } catch (err: any) {
      const msg = err?.message || 'Heartbeat failed';
      trackHeartbeatTriggered({ ownerAddress: ownerPublicKey, contractId, status: 'failed', errorMessage: msg });
      trackSessionError({ stage: 'passkey_assertion', errorMessage: msg, contractId });
      Sentry.captureException(err);
      setVault((v) => ({ ...v, error: msg }));
    } finally {
      setHeartbeatPending(false);
    }
  };

  // ─── Claim Handler ───────────────────────────────────────────────────────

  const handleClaim = async () => {
    if (!ownerPublicKey && wallet.status !== 'connected') {
      setVault((v) => ({ ...v, error: 'Connect your (beneficiary) wallet first.' }));
      return;
    }
    const beneficiaryKey = wallet.status === 'connected' ? wallet.publicKey : '';
    setClaimPending(true);
    setVault((v) => ({ ...v, error: null }));
    try {
      const txHash = await submitClaim(
        contractId,
        beneficiaryKey,
        signTransaction
      );
      trackClaimFinalized({ beneficiaryAddress: beneficiaryKey, contractId, claimedAmount: '?', status: 'success' });
      console.log('[SafeGuard] Claim tx:', txHash);
      await loadVaultState();
    } catch (err: any) {
      const msg = err?.message || 'Claim failed';
      setVault((v) => ({ ...v, error: msg }));
      Sentry.captureException(err);
      trackClaimFinalized({ beneficiaryAddress: beneficiaryKey, contractId, claimedAmount: '0', status: 'failed', errorMessage: msg });
    } finally {
      setClaimPending(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#080B14] font-outfit">
      {/* Ambient background blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="mb-10 flex flex-col items-start gap-1">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-xl shadow-lg shadow-violet-500/20">
                🔐
              </div>
              <h1 className="text-2xl font-bold tracking-tight">SafeGuard Vault</h1>
            </div>
            {/* Wallet Connection Button */}
            {wallet.status === 'connected' ? (
              <button
                id="disconnect-wallet-btn"
                onClick={disconnect}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/60 hover:border-white/20 hover:text-white transition-colors"
                title={wallet.publicKey}
              >
                <span className="h-2 w-2 rounded-full bg-green-400" />
                {wallet.publicKey.slice(0, 4)}…{wallet.publicKey.slice(-4)}
              </button>
            ) : (
              <button
                id="connect-wallet-btn"
                onClick={() => connect().catch(() => {})}
                disabled={wallet.status === 'connecting'}
                className="flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
              >
                {wallet.status === 'connecting' ? 'Connecting…' : '🔗 Connect Wallet'}
              </button>
            )}
          </div>
          <p className="text-sm text-white/40">
            Your digital estate, secured by biometrics and the Stellar blockchain.
          </p>
        </header>

        {/* Custom Contract ID Settings */}
        {wallet.status === 'connected' && (
          <div className="mb-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white/60">Active Vault Contract ID</p>
                <code className="text-white/40 break-all">{contractId}</code>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newId = prompt('Enter custom Soroban Contract ID for your vault:', contractId);
                    if (newId !== null) {
                      const cleaned = newId.trim();
                      if (cleaned) {
                        localStorage.setItem(`sg_contract_id_${ownerPublicKey}`, cleaned);
                        setContractId(cleaned);
                      } else {
                        localStorage.removeItem(`sg_contract_id_${ownerPublicKey}`);
                        setContractId(process.env.NEXT_PUBLIC_CONTRACT_ID || '');
                      }
                    }
                  }}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 font-medium hover:bg-white/10 hover:text-white transition-colors"
                >
                  ⚙️ Change Vault Contract
                </button>
                {localStorage.getItem(`sg_contract_id_${ownerPublicKey}`) && (
                  <button
                    onClick={() => {
                      localStorage.removeItem(`sg_contract_id_${ownerPublicKey}`);
                      setContractId(process.env.NEXT_PUBLIC_CONTRACT_ID || '');
                    }}
                    className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 font-medium text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Wallet Ownership Warning */}
        {ownerPublicKey && vault.owner && vault.owner !== ownerPublicKey && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold">Connected Wallet is Not the Vault Owner</p>
              <p className="text-amber-300/70">
                You are connected as <code className="text-white">{ownerPublicKey.slice(0, 6)}…{ownerPublicKey.slice(-6)}</code>, 
                but this vault belongs to <code className="text-white">{vault.owner.slice(0, 6)}…{vault.owner.slice(-6)}</code>.
              </p>
              <p className="mt-2">
                To configure your own legacy, please click <strong>"Change Vault Contract"</strong> above and link your own custom contract ID, or switch your wallet back to the owner account.
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {vault.error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-red-300/70">{vault.error}</p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {heartbeatSuccess && (
          <div
            role="status"
            className="mb-6 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300"
          >
            <span className="text-lg">✅</span>
            <p className="font-medium">Heartbeat submitted — countdown reset successfully.</p>
          </div>
        )}

        {/* Setup Banner — shown when no passkey is stored or contract is uninitialized */}
        {(isInitialized === false || !credentialIdHex) && isInitialized !== null && (
          <div className="mb-6 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
            <p className="mb-1 font-bold text-violet-300">
              {isInitialized === false ? '🚀 First-Time Setup Required' : '🔑 Link Your Passkey'}
            </p>
            <p className="mb-4 text-sm text-white/50">
              {isInitialized === false
                ? 'Register your biometric passkey to initialize the vault on-chain.'
                : 'No passkey found in this browser. Register your biometric to re-link it to this vault — this will update the on-chain passkey to match your current device.'}
            </p>
            <button
              onClick={handleSetup}
              disabled={setupPending || wallet.status !== 'connected'}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {setupPending ? 'Linking passkey…' : isInitialized ? 'Link Passkey to Vault' : 'Set Up Vault'}
            </button>
          </div>
        )}

        {/* ── Main Grid ─────────────────────────────────────────────────── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">

          {/* Countdown Panel — spans 2 cols on large */}
          <section
            aria-label="Inheritance countdown"
            className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl lg:col-span-2"
          >
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40">
              Estate Countdown
            </h2>
            {vault.loading ? (
              <SkeletonBlock className="h-52 w-52 rounded-full" />
            ) : vault.isClaimed ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="text-5xl">🏦</span>
                <p className="text-lg font-bold text-amber-400">Assets Claimed</p>
                <p className="text-sm text-white/40">The beneficiary has received all funds.</p>
              </div>
            ) : (
              <CountdownRing secondsRemaining={secondsRemaining} totalSeconds={totalSeconds} />
            )}
            {!vault.loading && !vault.isClaimed && (
              <p className="text-center text-xs text-white/30">
                {isExpired
                  ? 'Window expired — beneficiary can now claim.'
                  : `Check in before the timer reaches zero to prevent transfer.`}
              </p>
            )}
          </section>

          {/* Right Column — spans 3 cols */}
          <div className="flex flex-col gap-6 lg:col-span-3">

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
              {vault.loading ? (
                <>
                  <SkeletonBlock className="h-28" />
                  <SkeletonBlock className="h-28" />
                </>
              ) : (
                <>
                  <StatCard
                    label="Last Heartbeat"
                    icon="💓"
                    value={
                      vault.lastHeartbeat > 0n
                        ? new Date(Number(vault.lastHeartbeat) * 1000).toLocaleDateString()
                        : 'Never'
                    }
                    sub={
                      vault.lastHeartbeat > 0n
                        ? new Date(Number(vault.lastHeartbeat) * 1000).toLocaleTimeString()
                        : undefined
                    }
                  />
                  <StatCard
                    label="Check-in Window"
                    icon="⏱️"
                    value={`${(Number(vault.heartbeatWindow) / 86400).toFixed(1)} days`}
                    sub="Heartbeat interval"
                  />
                </>
              )}
            </div>

            {/* Heartbeat Action Card */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
              <h2 className="mb-1 text-base font-bold">Prove You're Alive</h2>
              <p className="mb-5 text-sm text-white/40">
                Use FaceID, TouchID, or Windows Hello to authenticate and reset the inheritance
                countdown. No private keys required.
              </p>
              <button
                id="heartbeat-btn"
                onClick={handleHeartbeat}
                disabled={heartbeatPending || vault.isClaimed}
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-violet-500/20 transition-all duration-200 hover:shadow-violet-500/40 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Trigger biometric heartbeat check-in"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {heartbeatPending ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying with biometrics…
                    </>
                  ) : (
                    <>
                      <span className="text-xl">👆</span>
                      Heartbeat Check-in
                    </>
                  )}
                </span>
                {/* Shine animation */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -translate-x-full bg-white/10 skew-x-12 transition-transform duration-700 group-hover:translate-x-full"
                />
              </button>
            </div>

            {/* Beneficiary Claim Card */}
            <div
              className={`rounded-3xl border p-6 backdrop-blur-xl transition-all duration-300 ${
                isExpired && !vault.isClaimed
                  ? 'border-amber-500/40 bg-amber-500/5 shadow-lg shadow-amber-500/10'
                  : 'border-white/10 bg-white/[0.03] opacity-60'
              }`}
            >
              <h2 className="mb-1 text-base font-bold">
                {vault.isClaimed ? '✅ Assets Claimed' : '🏦 Claim Inheritance'}
              </h2>
              <p className="mb-5 text-sm text-white/40">
                {vault.isClaimed
                  ? 'The estate has been transferred to the beneficiary.'
                  : isExpired
                  ? 'The heartbeat window has expired. The beneficiary may now claim all escrowed assets.'
                  : 'This panel activates once the check-in window lapses.'}
              </p>
              <button
                id="claim-btn"
                onClick={handleClaim}
                disabled={!isExpired || vault.isClaimed || claimPending}
                className="w-full rounded-2xl border border-amber-500/50 bg-amber-500/10 px-6 py-4 text-base font-bold text-amber-400 transition-all duration-200 hover:bg-amber-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Claim inheritance assets as beneficiary"
              >
                {claimPending ? 'Submitting claim…' : 'Claim Assets Now'}
              </button>
            </div>

          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 flex items-center justify-between text-xs text-white/20">
          <span>SafeGuard v0.1.0 — Stellar Testnet</span>
          <span>Built for Stellar Builder Challenge Level 4</span>
        </footer>
      </div>
    </main>
  );
}
