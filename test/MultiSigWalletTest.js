const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { assert, expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet contract", () => {
    async function deployContractFixture() {
        const [owner1, owner2, owner3] = await ethers.getSigners();

        const Wallet = await ethers.getContractFactory("MultiSigWallet");
        const wallet = await Wallet.deploy(
            [owner1.address, owner2.address, owner3.address],
            2
        );

        return {Wallet, wallet, owner1, owner2, owner3};
    };
    
    it("Try create contract without owners", async () => {
        const Wallet = await ethers.getContractFactory("MultiSigWallet");
        await expect(Wallet.deploy([], 2)).to.be.revertedWith("Owners required");
    });
    
    it("Try create contract with wrong confirmations count", async () => {
        const [owner1] = await ethers.getSigners();
        const Wallet = await ethers.getContractFactory("MultiSigWallet");

        await expect(Wallet.deploy([owner1.address], 0)).to.be.revertedWith("Invalid required numbers of owners");
        await expect(Wallet.deploy([owner1.address], 2)).to.be.revertedWith("Invalid required numbers of owners");
    });
    
    it("Try create contract with wrong account", async () => {
        const Wallet = await ethers.getContractFactory("MultiSigWallet");

        await expect(Wallet.deploy([ethers.constants.AddressZero], 1)).to.be.revertedWith("Invalid owner");
    });
    
    it("Try create contract with not unique owners", async () => {
        const [owner1] = await ethers.getSigners();
        const Wallet = await ethers.getContractFactory("MultiSigWallet");

        await expect(Wallet.deploy([owner1.address, owner1.address], 2)).to.be.revertedWith("Owner is not unique");
    });

    it("Test deploy", async () => {
        const [owner1, owner2] = await ethers.getSigners();
        const Wallet = await ethers.getContractFactory("MultiSigWallet");
        const wallet = await Wallet.deploy([owner1.address, owner2.address], 2);
        
        assert(await wallet.owners(0) == owner1.address);
        assert(await wallet.owners(1) == owner2.address);
        assert(await wallet.numConfirmationsRequired() == 2);
    });

    it("Test deposit", async () => {
        const {wallet, owner1} = await loadFixture(deployContractFixture);

        const balance = await ethers.provider.getBalance(wallet.address);
        assert (balance.toNumber() == 0)

        tx = {
            to: wallet.address,
            value: ethers.utils.parseEther('1', "ether")
        }

        const result = await owner1.sendTransaction(tx);

        expect(result).to.emit(wallet, "Deposit")
            .withArgs(owner1.address, "1000000000000000000", "1000000000000000000");
        expect(await ethers.provider.getBalance(wallet.address)).to.equal("1000000000000000000");
    });
});
