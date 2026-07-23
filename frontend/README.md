# SafeGuard Frontend: Biometric Asset Inheritance Dashboard

[![SafeGuard CI/CD](https://github.com/sakshi26-vfx/SafeGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/sakshi26-vfx/SafeGuard/actions)

This directory contains the frontend code for **SafeGuard**, a decentralized asset inheritance protocol. It is built as a Next.js 16 application using React 19, TypeScript, and Tailwind CSS v4, integrated with the `@stellar/stellar-sdk` and Freighter API.

---

## Key Features

- **Biometric Passkey Registration:** Prompts users to register platform biometrics (FaceID/TouchID/Windows Hello) to set up their estate key.
- **On-Chain Transaction dispatch:** Uses Freighter wallet to sign and submit smart contract transactions (`initialize`, `deposit`, `heartbeat`, `claim_assets`).
- **Interactive Onboarding:** Guided walk-through explaining exactly how the protocol works step-by-step.
- **Diagnostics Console:** Real-time checking of browser features, RPC connectivity, and environment variables.

---

## Local Development

### 1. Prerequisites

Ensure you have Node.js (v20+) and Freighter wallet extension installed in your browser.

### 2. Configure Environment Variables

Create `.env.local` containing the active contract address (already pre-configured with a live testnet contract):
```env
NEXT_PUBLIC_CONTRACT_ID=...
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_BENEFICIARY=...
NEXT_PUBLIC_TOKEN_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.
