'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  isConnected as freighterIsConnected,
  requestAccess,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api';

export type WalletState =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; publicKey: string }
  | { status: 'error'; message: string };

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({ status: 'disconnected' });

  // Auto-reconnect if Freighter was previously connected
  useEffect(() => {
    const saved = localStorage.getItem('sg_wallet_pubkey');
    if (saved) {
      setTimeout(() => {
        setWallet({ status: 'connected', publicKey: saved });
      }, 0);
    }
  }, []);

  const connect = useCallback(async () => {
    setWallet({ status: 'connecting' });
    try {
      // Check if the Freighter extension is installed
      const connectionResult = await freighterIsConnected();
      if (!connectionResult.isConnected) {
        throw new Error(
          'Freighter wallet not detected. Please install it from freighter.app and refresh.'
        );
      }

      // Request access — prompts user to authorize the dApp and returns their public key
      const accessResult = await requestAccess();

      if (accessResult.error) {
        throw new Error(
          accessResult.error.message || 'Freighter access denied by user.'
        );
      }

      const pubkey = accessResult.address;
      if (!pubkey) {
        throw new Error('No public key returned from Freighter.');
      }

      localStorage.setItem('sg_wallet_pubkey', pubkey);
      setWallet({ status: 'connected', publicKey: pubkey });
      return pubkey;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet.';
      setWallet({ status: 'error', message });
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem('sg_wallet_pubkey');
    setWallet({ status: 'disconnected' });
  }, []);

  const signTransaction = useCallback(
    async (xdr: string, networkPassphrase?: string): Promise<string> => {
      if (wallet.status !== 'connected') throw new Error('Wallet not connected');

      const targetPassphrase = networkPassphrase || (
        process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'public'
          ? 'Public Global Stellar Network ; October 2015'
          : 'Test SDF Network ; September 2015'
      );

      const result = await freighterSignTransaction(xdr, {
        networkPassphrase: targetPassphrase,
        address: wallet.publicKey,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Transaction signing failed.');
      }

      return result.signedTxXdr;
    },
    [wallet]
  );

  return { wallet, connect, disconnect, signTransaction };
}
