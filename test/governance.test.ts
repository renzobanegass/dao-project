import { expect } from "chai";
import { ethers } from "hardhat";
import { MyToken, MyToken__factory, Staking, Staking__factory, Governance, Governance__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Governance", function () {
  let token: MyToken;
  let staking: Staking;
  let governance: Governance;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  let addr3: HardhatEthersSigner;

  const QUORUM_PERCENTAGE = 2000; // 20%

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const MyTokenFactory = new MyToken__factory(owner);
    token = await MyTokenFactory.deploy();
    await token.waitForDeployment();

    const StakingFactory = new Staking__factory(owner);
    staking = await StakingFactory.deploy(await token.getAddress());
    await staking.waitForDeployment();

    const GovernanceFactory = new Governance__factory(owner);
    governance = await GovernanceFactory.deploy(
      await staking.getAddress(),
      QUORUM_PERCENTAGE
    );
    await governance.waitForDeployment();

    await token.transfer(addr1.address, ethers.parseEther("100000"));
    await token.transfer(addr2.address, ethers.parseEther("50000"));
    await token.transfer(addr3.address, ethers.parseEther("25000"));

    const stakeAmount1 = ethers.parseEther("10000");
    const stakeAmount2 = ethers.parseEther("5000");
    await token.connect(addr1).approve(await staking.getAddress(), stakeAmount1);
    await token.connect(addr2).approve(await staking.getAddress(), stakeAmount2);
    await staking.connect(addr1).stake(stakeAmount1);
    await staking.connect(addr2).stake(stakeAmount2);
  });

  describe("Deployment", function () {
    it("Should set the correct staking contract", async function () {
      expect(await governance.staking()).to.equal(await staking.getAddress());
    });

    it("Should set the correct initial quorum", async function () {
      expect(await governance.quorum()).to.equal(QUORUM_PERCENTAGE);
    });

    it("Should set the correct owner", async function () {
      expect(await governance.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero proposals", async function () {
      expect(await governance.proposalCount()).to.equal(0);
    });

    it("Should revert with invalid staking address", async function () {
      const GovernanceFactory = new Governance__factory(owner);
      await expect(GovernanceFactory.deploy(ethers.ZeroAddress, QUORUM_PERCENTAGE))
        .to.be.revertedWith("Governance: invalid staking address");
    });

    it("Should revert with quorum over 100%", async function () {
      const GovernanceFactory = new Governance__factory(owner);
      await expect(GovernanceFactory.deploy(await staking.getAddress(), 10001))
        .to.be.revertedWith("Governance: quorum cannot exceed 100%");
    });
  });

  describe("Proposal Creation", function () {
    it("Should allow users with voting power to create proposals", async function () {
      const description = "Test proposal";
      const duration = 86400; // 1 day

      await expect(governance.connect(addr1).createProposal(description, duration))
        .to.emit(governance, "ProposalCreated")
        .withArgs(1, addr1.address, description, await time.latest() + duration + 1);

      expect(await governance.proposalCount()).to.equal(1);

      const proposal = await governance.getProposal(1);
      expect(proposal.proposer).to.equal(addr1.address);
      expect(proposal.description).to.equal(description);
      expect(proposal.yesVotes).to.equal(0);
      expect(proposal.noVotes).to.equal(0);
      expect(proposal.executed).to.be.false;
    });

    it("Should fail if user has no voting power", async function () {
      const description = "Test proposal";
      const duration = 86400;

      await expect(governance.connect(addr3).createProposal(description, duration))
        .to.be.revertedWith("Governance: proposer must have voting power");
    });

    it("Should fail with empty description", async function () {
      const duration = 86400;

      await expect(governance.connect(addr1).createProposal("", duration))
        .to.be.revertedWith("Governance: description cannot be empty");
    });

    it("Should fail with zero duration", async function () {
      const description = "Test proposal";

      await expect(governance.connect(addr1).createProposal(description, 0))
        .to.be.revertedWith("Governance: duration must be greater than 0");
    });

    it("Should increment proposal counter correctly", async function () {
      const description = "Test proposal";
      const duration = 86400;

      await governance.connect(addr1).createProposal(description + " 1", duration);
      await governance.connect(addr2).createProposal(description + " 2", duration);

      expect(await governance.proposalCount()).to.equal(2);
    });
  });

  describe("Voting", function () {
    let proposalId: number;

    beforeEach(async function () {
      const description = "Test proposal";
      const duration = 86400;
      await governance.connect(addr1).createProposal(description, duration);
      proposalId = 1;
    });

    it("Should allow users with voting power to vote", async function () {
      const expectedWeight = await staking.votingPower(addr1.address);

      await expect(governance.connect(addr1).vote(proposalId, true))
        .to.emit(governance, "VoteCast")
        .withArgs(proposalId, addr1.address, true, expectedWeight);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.yesVotes).to.equal(expectedWeight);
      expect(proposal.noVotes).to.equal(0);
    });

    it("Should correctly weight votes based on staked amount", async function () {
      const addr1VotingPower = await staking.votingPower(addr1.address);
      const addr2VotingPower = await staking.votingPower(addr2.address);

      await governance.connect(addr1).vote(proposalId, true);
      await governance.connect(addr2).vote(proposalId, false);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.yesVotes).to.equal(addr1VotingPower);
      expect(proposal.noVotes).to.equal(addr2VotingPower);
    });

    it("Should prevent double voting", async function () {
      await governance.connect(addr1).vote(proposalId, true);

      await expect(governance.connect(addr1).vote(proposalId, false))
        .to.be.revertedWith("Governance: already voted");
    });

    it("Should fail if user has no voting power", async function () {
      await expect(governance.connect(addr3).vote(proposalId, true))
        .to.be.revertedWith("Governance: no voting power");
    });

    it("Should fail if proposal doesn't exist", async function () {
      await expect(governance.connect(addr1).vote(999, true))
        .to.be.revertedWith("Governance: proposal does not exist");
    });

    it("Should fail if voting period has ended", async function () {
      await time.increase(86401); // Move past deadline

      await expect(governance.connect(addr1).vote(proposalId, true))
        .to.be.revertedWith("Governance: voting period has ended");
    });

    it("Should track voting status correctly", async function () {
      expect(await governance.hasVoted(proposalId, addr1.address)).to.be.false;

      await governance.connect(addr1).vote(proposalId, true);

      expect(await governance.hasVoted(proposalId, addr1.address)).to.be.true;
      expect(await governance.hasVoted(proposalId, addr2.address)).to.be.false;
    });
  });

  describe("Quorum Logic", function () {
    let proposalId: number;

    beforeEach(async function () {
      const description = "Test proposal for quorum";
      const duration = 86400;
      await governance.connect(addr1).createProposal(description, duration);
      proposalId = 1;
    });

    it("Should calculate quorum correctly based on total staked", async function () {
      const totalStaked = await staking.totalStaked();
      const expectedQuorum = (totalStaked * BigInt(QUORUM_PERCENTAGE)) / 10000n;

      const requiredQuorum = (totalStaked * BigInt(QUORUM_PERCENTAGE)) / 10000n;
      expect(requiredQuorum).to.equal(expectedQuorum);
    });

    it("Should pass proposal when quorum is met", async function () {
      await governance.connect(addr1).vote(proposalId, true);
      await governance.connect(addr2).vote(proposalId, true);

      await time.increase(86401);

      expect(await governance.canExecute(proposalId)).to.be.true;
    });

    it("Should fail proposal when quorum is not met", async function () {
      const smallStakeAmount = ethers.parseEther("100");
      await token.connect(addr3).approve(await staking.getAddress(), smallStakeAmount);
      await staking.connect(addr3).stake(smallStakeAmount);

      await governance.connect(addr3).vote(proposalId, true);

      await time.increase(86401);

      expect(await governance.canExecute(proposalId)).to.be.false;
    });

    it("Should fail proposal when more no votes than yes votes", async function () {
      await governance.connect(addr1).vote(proposalId, false);
      await governance.connect(addr2).vote(proposalId, true);

      await time.increase(86401);

      expect(await governance.canExecute(proposalId)).to.be.false;
    });

    it("Should handle changing quorum for new proposals", async function () {
      const newQuorum = 1000; // 10%

      await expect(governance.setQuorum(newQuorum))
        .to.emit(governance, "QuorumUpdated")
        .withArgs(QUORUM_PERCENTAGE, newQuorum);

      const description = "New proposal with different quorum";
      const duration = 86400;
      await governance.connect(addr1).createProposal(description, duration);

      const newProposal = await governance.getProposal(2);
      expect(newProposal.quorum).to.equal(newQuorum);
    });
  });

  describe("Proposal Execution", function () {
    let proposalId: number;

    beforeEach(async function () {
      const description = "Test proposal for execution";
      const duration = 86400;
      await governance.connect(addr1).createProposal(description, duration);
      proposalId = 1;

      await governance.connect(addr1).vote(proposalId, true);
      await governance.connect(addr2).vote(proposalId, true);
    });

    it("Should execute proposal when conditions are met", async function () {
      await time.increase(86401);

      await expect(governance.executeProposal(proposalId))
        .to.emit(governance, "ProposalExecuted")
        .withArgs(proposalId)
        .and.to.emit(governance, "Execution")
        .withArgs(proposalId, "Test proposal for execution");

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
    });

    it("Should fail to execute before voting period ends", async function () {
      await expect(governance.executeProposal(proposalId))
        .to.be.revertedWith("Governance: voting period not ended");
    });

    it("Should fail to execute if quorum not met", async function () {
      const description = "Low support proposal";
      const duration = 86400;
      await governance.connect(addr1).createProposal(description, duration);
      const lowSupportProposalId = 2;

      const smallStakeAmount = ethers.parseEther("100");
      await token.connect(addr3).approve(await staking.getAddress(), smallStakeAmount);
      await staking.connect(addr3).stake(smallStakeAmount);

      await governance.connect(addr3).vote(lowSupportProposalId, true);

      await time.increase(86401);

      await expect(governance.executeProposal(lowSupportProposalId))
        .to.be.revertedWith("Governance: quorum not met");
    });

    it("Should fail to execute if proposal rejected", async function () {
      const description = "Rejected proposal";
      const duration = 86400;
      await governance.connect(addr1).createProposal(description, duration);
      const rejectedProposalId = 2;

      await governance.connect(addr1).vote(rejectedProposalId, false);
      await governance.connect(addr2).vote(rejectedProposalId, false);

      await time.increase(86401);

      await expect(governance.executeProposal(rejectedProposalId))
        .to.be.revertedWith("Governance: proposal rejected");
    });

    it("Should fail to execute already executed proposal", async function () {
      await time.increase(86401);

      await governance.executeProposal(proposalId);

      await expect(governance.executeProposal(proposalId))
        .to.be.revertedWith("Governance: proposal already executed");
    });

    it("Should fail to execute non-existent proposal", async function () {
      await time.increase(86401);

      await expect(governance.executeProposal(999))
        .to.be.revertedWith("Governance: proposal does not exist");
    });
  });

  describe("canExecute View Function", function () {
    let proposalId: number;

    beforeEach(async function () {
      const description = "Test proposal";
      const duration = 86400;
      await governance.connect(addr1).createProposal(description, duration);
      proposalId = 1;
    });

    it("Should return false before voting period ends", async function () {
      await governance.connect(addr1).vote(proposalId, true);
      await governance.connect(addr2).vote(proposalId, true);

      expect(await governance.canExecute(proposalId)).to.be.false;
    });

    it("Should return true when proposal can be executed", async function () {
      await governance.connect(addr1).vote(proposalId, true);
      await governance.connect(addr2).vote(proposalId, true);

      await time.increase(86401);

      expect(await governance.canExecute(proposalId)).to.be.true;
    });

    it("Should return false for non-existent proposal", async function () {
      expect(await governance.canExecute(999)).to.be.false;
    });

    it("Should return false for executed proposal", async function () {
      await governance.connect(addr1).vote(proposalId, true);
      await governance.connect(addr2).vote(proposalId, true);

      await time.increase(86401);

      await governance.executeProposal(proposalId);

      expect(await governance.canExecute(proposalId)).to.be.false;
    });
  });

  describe("Complex Voting Scenarios", function () {
    it("Should handle voting power changes during voting period", async function () {
      const description = "Voting power change test";
      const duration = 86400;
      await governance.connect(addr1).createProposal(description, duration);
      const proposalId = 1;

      await governance.connect(addr1).vote(proposalId, true);

      const additionalStake = ethers.parseEther("5000");
      await token.connect(addr1).approve(await staking.getAddress(), additionalStake);
      await staking.connect(addr1).stake(additionalStake);

      const votingPowerAfterStake = await staking.votingPower(addr1.address);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.yesVotes).to.equal(ethers.parseEther("10000"));
      expect(proposal.yesVotes).to.be.lt(votingPowerAfterStake);
    });

    it("Should handle large numbers of voters", async function () {
      const description = "Many voters test";
      const duration = 86400;
      await governance.connect(addr1).createProposal(description, duration);
      const proposalId = 1;

      const additionalSigners = await ethers.getSigners();
      let totalExpectedYesVotes = 0n;

      for (let i = 4; i < 8; i++) {
        const signer = additionalSigners[i];
        const stakeAmount = ethers.parseEther((100 * (i - 3)).toString());

        await token.transfer(signer.address, stakeAmount);
        await token.connect(signer).approve(await staking.getAddress(), stakeAmount);
        await staking.connect(signer).stake(stakeAmount);

        await governance.connect(signer).vote(proposalId, true);
        totalExpectedYesVotes += stakeAmount;
      }

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.yesVotes).to.equal(totalExpectedYesVotes);
    });
  });

  describe("Time Manipulation Tests", function () {
    it("Should handle voting exactly at deadline", async function () {
      const description = "Deadline test";
      const duration = 3600; // 1 hour
      await governance.connect(addr1).createProposal(description, duration);
      const proposalId = 1;

      await time.increase(3599);

      await expect(governance.connect(addr2).vote(proposalId, true))
        .to.emit(governance, "VoteCast");

      await time.increase(2);

      await expect(governance.connect(addr1).vote(proposalId, true))
        .to.be.revertedWith("Governance: voting period has ended");
    });

    it("Should allow execution immediately after deadline", async function () {
      const description = "Execution timing test";
      const duration = 3600;
      await governance.connect(addr1).createProposal(description, duration);
      const proposalId = 1;

      await governance.connect(addr1).vote(proposalId, true);
      await governance.connect(addr2).vote(proposalId, true);

      await time.increase(3601);

      await expect(governance.executeProposal(proposalId))
        .to.emit(governance, "ProposalExecuted");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update quorum", async function () {
      const newQuorum = 3000; // 30%

      await expect(governance.setQuorum(newQuorum))
        .to.emit(governance, "QuorumUpdated")
        .withArgs(QUORUM_PERCENTAGE, newQuorum);

      expect(await governance.quorum()).to.equal(newQuorum);
    });

    it("Should fail to set quorum over 100%", async function () {
      await expect(governance.setQuorum(10001))
        .to.be.revertedWith("Governance: quorum cannot exceed 100%");
    });

    it("Should prevent non-owner from updating quorum", async function () {
      await expect(governance.connect(addr1).setQuorum(3000))
        .to.be.revertedWithCustomError(governance, "OwnableUnauthorizedAccount");
    });
  });
});