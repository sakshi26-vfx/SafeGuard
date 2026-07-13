/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
// SafeGuard Analytics - Production Event Tracking via PostHog

type EventProperties = Record<string, string | number | boolean | null | undefined>;

let posthogClient: any = null;

// Lazy-initialize PostHog
function getPostHog() {
  if (typeof window === 'undefined') return null;
  if (posthogClient) return posthogClient;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

  if (!key) {
    console.warn('[Analytics] NEXT_PUBLIC_POSTHOG_KEY not set. Events will be logged to console only.');
    return null;
  }

  try {
    const posthog = require('posthog-js').default;
    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
      autocapture: false,
      persistence: 'localStorage',
    });
    posthogClient = posthog;
    return posthogClient;
  } catch {
    console.warn('[Analytics] PostHog could not be initialized.');
    return null;
  }
}

function track(event: string, props: EventProperties = {}) {
  const ph = getPostHog();
  const payload = { ...props, timestamp: new Date().toISOString() };

  if (ph) {
    ph.capture(event, payload);
  }

  // Always log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Analytics] ${event}`, payload);
  }
}

// ─── Named Event Trackers ─────────────────────────────────────────────────────

export function trackVaultCreated(props: {
  ownerAddress: string;
  beneficiaryAddress: string;
  heartbeatWindowSeconds: number;
  tokenAddress: string;
  contractId: string;
}) {
  track('Vault Created', props);
}

export function trackHeartbeatTriggered(props: {
  ownerAddress: string;
  contractId: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  latencyMs?: number;
}) {
  track('Heartbeat Triggered', props);
}

export function trackDepositMade(props: {
  ownerAddress: string;
  contractId: string;
  amount: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}) {
  track('Deposit Made', props);
}

export function trackClaimFinalized(props: {
  beneficiaryAddress: string;
  contractId: string;
  claimedAmount: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}) {
  track('Claim Finalized', props);
}

export function trackSessionError(props: {
  stage: 'passkey_registration' | 'passkey_assertion' | 'contract_tx' | 'rpc_connection' | 'unknown';
  errorMessage: string;
  contractId?: string;
  userAddress?: string;
}) {
  track('Session Error', props);
}

export function trackPageView(page: string) {
  track('Page View', { page });
}
