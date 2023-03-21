// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// Openzeppelin imports
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// Local imports
import "./VVToken.sol";

contract TestTokenVesting is Ownable {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        uint256 duration;
        uint256 amount;
        uint256 released;
        address beneficiary;
    }

    struct PrivateRoundInvestor {
        uint256 amount;
        uint256 released;
        uint256 start;
    }

    enum VestingScheduleType {
        OperationsAndReserve,
        Founders,
        StrategicPartners,
        Advisory,
        MarketingAndTechDevelopment,
        ExchangeListings,
        Private
    }

    uint256 private constant MONTH = 1000;
    uint256 private constant DECIMAL_FACTOR = 10 ** 18;

    uint256 private slicePeriodSeconds = MONTH;
    uint256 private privateRoundTotalAmount;

    uint256 public vestingStartTS = 10000000000;
    IERC20 public vvToken;
    VestingSchedule[7] public vestingSchedules;
    mapping(address => PrivateRoundInvestor) public privateRoundInvestors;

    constructor() {
        vvToken = new VVToken("Virtual Versions", "VV");

        vestingSchedules[
            uint256(VestingScheduleType.OperationsAndReserve)
        ] = VestingSchedule(
            35 * MONTH,
            437500000 * DECIMAL_FACTOR,
            0,
            0xbFf0805E5936E4fA114beC386AA8488BCb25a82a
        );
        vestingSchedules[
            uint256(VestingScheduleType.Founders)
        ] = VestingSchedule(
            47 * MONTH,
            150000000 * DECIMAL_FACTOR,
            0,
            0xCa7771912BDEA166e9aa9DeD193A52309042945D
        );
        vestingSchedules[
            uint256(VestingScheduleType.StrategicPartners)
        ] = VestingSchedule(
            47 * MONTH,
            70000000 * DECIMAL_FACTOR,
            0,
            0xF6Ee5f4d7c1DD7150B4eBefC2e6aF9C26459Eaf3
        );
        vestingSchedules[
            uint256(VestingScheduleType.Advisory)
        ] = VestingSchedule(
            11 * MONTH,
            60000000 * DECIMAL_FACTOR,
            0,
            0x92656587B0DB732e3d3E1604364521B7b8Efa175
        );
        vestingSchedules[
            uint256(VestingScheduleType.MarketingAndTechDevelopment)
        ] = VestingSchedule(
            23 * MONTH,
            70000000 * DECIMAL_FACTOR,
            0,
            0xe251F847aB1823c5D1B8DaDf4e52A1580380B4C0
        );
        vestingSchedules[
            uint256(VestingScheduleType.ExchangeListings)
        ] = VestingSchedule(
            35 * MONTH,
            75000000 * DECIMAL_FACTOR,
            0,
            0x827fdCf12C7f0146D587f87493EFab5755380449
        );
        vestingSchedules[
            uint256(VestingScheduleType.Private)
        ] = VestingSchedule(
            6 * MONTH,
            50000000 * DECIMAL_FACTOR,
            0,
            address(0)
        );
    }

    // Sets start time of the vesting
    function startVesting() external onlyOwner {
        require(
            vestingStartTS == 10000000000,
            "Vesting start timestamp is already set"
        );
        vestingStartTS = block.timestamp;

        // Unlock public round tokens
        vvToken.safeTransfer(
            0xA7B17C68540E9a82E670a47ea5541b93CF0093f0,
            62500000 * DECIMAL_FACTOR
        );

        // Unlock liquidity round tokens
        vvToken.safeTransfer(
            0x9FF75e4FC742beA3E3650E615827E71Ce2fd2Fcf,
            25000000 * DECIMAL_FACTOR
        );
    }

    // Adds new beneficiary for private round vesting
    function addPrivateVestingScheduleBeneficiary(
        address _beneficiary,
        uint256 _amount
    ) external onlyOwner {
        require(
            vestingSchedules[uint256(VestingScheduleType.Private)].amount -
                privateRoundTotalAmount >=
                _amount,
            "Can not create vesting schedule because of not sufficient tokens"
        );
        require(_amount > 0, "The amount must be greater than 0");
        require(
            privateRoundInvestors[_beneficiary].amount == 0,
            "Beneficiary is already exist"
        );
        privateRoundInvestors[_beneficiary] = PrivateRoundInvestor(
            _amount,
            0,
            block.timestamp
        );
        privateRoundTotalAmount += _amount;
    }

    // Unlocks the earned tockens (except private round) and allows to withdraw them
    function release(uint256 vestingScheduleId) external {
        require(
            vestingSchedules[vestingScheduleId].beneficiary != address(0),
            "Not correct id"
        );
        VestingSchedule storage vestingSchedule = vestingSchedules[
            vestingScheduleId
        ];
        bool isBeneficiary = msg.sender == vestingSchedule.beneficiary;
        bool isOwner = msg.sender == owner();
        require(
            isBeneficiary || isOwner,
            "Only beneficiary and owner can release vested tokens"
        );
        uint256 vestedAmount = _computeReleasableAmount(vestingSchedule);
        require(
            vestingSchedule.released + vestedAmount <= vestingSchedule.amount,
            "impossible to implement more than expected"
        );
        vestingSchedule.released += vestedAmount;
        address _beneficiary = vestingSchedule.beneficiary;
        vvToken.safeTransfer(_beneficiary, vestedAmount);
    }

    // Unlocks the earned private round tockens and allows to withdraw them
    function releaseForPrivateRoundInvestors(address _beneficiary) public {
        require(
            privateRoundInvestors[_beneficiary].amount > 0,
            "Unauthorized beneficiary"
        );
        require(
            msg.sender == owner() || msg.sender == _beneficiary,
            "Only beneficiary and owner can release vested tokens"
        );
        uint256 vestedAmount = computeReleasableAmountForPrivate(_beneficiary);
        require(
            privateRoundInvestors[_beneficiary].released + vestedAmount <=
                privateRoundInvestors[_beneficiary].amount,
            "impossible to implement more than expected"
        );
        privateRoundInvestors[_beneficiary].released += vestedAmount;
        vvToken.safeTransfer(_beneficiary, vestedAmount);
    }

    function computeReleasableAmount(
        uint256 VestingScheduleId
    ) external view returns (uint256) {
        VestingSchedule storage vestingSchedule = vestingSchedules[
            VestingScheduleId
        ];
        return _computeReleasableAmount(vestingSchedule);
    }

    function computeReleasableAmountForPrivate(
        address _beneficiary
    ) public view returns (uint256) {
        uint256 currentTime = block.timestamp;
        PrivateRoundInvestor
            memory _privateRoundInvestor = privateRoundInvestors[_beneficiary];
        uint256 duration = vestingSchedules[
            uint256(VestingScheduleType.Private)
        ].duration;
        if (currentTime < _privateRoundInvestor.start + slicePeriodSeconds) {
            return 0;
        } else if (currentTime >= _privateRoundInvestor.start + duration) {
            return
                _privateRoundInvestor.amount - _privateRoundInvestor.released;
        } else {
            uint256 timeFromStart = currentTime - _privateRoundInvestor.start;
            uint256 vestedSlicePeriods = timeFromStart / slicePeriodSeconds;
            uint256 vestedSeconds = vestedSlicePeriods * slicePeriodSeconds;
            uint256 vestedAmount = (_privateRoundInvestor.amount *
                vestedSeconds) / duration;
            vestedAmount -= _privateRoundInvestor.released;
            return vestedAmount;
        }
    }

    function _computeReleasableAmount(
        VestingSchedule memory vestingSchedule
    ) internal view returns (uint256) {
        uint256 currentTime = block.timestamp;
        if (currentTime < vestingStartTS + slicePeriodSeconds) {
            return 0;
        } else if (currentTime >= vestingStartTS + vestingSchedule.duration) {
            return vestingSchedule.amount - vestingSchedule.released;
        } else {
            uint256 timeFromStart = currentTime - vestingStartTS;
            uint256 vestedSlicePeriods = timeFromStart / slicePeriodSeconds;

            uint256 vestedSeconds = vestedSlicePeriods * slicePeriodSeconds;
            uint256 vestedAmount = (vestingSchedule.amount * vestedSeconds) /
                vestingSchedule.duration;
            vestedAmount -= vestingSchedule.released;
            return vestedAmount;
        }
    }

    function withdrawEth(uint256 amount) external onlyOwner {
        address payable to = payable(msg.sender);
        to.transfer(amount);
    }

    function withdrawToken(address tokenAddress) external onlyOwner {
        require(tokenAddress != address(vvToken), "vvToken is not withdrawable");
        ERC20 token = ERC20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_msgSender(), balance);
    }

    function getCurrentMonth() external view returns (uint256) {
        uint256 currenttime = block.timestamp;
        uint256 currentMonth = ((currenttime - vestingStartTS) / MONTH);
        return currentMonth;
    }

    function getBalance(address _beneficiary)public view returns(uint256){
        return vvToken.balanceOf(_beneficiary);
    }

    receive() external payable {}

    fallback() external payable {}
    
}
