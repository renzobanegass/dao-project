// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Staking.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Governance
 * @dev Contract for creating and voting on governance proposals
 * @notice Uses staked tokens from Staking contract to determine voting power
 */
contract Governance is ReentrancyGuard, Ownable {

    /// @dev The Staking contract used to determine voting power
    Staking public immutable staking;

    /// @dev Quorum threshold in basis points (10000 = 100%)
    uint256 public quorum;

    /// @dev Counter for generating unique proposal IDs
    uint256 private _proposalCounter;

    /**
     * @dev Proposal data structure
     * @param id Unique identifier for the proposal
     * @param proposer Address that created the proposal
     * @param description Text description of the proposal
     * @param deadline Timestamp when voting ends
     * @param yesVotes Total voting power supporting the proposal
     * @param noVotes Total voting power opposing the proposal
     * @param executed Whether the proposal has been executed
     * @param quorum Quorum threshold required for this proposal
     */
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        uint256 quorum;
    }

    /// @dev Mapping of proposal ID to Proposal data
    mapping(uint256 => Proposal) public proposals;

    /// @dev Mapping of proposal ID to voter address to whether they have voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /**
     * @dev Emitted when a new proposal is created
     * @param proposalId The ID of the created proposal
     * @param proposer The address that created the proposal
     * @param description The proposal description
     * @param deadline The voting deadline timestamp
     */
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        uint256 deadline
    );

    /**
     * @dev Emitted when a vote is cast
     * @param proposalId The ID of the proposal voted on
     * @param voter The address that cast the vote
     * @param support Whether the vote was in favor (true) or against (false)
     * @param weight The voting power used
     */
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    /**
     * @dev Emitted when a proposal is executed
     * @param proposalId The ID of the executed proposal
     */
    event ProposalExecuted(uint256 indexed proposalId);

    /**
     * @dev Emitted when execution occurs (dummy execution event)
     * @param proposalId The ID of the proposal being executed
     * @param description The description of the executed proposal
     */
    event Execution(uint256 indexed proposalId, string description);

    /**
     * @dev Emitted when quorum is updated
     * @param oldQuorum The previous quorum value
     * @param newQuorum The new quorum value
     */
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);

    /**
     * @dev Constructor initializes the governance contract
     * @param _staking Address of the Staking contract
     * @param _quorum Initial quorum threshold in basis points (e.g., 2000 = 20%)
     */
    constructor(address _staking, uint256 _quorum) Ownable(msg.sender) {
        require(_staking != address(0), "Governance: invalid staking address");
        require(_quorum <= 10000, "Governance: quorum cannot exceed 100%");

        staking = Staking(_staking);
        quorum = _quorum;
    }

    /**
     * @dev Creates a new governance proposal
     * @param description Text description of the proposal
     * @param duration Time in seconds for how long voting will be open
     * @return proposalId The unique ID of the created proposal
     * @notice Requires caller to have voting power (staked tokens)
     */
    function createProposal(
        string calldata description,
        uint256 duration
    ) external returns (uint256 proposalId) {
        require(bytes(description).length > 0, "Governance: description cannot be empty");
        require(duration > 0, "Governance: duration must be greater than 0");
        require(staking.votingPower(msg.sender) > 0, "Governance: proposer must have voting power");

        proposalId = ++_proposalCounter;
        uint256 deadline = block.timestamp + duration;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            description: description,
            deadline: deadline,
            yesVotes: 0,
            noVotes: 0,
            executed: false,
            quorum: quorum
        });

        emit ProposalCreated(proposalId, msg.sender, description, deadline);
    }

    /**
     * @dev Casts a vote on a proposal
     * @param proposalId The ID of the proposal to vote on
     * @param support True for yes vote, false for no vote
     * @notice Voting power is determined by caller's staked balance
     * @notice Each address can only vote once per proposal
     */
    function vote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.id != 0, "Governance: proposal does not exist");
        require(block.timestamp <= proposal.deadline, "Governance: voting period has ended");
        require(!hasVoted[proposalId][msg.sender], "Governance: already voted");

        uint256 weight = staking.votingPower(msg.sender);
        require(weight > 0, "Governance: no voting power");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.yesVotes += weight;
        } else {
            proposal.noVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @dev Executes a proposal if conditions are met
     * @param proposalId The ID of the proposal to execute
     * @notice Proposal must be past deadline and meet quorum requirements
     */
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.id != 0, "Governance: proposal does not exist");
        require(block.timestamp > proposal.deadline, "Governance: voting period not ended");
        require(!proposal.executed, "Governance: proposal already executed");

        uint256 requiredQuorum = (staking.totalStaked() * proposal.quorum) / 10000;

        require(proposal.yesVotes >= requiredQuorum, "Governance: quorum not met");
        require(proposal.yesVotes > proposal.noVotes, "Governance: proposal rejected");

        proposal.executed = true;

        emit ProposalExecuted(proposalId);
        emit Execution(proposalId, proposal.description);
    }

    /**
     * @dev Updates the quorum threshold (only owner)
     * @param _quorum New quorum threshold in basis points
     */
    function setQuorum(uint256 _quorum) external onlyOwner {
        require(_quorum <= 10000, "Governance: quorum cannot exceed 100%");

        uint256 oldQuorum = quorum;
        quorum = _quorum;

        emit QuorumUpdated(oldQuorum, _quorum);
    }

    /**
     * @dev Returns the current proposal count
     * @return The total number of proposals created
     */
    function proposalCount() external view returns (uint256) {
        return _proposalCounter;
    }

    /**
     * @dev Returns full proposal details
     * @param proposalId The ID of the proposal to query
     * @return The complete Proposal struct
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposals[proposalId].id != 0, "Governance: proposal does not exist");
        return proposals[proposalId];
    }

    /**
     * @dev Checks if a proposal can be executed
     * @param proposalId The ID of the proposal to check
     * @return True if the proposal meets execution requirements
     */
    function canExecute(uint256 proposalId) external view returns (bool) {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.id == 0 || proposal.executed || block.timestamp <= proposal.deadline) {
            return false;
        }

        uint256 requiredQuorum = (staking.totalStaked() * proposal.quorum) / 10000;
        return proposal.yesVotes >= requiredQuorum && proposal.yesVotes > proposal.noVotes;
    }
}