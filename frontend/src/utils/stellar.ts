import {
  Account,
  Networks,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
  Address,
} from '@stellar/stellar-sdk';
import { hexToBytes } from './webauthn';

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC || 'https://soroban-testnet.stellar.org:443';
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'public'
  ? Networks.PUBLIC
  : Networks.TESTNET;

export const rpcServer = new rpc.Server(RPC_URL);

// Helper: Convert ScVal to native JS types
function parseScVal(val: xdr.ScVal): any {
  switch (val.switch()) {
    case xdr.ScValType.scvBool():
      return val.b();
    case xdr.ScValType.scvU64():
      return val.u64().toBigInt();
    case xdr.ScValType.scvI128():
      const i128Val = val.i128();
      return (i128Val.hi().toBigInt() << 64n) + i128Val.lo().toBigInt();
    case xdr.ScValType.scvAddress():
      return Address.fromScVal(val).toString();
    case xdr.ScValType.scvBytes():
      return val.bytes();
    default:
      return null;
  }
}

// Helper: Read-only contract calls (via simulation)
async function simulateCall(
  contractId: string,
  functionName: string,
  args: xdr.ScVal[] = []
): Promise<any> {
  // Construct a dummy Account locally for simulation — no network call needed.
  // This avoids StrKey validation errors and eliminates an unnecessary RPC round-trip.
  const dummySource = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  const account = new Account(dummySource, '0');

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        args,
      })
    )
    .setTimeout(30)
    .build();

  const simResult = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationSuccess(simResult)) {
    if (simResult.result && simResult.result.retval) {
      return parseScVal(simResult.result.retval);
    }
  } else {
    throw new Error(`Simulation failed for ${functionName}: ${JSON.stringify(simResult)}`);
  }
  return null;
}

// Read-only getters
export async function getHeartbeatWindow(contractId: string): Promise<bigint> {
  const result = await simulateCall(contractId, 'get_heartbeat_window');
  return typeof result === 'bigint' ? result : BigInt(result || 0);
}

export async function getLastHeartbeat(contractId: string): Promise<bigint> {
  const result = await simulateCall(contractId, 'get_last_heartbeat');
  return typeof result === 'bigint' ? result : BigInt(result || 0);
}

export async function getBeneficiary(contractId: string): Promise<string> {
  return await simulateCall(contractId, 'get_beneficiary');
}

export async function getOwner(contractId: string): Promise<string> {
  return await simulateCall(contractId, 'get_owner');
}

export async function isClaimed(contractId: string): Promise<boolean> {
  return await simulateCall(contractId, 'is_claimed');
}

// Transaction Helpers: Invoking state-changing functions
export async function buildInvokeTransaction(
  sourcePublicKey: string,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[]
) {
  const account = await rpcServer.getAccount(sourcePublicKey);
  const tx = new TransactionBuilder(account, {
    fee: '100000', // Baseline fee, will be updated by simulation
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        args,
      })
    )
    .setTimeout(60)
    .build();

  // Simulate to calculate fees and resource footprints
  const sim = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`Transaction simulation failed: ${JSON.stringify(sim)}`);
  }

  // Assemble transaction with simulation resources
  return rpc.assembleTransaction(tx, sim).build();
}

// Poll transaction results
export async function pollTransactionStatus(txHash: string): Promise<rpc.Api.GetTransactionResponse> {
  let attempts = 0;
  while (attempts < 20) {
    const status = await rpcServer.getTransaction(txHash);
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return status;
    } else if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.resultXdr)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;
  }
  throw new Error('Transaction polling timed out.');
}

// Submit Contract Initialization (first-time setup)
export async function submitInitialize(
  contractId: string,
  ownerPublicKey: string,
  publicKeyHex: string,
  beneficiaryPublicKey: string,
  windowSeconds: bigint,
  tokenAddress: string,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string>
): Promise<string> {
  // owner Address ScVal
  const ownerAddr = Address.fromString(ownerPublicKey).toScVal();

  // passkey_bytes: 65-byte uncompressed public key as scvBytes
  const pkBytes = hexToBytes(publicKeyHex);
  const passkeyScVal = xdr.ScVal.scvBytes(pkBytes as any);

  // beneficiary Address ScVal
  const beneficiaryAddr = Address.fromString(beneficiaryPublicKey).toScVal();

  // window u64 ScVal
  const windowScVal = xdr.ScVal.scvU64(new xdr.Uint64(windowSeconds));

  // token Address ScVal
  const tokenAddr = Address.fromString(tokenAddress).toScVal();

  const args = [ownerAddr, passkeyScVal, beneficiaryAddr, windowScVal, tokenAddr];
  const assembledTx = await buildInvokeTransaction(ownerPublicKey, contractId, 'initialize', args);
  const signedTxXdr = await signTxWithWallet(assembledTx.toXDR(), NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  );

  if (submission.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
  }

  const receipt = await pollTransactionStatus(submission.hash);
  return receipt.txHash;
}

// Update the stored passkey public key (owner-only). Use this to re-link a new
// browser passkey after the contract is already initialized.
export async function submitUpdatePasskey(
  contractId: string,
  ownerPublicKey: string,
  newPublicKeyHex: string,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string>
): Promise<string> {
  const pkBytes = hexToBytes(newPublicKeyHex);
  const passkeyScVal = xdr.ScVal.scvBytes(pkBytes as any);

  const assembledTx = await buildInvokeTransaction(
    ownerPublicKey,
    contractId,
    'update_passkey',
    [passkeyScVal]
  );
  const signedTxXdr = await signTxWithWallet(assembledTx.toXDR(), NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  );

  if (submission.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
  }

  const receipt = await pollTransactionStatus(submission.hash);
  return receipt.txHash;
}

// Submit Owner Heartbeat Check-in
export async function submitHeartbeat(
  contractId: string,
  ownerPublicKey: string,
  signatureHex: string,
  clientDataJsonHex: string,
  authenticatorDataHex: string,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string> // Wallet signing integration (e.g. Freighter)
): Promise<string> {
  const args = [
    xdr.ScVal.scvBytes(hexToBytes(signatureHex) as any),
    xdr.ScVal.scvBytes(hexToBytes(clientDataJsonHex) as any),
    xdr.ScVal.scvBytes(hexToBytes(authenticatorDataHex) as any),
  ];

  const assembledTx = await buildInvokeTransaction(ownerPublicKey, contractId, 'heartbeat', args);
  
  // Sign and submit transaction
  const signedTxXdr = await signTxWithWallet(assembledTx.toXDR(), NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE));

  if (submission.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
  }

  const receipt = await pollTransactionStatus(submission.hash);
  return receipt.txHash;
}

// Submit Deposit of Escrow Assets
export async function submitDeposit(
  contractId: string,
  ownerPublicKey: string,
  amount: bigint,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string>
): Promise<string> {
  // Convert amount to i128 ScVal representation
  // We represent i128 using high and low parts (each 64-bit)
  const hi = new xdr.Int64(amount >> 64n);
  const lo = new xdr.Uint64(amount & 0xffffffffffffffffn);
  const scvAmount = xdr.ScVal.scvI128(new xdr.Int128Parts({ hi, lo }));

  const assembledTx = await buildInvokeTransaction(ownerPublicKey, contractId, 'deposit', [scvAmount]);
  const signedTxXdr = await signTxWithWallet(assembledTx.toXDR(), NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE));

  if (submission.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
  }

  const receipt = await pollTransactionStatus(submission.hash);
  return receipt.txHash;
}

// Submit Beneficiary Inheritance Claim
export async function submitClaim(
  contractId: string,
  beneficiaryPublicKey: string,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string>
): Promise<string> {
  const assembledTx = await buildInvokeTransaction(beneficiaryPublicKey, contractId, 'claim_assets', []);
  const signedTxXdr = await signTxWithWallet(assembledTx.toXDR(), NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE));

  if (submission.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
  }

  const receipt = await pollTransactionStatus(submission.hash);
  return receipt.txHash;
}
