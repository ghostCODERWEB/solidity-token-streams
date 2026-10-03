# Linear token stream escrow

Funded ERC20 streams with cliff-aware vesting, cancellation snapshots and permissionless beneficiary claims.

An original AI-assisted Solidity reference project with OpenZeppelin security primitives, event-driven accounting, executable local-EVM tests and reproducible compilation. This is distinct contract logic on shared build/test infrastructure. No production deployment or independent audit is claimed.

## Run

Node.js 22+; dependencies are pinned in the lockfile.

```sh
npm ci
npm test
```

Tests compile with solc 0.8.30, optimizer 200 runs, and the Shanghai EVM target, then deploy to an in-process local chain. Tests require no RPC account, wallet key or funds. `npm run compile` emits ABI, bytecode, storage layouts and contract-size metadata under `artifacts/`.

## Contract behavior

Cancellable streams freeze earned value at cancellation and return only unvested funds. Claims always go to the configured recipient. Incoming token amounts must match exactly. No rebasing or fee-on-transfer token support.

Read [the contract](contracts/TokenStreams.sol), [behavior tests](test/suite.mjs), [architecture](docs/architecture.md), [threat model](docs/threat-model.md) and [deployment guide](docs/deployment.md) and [ABI reference](docs/abi-reference.md).

## Security properties

- Explicit state transition and authorization checks.
- SafeERC20 transfers and exact incoming custody where applicable.
- Reentrancy protection around external transfers and calls.
- Checks/effects/interactions ordering for settlements.
- Replay or settlement flags where applicable.
- Two-step admin ownership and pause controls where the suite uses an administrator.
- Tests for successful flows, rejected transitions, timing and accounting.

## Status

Reference version 0.1.0. Mocks have unrestricted minting and are test-only. No claim of mainnet safety, formal verification, protocol compatibility or economic security. No tokens were deployed to a public chain.

MIT licensed.
