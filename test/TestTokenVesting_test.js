const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require('hardhat');
const console = require('console');
const { BigNumber, BigInt, FixedFormat, FixedNumber, formatFixed, parseFixed, BigNumberish } = require("@ethersproject/bignumber");

async function deployContract(contract, args) {
    console.log(`deploying ${contract}...`);
  
    let Token = await ethers.getContractFactory(contract);
    let token;
    if (args) {
      console.log(`with args ${args}...`);
      token = await Token.deploy(args);
    }
    else {
      token = await Token.deploy();
    }
  
    await token.deployed();
  
    console.log(`${contract} deployed to: `, token.address);
  
    return token;
}

async function addPrivateInvestor(user, userName, amount, token){
    let am = amount.toString();
    am = am.concat("000000000000000000");
    await token.addPrivateVestingScheduleBeneficiary(user.address, BigNumber.from(`${am}`));
    console.log(`${userName} added as private with ${amount} `);
}

async function increaseTime(seconds, blocksToMineAfter = 0) {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
  await mineBlocks(blocksToMineAfter);
}

async function mineBlocks(blockNumber) {
  while (blockNumber > 0) {
    blockNumber--;
    //await ethers.network.provider.request({
    await hre.network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }
}

describe("TestTokenVesting", function () {

    let owner, beneficiary1, beneficiary2, beneficiary3;
    let vvToken, vvToken1, testTokenVesting;
    let Seed_0 = "0x29a2F67BA3E0aaf03AbA18ec1d9F5fC5e07DDf80";
    let Public_1 = "0xA7B17C68540E9a82E670a47ea5541b93CF0093f0";
    let OperationsAndReserve_2 = "0xbFf0805E5936E4fA114beC386AA8488BCb25a82a";
    let SocialAdvisory_3 = "0x92656587B0DB732e3d3E1604364521B7b8Efa175";
    let MarketingAndTechDevelopment_4 = "0xe251F847aB1823c5D1B8DaDf4e52A1580380B4C0";
    let LiquidityAndListings_5 = "0x9FF75e4FC742beA3E3650E615827E71Ce2fd2Fcf";
    let Founders_6 = "0xCa7771912BDEA166e9aa9DeD193A52309042945D";
    const rounds = [];
    rounds.push(Seed_0, Public_1, OperationsAndReserve_2, SocialAdvisory_3, MarketingAndTechDevelopment_4, LiquidityAndListings_5, Founders_6);

    let beforeDescribe = async function () {
      
      testTokenVesting = await deployContract("TestTokenVesting");
      console.log(`testTokenVesting: ${testTokenVesting.address}`);

      vvToken1 = await testTokenVesting.vvToken;
      //domeCore = await hre.ethers.getContractAt("DomeCore3", domeCore3);
      vvToken = await hre.ethers.getContractAt("VVToken", vvToken1);
      [owner, beneficiary1, beneficiary2, beneficiary3, beneficiary4, _] = await ethers.getSigners();
      console.log("=========== Deployed =========");
   }

  
    describe('addPrivateVestingScheduleBeneficiary', () => { 

      before(beforeDescribe);

      it('should add a private vesting schedule beneficiary', async () => {

        await addPrivateInvestor(beneficiary1, "ben1", 10000000, testTokenVesting);
        const investor = await testTokenVesting.privateRoundInvestors(beneficiary1.address);
        expect(BigNumber.from(`${investor.amount}`)).to.equal(BigNumber.from(`10000000000000000000000000`));
        
      });

      it("should not allow adding a private vesting schedule beneficiary with zero amount", async function () {
        const amount = ethers.utils.parseEther("0");
    
        await expect(testTokenVesting.addPrivateVestingScheduleBeneficiary(beneficiary2.address, amount)).to.be.revertedWith(
          "The amount must be greater than 0"
        );
      });

      it("should not allow adding a private vesting schedule beneficiary with insufficient tokens", async function () {
        const amount = ethers.utils.parseEther("35000000");
    
        await expect(testTokenVesting.addPrivateVestingScheduleBeneficiary(beneficiary1.address, amount)).to.be.revertedWith(
          "Can not create vesting schedule because of not sufficient tokens"
        );
      });

      it("should not allow adding a private vesting schedule beneficiaries more round token limit", async function () {
        await addPrivateInvestor(beneficiary2, "ben1", 10000000, testTokenVesting);
        await addPrivateInvestor(beneficiary3, "ben2", 10000000, testTokenVesting);

        // Rrivate round total amount is a 34 mln, 
        await expect(addPrivateInvestor(beneficiary4, "ben3", 5000000, testTokenVesting)).to.be.revertedWith(
          "Can not create vesting schedule because of not sufficient tokens"
        );
      });

      it("should only allow the owner to add a private vesting schedule beneficiary", async function () {
        const amount = ethers.utils.parseEther("10000000000000000000000000");
    
        const hacker = await ethers.getSigner(1);
        await expect(testTokenVesting.connect(hacker).addPrivateVestingScheduleBeneficiary(beneficiary1.address, amount)).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );

      });
    });

    describe("releaseForPrivateRoundInvestors", () => { 

      beforeEach(beforeDescribe);

      it("check releazable amounts in private round", async function () { 
    
        // Release tokens for private round investor
        const amount = ethers.utils.parseEther("34000000");
        await testTokenVesting.addPrivateVestingScheduleBeneficiary(beneficiary1.address, amount);

        await increaseTime(199);
        // Check that the private round investor has received their tokens
        let investorBalance = await testTokenVesting.getBalance(beneficiary1.address);
        expect(investorBalance).to.equal(0);

        await testTokenVesting.releaseForPrivateRoundInvestors(beneficiary1.address);
        expect(investorBalance).to.equal(0);

        await increaseTime(101);
        await testTokenVesting.releaseForPrivateRoundInvestors(beneficiary1.address);
        investorBalance = await testTokenVesting.getBalance(beneficiary1.address);
        expect(investorBalance).to.equal(BigNumber.from(`1888888888888888888888888`));


        await increaseTime(3300);
        await testTokenVesting.releaseForPrivateRoundInvestors(beneficiary1.address);
        investorBalance = await testTokenVesting.getBalance(beneficiary1.address);
        expect(investorBalance).to.equal(BigNumber.from(`34000000000000000000000000`));

      });

      it("check releasable amount for few investors", async function () {
        const ben1Amount = ethers.utils.parseEther("17000000");
        const ben2Amount = ethers.utils.parseEther("10000000");
        const ben3Amount = ethers.utils.parseEther("7000000");

        await testTokenVesting.addPrivateVestingScheduleBeneficiary(beneficiary1.address, ben1Amount);
        await increaseTime(200);

        await testTokenVesting.addPrivateVestingScheduleBeneficiary(beneficiary2.address, ben2Amount);
        await increaseTime(200);

        await testTokenVesting.addPrivateVestingScheduleBeneficiary(beneficiary3.address, ben3Amount);
        await increaseTime(200);

        await testTokenVesting.releaseForPrivateRoundInvestors(beneficiary1.address);
        await testTokenVesting.releaseForPrivateRoundInvestors(beneficiary2.address);
        await testTokenVesting.releaseForPrivateRoundInvestors(beneficiary3.address);

        let ben1Balance = await testTokenVesting.getBalance(beneficiary1.address);
        let ben2Balance = await testTokenVesting.getBalance(beneficiary2.address);
        let ben3Balance = await testTokenVesting.getBalance(beneficiary3.address);

        expect(ben1Balance).to.equal(BigNumber.from(`2361111111111111111111111`));
        expect(ben2Balance).to.equal(BigNumber.from(`833333333333333333333333`));
        expect(ben3Balance).to.equal(BigNumber.from(`194444444444444444444444`));

        await increaseTime(3400);

        await testTokenVesting.releaseForPrivateRoundInvestors(beneficiary1.address);
        await testTokenVesting.releaseForPrivateRoundInvestors(beneficiary2.address);
        await testTokenVesting.releaseForPrivateRoundInvestors(beneficiary3.address);

        ben1Balance = await testTokenVesting.getBalance(beneficiary1.address);
        ben2Balance = await testTokenVesting.getBalance(beneficiary2.address);
        ben3Balance = await testTokenVesting.getBalance(beneficiary3.address);

        expect(ben1Balance).to.equal(ethers.utils.parseEther("17000000"));
        expect(ben2Balance).to.equal(ethers.utils.parseEther("10000000"));
        expect(ben3Balance).to.equal(ethers.utils.parseEther("7000000"));

      });


    });

    describe("release", () => {

      beforeEach(beforeDescribe);

      it("check all releazable amounts after finish", async function () { 
        await testTokenVesting.startVesting();
        increaseTime(5000);

        for (let step = 0; step < 7; step++) {
          await testTokenVesting.release(step);
        }
        
        expect(await testTokenVesting.getBalance(Seed_0)).to.equal(ethers.utils.parseEther("20000000"));
        expect(await testTokenVesting.getBalance(Public_1)).to.equal(ethers.utils.parseEther("40000000"));
        expect(await testTokenVesting.getBalance(OperationsAndReserve_2)).to.equal(ethers.utils.parseEther("456000000"));
        expect(await testTokenVesting.getBalance(SocialAdvisory_3)).to.equal(ethers.utils.parseEther("60000000"));
        expect(await testTokenVesting.getBalance(MarketingAndTechDevelopment_4)).to.equal(ethers.utils.parseEther("70000000"));
        expect(await testTokenVesting.getBalance(LiquidityAndListings_5)).to.equal(ethers.utils.parseEther("100000000"));
        expect(await testTokenVesting.getBalance(Founders_6)).to.equal(ethers.utils.parseEther("220000000"));

      });

      it("check all releazable amounts for few rounds", async function () {
        await testTokenVesting.startVesting();

        for (let step = 0; step < 50; step++){
          
          increaseTime(100);
          for (let step = 0; step < 7; step++) {
            await testTokenVesting.release(step);
          }
          console.log(`round  ${step} released`)
          for (let step = 0; step < 7; step++) {
            console.log(await testTokenVesting.getBalance(rounds[step])/10**24);
          }
          console.log("-------------################-------------------")
        }

      });
      
    });

});