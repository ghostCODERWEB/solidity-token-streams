# Deployment guide

No public-chain deployment is performed by tests.

1. Run `npm ci` and `npm test`.
2. Replace placeholders in `constructor.example.json` and save as gitignored `constructor.local.json`. Addresses must correspond to the intended chain; amounts use base units. Set future UNIX timestamps for `$START` and `$END`.
3. Set `RPC_URL`, `PRIVATE_KEY`, `EXPECTED_CHAIN_ID` and `CONSTRUCTOR_ARGS=constructor.local.json` in your local environment. Never commit keys.
4. `npm run deploy` checks chain ID, compiles, deploys `TokenStreams`, waits for its receipt and prints contract metadata. This command spends funds on the selected chain.
5. Verify source code and constructor values with the chosen explorer. Initialize funding, approvals and protocol settings described in the source; deploy script does not perform these actions.

Use a local or disposable test chain for experiments. Review the threat model and seek independent review before committing real assets. Runtime private keys are read only by the explicit deploy command, not compile or tests.
