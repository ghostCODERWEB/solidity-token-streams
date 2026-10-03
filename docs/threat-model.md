# Threat model

## Assumptions

Cancellable streams freeze earned value at cancellation and return only unvested funds. Claims always go to the configured recipient. Incoming token amounts must match exactly. No rebasing or fee-on-transfer token support.

## Asset boundaries

Incoming ERC20 transfers must credit the exact requested amount where `AssetFlow.pullExact` is used. Outgoing transfers assume standard ERC20 behavior. Fee-on-transfer, rebasing, blacklisting or malicious callback assets can break liveness or economic expectations; they are not supported. NFT receiver contracts can reject safe transfers, reverting settlements.

## Authority

Administrative functions are documented in the source and ABI. Two-step ownership prevents accidental transfer to an address that cannot accept ownership. Admin powers are still trusted powers; pause is not a substitute for independent risk controls. The threshold treasury has an immutable signer set rather than a single owner.

## Adversarial behavior

Replay protection and terminal-state checks prevent duplicate settlement where implemented. ReentrancyGuard protects external token/native/NFT interactions. Strict deadlines distinguish allowed phases. Slippage parameters bound caller-specified settlement outcomes where present. Malicious token behavior, censorship, front-running and external price manipulation remain material integration risks.

## Verification limits

Local tests cover the documented scenarios; they are not an audit, fuzzing campaign or formal proof. Before any real deployment: review access powers and economics, fuzz state transitions, test integration assets, conduct independent security review and define incident response.
