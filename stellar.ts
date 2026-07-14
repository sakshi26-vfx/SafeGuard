import {
  Account,
  Address,
  Contract,
  Networks,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

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
export async function simulateCall(
  contractId: string,
  functionName: string,
  args: xdr.ScVal[] = []
): Promise<any> {
  const contract = new Contract(contractId);
  const dummySource = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  const account = new Account(dummySource, '0');

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contract.address.toString(),
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

// Transaction Helpers: Invoking state-changing functions
export async function buildInvokeTransaction(
  sourcePublicKey: string,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[]
) {
  const account = await rpcServer.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contract.address.toString(),
        function: functionName,
        args,
      })
    )
    .setTimeout(60)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`Transaction simulation failed: ${JSON.stringify(sim)}`);
  }

  return rpc.assembleTransaction(tx, sim).build();
}

// --- Contract Wrapper Functions matching the contract methods ---

export async function initialize(
  contractId: string,
  ownerPublicKey: string,
  passkeyBytes: Uint8Array,
  beneficiaryPublicKey: string,
  windowSeconds: bigint,
  tokenAddress: string,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string>
): Promise<string> {
  const ownerAddr = Address.fromString(ownerPublicKey).toScVal();
  const passkeyScVal = xdr.ScVal.scvBytes(passkeyBytes as any);
  const beneficiaryAddr = Address.fromString(beneficiaryPublicKey).toScVal();
  const windowScVal = xdr.ScVal.scvU64(new xdr.Uint64(windowSeconds));
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
  return submission.hash;
}

export async function heartbeat(
  contractId: string,
  ownerPublicKey: string,
  signatureBytes: Uint8Array,
  clientDataJsonBytes: Uint8Array,
  authenticatorDataBytes: Uint8Array,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string>
): Promise<string> {
  const args = [
    xdr.ScVal.scvBytes(signatureBytes as any),
    xdr.ScVal.scvBytes(clientDataJsonBytes as any),
    xdr.ScVal.scvBytes(authenticatorDataBytes as any),
  ];

  const assembledTx = await buildInvokeTransaction(ownerPublicKey, contractId, 'heartbeat', args);
  const signedTxXdr = await signTxWithWallet(assembledTx.toXDR(), NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  );

  if (submission.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
  }
  return submission.hash;
}

export async function update_passkey(
  contractId: string,
  ownerPublicKey: string,
  newPasskeyBytes: Uint8Array,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string>
): Promise<string> {
  const passkeyScVal = xdr.ScVal.scvBytes(newPasskeyBytes as any);

  const assembledTx = await buildInvokeTransaction(ownerPublicKey, contractId, 'update_passkey', [passkeyScVal]);
  const signedTxXdr = await signTxWithWallet(assembledTx.toXDR(), NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  );

  if (submission.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
  }
  return submission.hash;
}

export async function deposit(
  contractId: string,
  ownerPublicKey: string,
  amount: bigint,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string>
): Promise<string> {
  const hi = new xdr.Int64(amount >> 64n);
  const lo = new xdr.Uint64(amount & 0xffffffffffffffffn);
  const scvAmount = xdr.ScVal.scvI128(new xdr.Int128Parts({ hi, lo }));

  const assembledTx = await buildInvokeTransaction(ownerPublicKey, contractId, 'deposit', [scvAmount]);
  const signedTxXdr = await signTxWithWallet(assembledTx.toXDR(), NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  );

  if (submission.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
  }
  return submission.hash;
}

export async function claim_assets(
  contractId: string,
  beneficiaryPublicKey: string,
  signTxWithWallet: (tx: string, networkPassphrase?: string) => Promise<string>
): Promise<string> {
  const assembledTx = await buildInvokeTransaction(beneficiaryPublicKey, contractId, 'claim_assets', []);
  const signedTxXdr = await signTxWithWallet(assembledTx.toXDR(), NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  );

  if (submission.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
  }
  return submission.hash;
}

export async function get_last_heartbeat(contractId: string): Promise<bigint> {
  const result = await simulateCall(contractId, 'get_last_heartbeat');
  return typeof result === 'bigint' ? result : BigInt(result || 0);
}

export async function get_heartbeat_window(contractId: string): Promise<bigint> {
  const result = await simulateCall(contractId, 'get_heartbeat_window');
  return typeof result === 'bigint' ? result : BigInt(result || 0);
}

export async function get_beneficiary(contractId: string): Promise<string> {
  return await simulateCall(contractId, 'get_beneficiary');
}

export async function get_owner(contractId: string): Promise<string> {
  return await simulateCall(contractId, 'get_owner');
}

export async function is_claimed(contractId: string): Promise<boolean> {
  return await simulateCall(contractId, 'is_claimed');
}
