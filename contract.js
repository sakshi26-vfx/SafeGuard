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
function parseScVal(val) {
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
export async function simulateCall(contractId, functionName, args = []) {
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
export async function buildInvokeTransaction(sourcePublicKey, contractId, functionName, args) {
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
  contractId,
  ownerPublicKey,
  passkeyBytes,
  beneficiaryPublicKey,
  windowSeconds,
  tokenAddress,
  signTxWithWallet
) {
  const ownerAddr = Address.fromString(ownerPublicKey).toScVal();
  const passkeyScVal = xdr.ScVal.scvBytes(passkeyBytes);
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
  contractId,
  ownerPublicKey,
  signatureBytes,
  clientDataJsonBytes,
  authenticatorDataBytes,
  signTxWithWallet
) {
  const args = [
    xdr.ScVal.scvBytes(signatureBytes),
    xdr.ScVal.scvBytes(clientDataJsonBytes),
    xdr.ScVal.scvBytes(authenticatorDataBytes),
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
  contractId,
  ownerPublicKey,
  newPasskeyBytes,
  signTxWithWallet
) {
  const passkeyScVal = xdr.ScVal.scvBytes(newPasskeyBytes);

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
  contractId,
  ownerPublicKey,
  amount,
  signTxWithWallet
) {
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
  contractId,
  beneficiaryPublicKey,
  signTxWithWallet
) {
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

export async function get_last_heartbeat(contractId) {
  const result = await simulateCall(contractId, 'get_last_heartbeat');
  return typeof result === 'bigint' ? result : BigInt(result || 0);
}

export async function get_heartbeat_window(contractId) {
  const result = await simulateCall(contractId, 'get_heartbeat_window');
  return typeof result === 'bigint' ? result : BigInt(result || 0);
}

export async function get_beneficiary(contractId) {
  return await simulateCall(contractId, 'get_beneficiary');
}

export async function get_owner(contractId) {
  return await simulateCall(contractId, 'get_owner');
}

export async function is_claimed(contractId) {
  return await simulateCall(contractId, 'is_claimed');
}
