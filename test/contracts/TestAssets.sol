// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
/// @dev Test-only unrestricted minting token; never deploy as a financial asset.
contract TestToken is ERC20 {
    constructor() ERC20("Test Asset", "TEST") {}
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
/// @dev Test-only unrestricted ERC721 mint helper.
contract TestNFT is ERC721 {
    constructor() ERC721("Test NFT", "TNFT") {}
    function mint(address account, uint256 id) external {
        _mint(account, id);
    }
}
/// @dev Incoming transfer burns 10%; custody contracts must reject this asset.
contract FeeToken is ERC20 {
    constructor() ERC20("Fee Test", "FEE") {}
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = amount / 10;
            super._update(from, address(0), fee);
            super._update(from, to, amount - fee);
        } else super._update(from, to, amount);
    }
}
/// @dev Test recipient that deliberately refuses native payouts.
contract RejectNative {
    receive() external payable {
        revert("reject");
    }
}

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AssetFlow} from "../../contracts/SuiteBase.sol";
/// @dev Adversarial test surface for shared transfer primitives.
contract CustodyHarness is ReentrancyGuard {
    receive() external payable {}
    function pull(address asset, uint256 amount) external nonReentrant {
        AssetFlow.pullExact(IERC20(asset), msg.sender, amount);
    }
    function pay(address recipient, uint256 amount) external nonReentrant {
        AssetFlow.sendNative(recipient, amount);
    }
}
contract ReenteringReceiver {
    CustodyHarness private target;
    function attack(address vault) external {
        target = CustodyHarness(payable(vault));
        target.pay(address(this), 1);
    }
    receive() external payable {
        target.pay(address(this), 1);
    }
}
