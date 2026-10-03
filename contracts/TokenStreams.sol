// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {SuiteBase, AssetFlow} from "./SuiteBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Linear token stream escrow
/// @notice Funded ERC20 streams with cliff-aware vesting, cancellation snapshots and permissionless beneficiary claims.
/// @dev Reference implementation; independent audit required before production.

contract TokenStreams is SuiteBase {
    using SafeERC20 for IERC20;
    IERC20 public immutable token;
    uint256 public nextId;
    uint256 public liability;
    struct Stream {
        address sender;
        address recipient;
        uint64 start;
        uint64 end;
        uint64 cliff;
        uint64 stopped;
        uint256 total;
        uint256 claimed;
        bool cancellable;
    }
    mapping(uint256 => Stream) public streams;
    event Created(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 total
    );
    event Claimed(uint256 indexed id, uint256 amount);
    event Cancelled(uint256 indexed id, uint256 refund);
    constructor(address asset, address admin) SuiteBase(admin) {
        require(asset.code.length > 0, "asset");
        token = IERC20(asset);
    }
    function create(
        address recipient,
        uint64 start,
        uint64 end,
        uint64 cliff,
        uint256 amount,
        bool cancellable
    ) external nonReentrant whenNotPaused returns (uint256 id) {
        require(
            recipient != address(0) &&
                end > start &&
                cliff >= start &&
                cliff <= end &&
                end > block.timestamp &&
                amount > 0,
            "stream"
        );
        AssetFlow.pullExact(token, msg.sender, amount);
        id = ++nextId;
        streams[id] = Stream(
            msg.sender,
            recipient,
            start,
            end,
            cliff,
            0,
            amount,
            0,
            cancellable
        );
        liability += amount;
        emit Created(id, msg.sender, recipient, amount);
    }
    function vested(uint256 id) public view returns (uint256) {
        Stream memory s = streams[id];
        if (s.recipient == address(0)) return 0;
        uint256 time = s.stopped > 0 ? s.stopped : block.timestamp;
        if (time < s.cliff) return 0;
        if (time >= s.end) return s.total;
        if (time <= s.start) return 0;
        return Math.mulDiv(s.total, time - s.start, s.end - s.start);
    }
    function claim(uint256 id) external nonReentrant returns (uint256 amount) {
        Stream storage s = streams[id];
        require(s.recipient != address(0), "stream");
        amount = vested(id) - s.claimed;
        require(amount > 0, "nothing vested");
        s.claimed += amount;
        liability -= amount;
        token.safeTransfer(s.recipient, amount);
        emit Claimed(id, amount);
    }
    function cancel(uint256 id) external nonReentrant {
        Stream storage s = streams[id];
        require(
            s.sender == msg.sender && s.cancellable && s.stopped == 0,
            "cancel"
        );
        s.stopped = uint64(block.timestamp);
        uint256 earned = vested(id);
        uint256 refund = s.total - earned;
        liability -= refund;
        token.safeTransfer(s.sender, refund);
        emit Cancelled(id, refund);
    }
}
