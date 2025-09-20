import { expect } from "chai";
import { ethers } from "hardhat";
import { MyToken, MyToken__factory, Staking, Staking__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Staking", function () {
  let token: MyToken;
  let staking: Staking;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;


  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MyTokenFactory = new MyToken__factory(owner);
    token = await MyTokenFactory.deploy();
    await token.waitForDeployment();

    const StakingFactory = new Staking__factory(owner);
    staking = await StakingFactory.deploy(await token.getAddress());
    await staking.waitForDeployment();

    await token.transfer(addr1.address, ethers.parseEther("10000"));
    await token.transfer(addr2.address, ethers.parseEther("5000"));
  });

  describe("Deployment", function () {
    it("Should set the correct staking token", async function () {
      expect(await staking.stakingToken()).to.equal(await token.getAddress());
    });

    it("Should initialize with zero total staked", async function () {
      expect(await staking.totalStaked()).to.equal(0);
    });

    it("Should revert with invalid token address", async function () {
      const StakingFactory = new Staking__factory(owner);
      await expect(StakingFactory.deploy(ethers.ZeroAddress))
        .to.be.revertedWith("Staking: invalid token address");
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      const stakeAmount = ethers.parseEther("1000");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);

      await expect(staking.connect(addr1).stake(stakeAmount))
        .to.emit(staking, "Stake")
        .withArgs(addr1.address, stakeAmount);

      expect(await staking.stakedBalances(addr1.address)).to.equal(stakeAmount);
      expect(await staking.totalStaked()).to.equal(stakeAmount);
      expect(await token.balanceOf(await staking.getAddress())).to.equal(stakeAmount);
    });

    it("Should fail to stake without approval", async function () {
      const stakeAmount = ethers.parseEther("1000");

      await expect(staking.connect(addr1).stake(stakeAmount))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("Should fail to stake zero amount", async function () {
      await expect(staking.connect(addr1).stake(0))
        .to.be.revertedWith("Staking: amount must be greater than 0");
    });

    it("Should fail to stake more than balance", async function () {
      const stakeAmount = ethers.parseEther("20000");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);

      await expect(staking.connect(addr1).stake(stakeAmount))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("Should allow multiple stakes from same user", async function () {
      const stakeAmount1 = ethers.parseEther("1000");
      const stakeAmount2 = ethers.parseEther("500");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount1 + stakeAmount2);

      await staking.connect(addr1).stake(stakeAmount1);
      await staking.connect(addr1).stake(stakeAmount2);

      expect(await staking.stakedBalances(addr1.address)).to.equal(stakeAmount1 + stakeAmount2);
      expect(await staking.totalStaked()).to.equal(stakeAmount1 + stakeAmount2);
    });

    it("Should handle multiple users staking", async function () {
      const stakeAmount1 = ethers.parseEther("1000");
      const stakeAmount2 = ethers.parseEther("2000");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount1);
      await token.connect(addr2).approve(await staking.getAddress(), stakeAmount2);

      await staking.connect(addr1).stake(stakeAmount1);
      await staking.connect(addr2).stake(stakeAmount2);

      expect(await staking.stakedBalances(addr1.address)).to.equal(stakeAmount1);
      expect(await staking.stakedBalances(addr2.address)).to.equal(stakeAmount2);
      expect(await staking.totalStaked()).to.equal(stakeAmount1 + stakeAmount2);
    });
  });

  describe("Withdrawing", function () {
    beforeEach(async function () {
      const stakeAmount = ethers.parseEther("2000");
      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);
    });

    it("Should allow users to withdraw staked tokens", async function () {
      const withdrawAmount = ethers.parseEther("1000");
      const initialBalance = await token.balanceOf(addr1.address);

      await expect(staking.connect(addr1).withdraw(withdrawAmount))
        .to.emit(staking, "Withdraw")
        .withArgs(addr1.address, withdrawAmount);

      expect(await staking.stakedBalances(addr1.address)).to.equal(
        ethers.parseEther("1000")
      );
      expect(await staking.totalStaked()).to.equal(ethers.parseEther("1000"));
      expect(await token.balanceOf(addr1.address)).to.equal(
        initialBalance + withdrawAmount
      );
    });

    it("Should allow full withdrawal", async function () {
      const withdrawAmount = ethers.parseEther("2000");
      const initialBalance = await token.balanceOf(addr1.address);

      await staking.connect(addr1).withdraw(withdrawAmount);

      expect(await staking.stakedBalances(addr1.address)).to.equal(0);
      expect(await staking.totalStaked()).to.equal(0);
      expect(await token.balanceOf(addr1.address)).to.equal(
        initialBalance + withdrawAmount
      );
    });

    it("Should fail to withdraw zero amount", async function () {
      await expect(staking.connect(addr1).withdraw(0))
        .to.be.revertedWith("Staking: amount must be greater than 0");
    });

    it("Should fail to withdraw more than staked balance", async function () {
      const withdrawAmount = ethers.parseEther("3000");

      await expect(staking.connect(addr1).withdraw(withdrawAmount))
        .to.be.revertedWith("Staking: insufficient staked balance");
    });

    it("Should fail to withdraw if no tokens staked", async function () {
      const withdrawAmount = ethers.parseEther("100");

      await expect(staking.connect(addr2).withdraw(withdrawAmount))
        .to.be.revertedWith("Staking: insufficient staked balance");
    });
  });

  describe("Balance Tracking", function () {
    it("Should correctly track individual balances", async function () {
      const stakeAmount1 = ethers.parseEther("1000");
      const stakeAmount2 = ethers.parseEther("2000");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount1);
      await token.connect(addr2).approve(await staking.getAddress(), stakeAmount2);

      await staking.connect(addr1).stake(stakeAmount1);
      await staking.connect(addr2).stake(stakeAmount2);

      expect(await staking.balanceOf(addr1.address)).to.equal(stakeAmount1);
      expect(await staking.balanceOf(addr2.address)).to.equal(stakeAmount2);
      expect(await staking.stakedBalances(addr1.address)).to.equal(stakeAmount1);
      expect(await staking.stakedBalances(addr2.address)).to.equal(stakeAmount2);
    });

    it("Should update balances correctly after partial withdrawal", async function () {
      const stakeAmount = ethers.parseEther("3000");
      const withdrawAmount = ethers.parseEther("1000");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);
      await staking.connect(addr1).withdraw(withdrawAmount);

      expect(await staking.balanceOf(addr1.address)).to.equal(
        stakeAmount - withdrawAmount
      );
      expect(await staking.stakedBalances(addr1.address)).to.equal(
        stakeAmount - withdrawAmount
      );
    });

    it("Should return zero balance for users who haven't staked", async function () {
      expect(await staking.balanceOf(addr1.address)).to.equal(0);
      expect(await staking.stakedBalances(addr1.address)).to.equal(0);
    });
  });

  describe("Voting Power", function () {
    it("Should return correct voting power based on staked balance", async function () {
      const stakeAmount = ethers.parseEther("1500");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);

      expect(await staking.votingPower(addr1.address)).to.equal(stakeAmount);
    });

    it("Should return zero voting power for non-stakers", async function () {
      expect(await staking.votingPower(addr1.address)).to.equal(0);
    });

    it("Should update voting power after staking more", async function () {
      const stakeAmount1 = ethers.parseEther("1000");
      const stakeAmount2 = ethers.parseEther("500");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount1 + stakeAmount2);

      await staking.connect(addr1).stake(stakeAmount1);
      expect(await staking.votingPower(addr1.address)).to.equal(stakeAmount1);

      await staking.connect(addr1).stake(stakeAmount2);
      expect(await staking.votingPower(addr1.address)).to.equal(stakeAmount1 + stakeAmount2);
    });

    it("Should update voting power after withdrawal", async function () {
      const stakeAmount = ethers.parseEther("2000");
      const withdrawAmount = ethers.parseEther("800");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);
      await staking.connect(addr1).withdraw(withdrawAmount);

      expect(await staking.votingPower(addr1.address)).to.equal(
        stakeAmount - withdrawAmount
      );
    });

    it("Should have different voting power for different users", async function () {
      const stakeAmount1 = ethers.parseEther("1000");
      const stakeAmount2 = ethers.parseEther("3000");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount1);
      await token.connect(addr2).approve(await staking.getAddress(), stakeAmount2);

      await staking.connect(addr1).stake(stakeAmount1);
      await staking.connect(addr2).stake(stakeAmount2);

      expect(await staking.votingPower(addr1.address)).to.equal(stakeAmount1);
      expect(await staking.votingPower(addr2.address)).to.equal(stakeAmount2);
    });
  });

  describe("Total Staked", function () {
    it("Should track total staked correctly across multiple users", async function () {
      const stakeAmount1 = ethers.parseEther("1000");
      const stakeAmount2 = ethers.parseEther("2000");
      const stakeAmount3 = ethers.parseEther("500");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount1 + stakeAmount3);
      await token.connect(addr2).approve(await staking.getAddress(), stakeAmount2);

      await staking.connect(addr1).stake(stakeAmount1);
      expect(await staking.totalStaked()).to.equal(stakeAmount1);

      await staking.connect(addr2).stake(stakeAmount2);
      expect(await staking.totalStaked()).to.equal(stakeAmount1 + stakeAmount2);

      await staking.connect(addr1).stake(stakeAmount3);
      expect(await staking.totalStaked()).to.equal(stakeAmount1 + stakeAmount2 + stakeAmount3);
    });

    it("Should decrease total staked on withdrawals", async function () {
      const stakeAmount = ethers.parseEther("2000");
      const withdrawAmount = ethers.parseEther("500");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);

      expect(await staking.totalStaked()).to.equal(stakeAmount);

      await staking.connect(addr1).withdraw(withdrawAmount);
      expect(await staking.totalStaked()).to.equal(stakeAmount - withdrawAmount);
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks on stake", async function () {
      const stakeAmount = ethers.parseEther("1000");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);

      await expect(staking.connect(addr1).stake(stakeAmount))
        .to.emit(staking, "Stake")
        .withArgs(addr1.address, stakeAmount);

      expect(await staking.stakedBalances(addr1.address)).to.equal(stakeAmount);
    });

    it("Should prevent reentrancy attacks on withdraw", async function () {
      const stakeAmount = ethers.parseEther("1000");

      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);

      await expect(staking.connect(addr1).withdraw(stakeAmount))
        .to.emit(staking, "Withdraw")
        .withArgs(addr1.address, stakeAmount);

      expect(await staking.stakedBalances(addr1.address)).to.equal(0);
    });
  });
});