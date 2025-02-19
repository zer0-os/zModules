// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Governor } from "@openzeppelin/contracts/governance/Governor.sol";
import { GovernorSettings } from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import { GovernorCountingSimple } from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import { GovernorVotes, IVotes } from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {
    GovernorTimelockControl,
    TimelockController
} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {
    GovernorVotesQuorumFraction
} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import { GovernorPreventLateQuorum } from "@openzeppelin/contracts/governance/extensions/GovernorPreventLateQuorum.sol";


/**
 * @title ZDAO
 *
 * @notice A customizable governance contract based on OpenZeppelin's Governor contracts.
 *
 * @dev Extends OpenZeppelin's Governor contracts with various extensions for governance settings,
 * voting, timelock control, and quorum fraction.
 * See OpenZeppelin documentation: https://docs.openzeppelin.com/contracts/4.x/api/governance
 * This is a fork of https://github.com/zer0-os/zDAO/blob/main/contracts/ZDAO.sol
 * With updated parent contracts and Solidity version.
 */
contract ZDAO is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorTimelockControl,
    GovernorVotesQuorumFraction,
    GovernorPreventLateQuorum {
    /**
     * @notice Creates a new ZDAO governance contract.
     *
     * @dev Initializes the governor with settings and extensions.
     * See OpenZeppelin Governor documentation: https://docs.openzeppelin.com/contracts/4.x/api/governance
     *
     * @param governorName The name of the governor instance.
     * @param token The governance token that allows users to vote.
     * @param timelock The timelock controller that handles proposal execution delay.
     * @param delay_ The delay before voting starts (in blocks).
     * @param votingPeriod_ The duration of the voting period (in blocks).
     * @param proposalThreshold_ The minimum number of votes required to create a proposal.
     * @param quorumPercentage_ The quorum fraction required for a proposal to pass.
     * @param voteExtension_ The time in either number of blocks that is required to pass
     *  since the moment a proposal reaches quorum until its voting period ends
     */
    constructor(
        string memory governorName,
        IVotes token,
        TimelockController timelock,
        uint48 delay_,
        uint32 votingPeriod_,
        uint256 proposalThreshold_,
        uint256 quorumPercentage_,
        uint48 voteExtension_
    )
        Governor(governorName)
        GovernorVotes(token)
        GovernorTimelockControl(timelock)
        GovernorSettings(
            delay_,
            votingPeriod_,
            proposalThreshold_
        )
        GovernorVotesQuorumFraction(quorumPercentage_)
        GovernorPreventLateQuorum(voteExtension_) {}

    function votingDelay()
    public
    view
    override(Governor, GovernorSettings)
    returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod()
    public
    view
    override(Governor, GovernorSettings)
    returns (uint256) {
        return super.votingPeriod();
    }

    function proposalThreshold()
    public
    view
    override (Governor, GovernorSettings)
    returns (uint256) {
        return super.proposalThreshold();
    }

    function quorum(uint256 blockNumber)
    public
    view
    override(Governor, GovernorVotesQuorumFraction)
    returns (uint256) {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId)
    public
    view
    override(Governor, GovernorTimelockControl)
    returns (ProposalState) {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
    public
    view
    override(Governor, GovernorTimelockControl)
    returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }

    /**
     * @notice Returns the proposal deadline in blocks.
     *
     * @dev Overrides the function from Governor and GovernorPreventLateQuorum.
     *
     * @param proposalId The ID of the proposal.
     */
    function proposalDeadline(uint256 proposalId)
    public
    view
    override(Governor, GovernorPreventLateQuorum)
    returns (uint256) {
        return super.proposalDeadline(proposalId);
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    override
    returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
    internal
    override(Governor, GovernorTimelockControl)
    returns (uint48) {
        return super._queueOperations(
            proposalId,
            targets,
            values,
            calldatas,
            descriptionHash
        );
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
    internal
    override(Governor, GovernorTimelockControl) {
        super._executeOperations(
            proposalId,
            targets,
            values,
            calldatas,
            descriptionHash
        );
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
    internal
    override(Governor, GovernorTimelockControl)
    returns (uint256) {
        return super._cancel(
            targets,
            values,
            calldatas,
            descriptionHash
        );
    }

    function _castVote(
        uint256 proposalId,
        address account,
        uint8 support,
        string memory reason,
        bytes memory params
    )
    internal
    override(Governor, GovernorPreventLateQuorum)
    returns (uint256) {
        return super._castVote(
            proposalId,
            account,
            support,
            reason,
            params
        );
    }

    function _executor()
    internal
    view
    override(Governor, GovernorTimelockControl)
    returns (address) {
        return super._executor();
    }
}
