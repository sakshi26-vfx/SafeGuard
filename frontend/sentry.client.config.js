// Sentry Client Configuration for SafeGuard Frontend
// This file is auto-loaded by Next.js as per Sentry's SDK configuration conventions.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  debug: process.env.NODE_ENV === 'development',

  // Attach user context from local storage when available
  beforeSend(event, hint) {
    const err = hint?.originalException;

    if (err instanceof Error) {
      // Capture Soroban/Stellar RPC contract panics
      if (err.message.includes('HostError') || err.message.includes('contract')) {
        event.tags = { ...event.tags, type: 'soroban_contract_error' };
        event.extra = { ...event.extra, sorobanError: err.message };
      }
      // Capture WebAuthn browser API rejections
      if (err.name === 'NotAllowedError' || err.message.includes('WebAuthn') || err.message.includes('biometric')) {
        event.tags = { ...event.tags, type: 'webauthn_rejection' };
        event.extra = { ...event.extra, webauthnError: err.message };
      }
      // RPC connection failures
      if (err.message.includes('RPC') || err.message.includes('Soroban') || err.message.includes('polling timed out')) {
        event.tags = { ...event.tags, type: 'rpc_connection_error' };
      }
    }
    return event;
  },

  integrations: [
    Sentry.breadcrumbsIntegration({
      console: true,
      dom: true,
      fetch: true,
      history: true,
    }),
  ],
});
