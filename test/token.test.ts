import { expect } from "chai";
import { ethers } from "hardhat";
import { MyToken, MyToken__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MyToken", function () {
  let token: MyToken;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MyTokenFactory = new MyToken__factory(owner);
    token = await MyTokenFactory.deploy();
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should mint initial supply to owner", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should have correct name and symbol", async function () {
      expect(await token.name()).to.equal("MyToken");
      expect(await token.symbol()).to.equal("MTK");
    });

    it("Should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("Should emit Mint event on deployment", async function () {
      const MyTokenFactory = new MyToken__factory(owner);
      const newToken = await MyTokenFactory.deploy();
      await expect(newToken.waitForDeployment())
        .to.emit(newToken, "Mint")
        .withArgs(owner.address, INITIAL_SUPPLY);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("100");

      await token.transfer(addr1.address, transferAmount);
      expect(await token.balanceOf(addr1.address)).to.equal(transferAmount);
      expect(await token.balanceOf(owner.address)).to.equal(
        INITIAL_SUPPLY - transferAmount
      );
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const transferAmount = ethers.parseEther("1");

      await expect(
        token.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("Should update allowances on transferFrom", async function () {
      const transferAmount = ethers.parseEther("100");

      await token.approve(addr1.address, transferAmount);
      await token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount);

      expect(await token.balanceOf(addr2.address)).to.equal(transferAmount);
      expect(await token.allowance(owner.address, addr1.address)).to.equal(0);
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their own tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialBalance = await token.balanceOf(owner.address);

      await expect(token.burn(burnAmount))
        .to.emit(token, "Burn")
        .withArgs(owner.address, burnAmount);

      expect(await token.balanceOf(owner.address)).to.equal(
        initialBalance - burnAmount
      );
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY - burnAmount);
    });

    it("Should fail to burn more tokens than balance", async function () {
      const burnAmount = ethers.parseEther("2000000");

      await expect(token.burn(burnAmount))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("Should allow owner to burn tokens from any account with burnFrom", async function () {
      const transferAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("50");

      await token.transfer(addr1.address, transferAmount);

      await expect(token.burnFrom(addr1.address, burnAmount))
        .to.emit(token, "Burn")
        .withArgs(addr1.address, burnAmount);

      expect(await token.balanceOf(addr1.address)).to.equal(
        transferAmount - burnAmount
      );
    });

    it("Should require allowance for non-owner to burn from another account", async function () {
      const transferAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("50");

      await token.transfer(addr1.address, transferAmount);

      await expect(
        token.connect(addr2).burnFrom(addr1.address, burnAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

      await token.connect(addr1).approve(addr2.address, burnAmount);

      await expect(token.connect(addr2).burnFrom(addr1.address, burnAmount))
        .to.emit(token, "Burn")
        .withArgs(addr1.address, burnAmount);

      expect(await token.balanceOf(addr1.address)).to.equal(
        transferAmount - burnAmount
      );
      expect(await token.allowance(addr1.address, addr2.address)).to.equal(0);
    });

    it("Should fail to burn from zero address", async function () {
      const burnAmount = ethers.parseEther("50");

      await expect(
        token.burnFrom(ethers.ZeroAddress, burnAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InvalidSender");
    });
  });

  describe("Events", function () {
    it("Should emit Transfer event on transfer", async function () {
      const transferAmount = ethers.parseEther("100");

      await expect(token.transfer(addr1.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);
    });

    it("Should emit Approval event on approve", async function () {
      const approveAmount = ethers.parseEther("100");

      await expect(token.approve(addr1.address, approveAmount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, approveAmount);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero transfers", async function () {
      await expect(token.transfer(addr1.address, 0))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, 0);

      expect(await token.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should handle zero burns", async function () {
      await expect(token.burn(0))
        .to.emit(token, "Burn")
        .withArgs(owner.address, 0);
    });

    it("Should handle max allowance", async function () {
      const maxAllowance = ethers.MaxUint256;
      await token.approve(addr1.address, maxAllowance);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(maxAllowance);
    });
  });
});