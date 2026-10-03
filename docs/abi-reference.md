# ABI reference

Generated from the successfully compiled primary contract. Includes inherited OpenZeppelin methods. Authorization requirements and economic semantics are in the Solidity source and architecture guide.

| Signature | Type | Mutability | Return values |
|---|---|---|---|
| `constructor(address asset,address admin)` | constructor | nonpayable |  |
| `EnforcedPause()` | error |  |  |
| `ExpectedPause()` | error |  |  |
| `OwnableInvalidOwner(address owner)` | error |  |  |
| `OwnableUnauthorizedAccount(address account)` | error |  |  |
| `ReentrancyGuardReentrantCall()` | error |  |  |
| `SafeERC20FailedOperation(address token)` | error |  |  |
| `Cancelled(uint256 id,uint256 refund)` | event |  |  |
| `Claimed(uint256 id,uint256 amount)` | event |  |  |
| `Created(uint256 id,address sender,address recipient,uint256 total)` | event |  |  |
| `OwnershipTransferStarted(address previousOwner,address newOwner)` | event |  |  |
| `OwnershipTransferred(address previousOwner,address newOwner)` | event |  |  |
| `Paused(address account)` | event |  |  |
| `Unpaused(address account)` | event |  |  |
| `acceptOwnership()` | function | nonpayable |  |
| `cancel(uint256 id)` | function | nonpayable |  |
| `claim(uint256 id)` | function | nonpayable | uint256 amount |
| `create(address recipient,uint64 start,uint64 end,uint64 cliff,uint256 amount,bool cancellable)` | function | nonpayable | uint256 id |
| `liability()` | function | view | uint256  |
| `nextId()` | function | view | uint256  |
| `owner()` | function | view | address  |
| `paused()` | function | view | bool  |
| `pendingOwner()` | function | view | address  |
| `renounceOwnership()` | function | nonpayable |  |
| `setPaused(bool value)` | function | nonpayable |  |
| `streams(uint256 )` | function | view | address sender, address recipient, uint64 start, uint64 end, uint64 cliff, uint64 stopped, uint256 total, uint256 claimed, bool cancellable |
| `token()` | function | view | address  |
| `transferOwnership(address newOwner)` | function | nonpayable |  |
| `vested(uint256 id)` | function | view | uint256  |
