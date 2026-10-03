// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
/// @notice Shared administrative foundation; ownership changes require acceptance.
abstract contract SuiteBase is Ownable2Step, Pausable, ReentrancyGuard {
    constructor(address admin) Ownable(admin) {}
    function setPaused(bool value) external onlyOwner {
        if (value) _pause();
        else _unpause();
    }
}
/// @notice Exact incoming ERC20 custody and checked native payouts.
library AssetFlow {
    using SafeERC20 for IERC20;
    function pullExact(IERC20 token, address from, uint256 amount) internal {
        require(amount > 0, "zero amount");
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        require(
            token.balanceOf(address(this)) - beforeBalance == amount,
            "nonstandard token"
        );
    }
    function sendNative(address recipient, uint256 amount) internal {
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "native payment failed");
    }
}
