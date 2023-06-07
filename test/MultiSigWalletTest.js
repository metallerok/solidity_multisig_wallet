const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { assert, expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet contract", () => {
    async function deployContractFixture() {
        const [owner1, owner2, owner3,notOwner] = await ethers.getSigners();

        const Wallet = await ethers.getContractFactory("MultiSigWallet");
        const wallet = await Wallet.deploy(
            [owner1.address, owner2.address, owner3.address],
            2
        );

        return {Wallet, wallet, owner1, owner2, owner3, notOwner};
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
    
    it("Try submit transaction from not owner", async () => {
        const {wallet, owner1, notOwner} = await loadFixture(deployContractFixture);

        await expect(
            wallet.connect(notOwner).submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ethert'),
                "0x00"
            )
        ).to.be.revertedWith("Not owner");
    });

    it("Test submit transaction", async () => {
        const {wallet, owner1, owner2} = await loadFixture(deployContractFixture);
        
        await expect(
            wallet.submitTransaction(
                owner2.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
            )
        ).to.emit(wallet, "TxSubmited")
            .withArgs(0, owner1.address, owner2.address, ethers.utils.parseEther('1', 'ether'), "0x00");
        

        const transaction = await wallet.transactions(0);

        expect(transaction.to).to.be.equal(owner2.address);
        expect(transaction.value).to.be.equal(ethers.utils.parseEther('1', 'ether'));
        expect(transaction.data).to.be.equal("0x00");
        expect(transaction.executed).to.be.equal(false);
        expect(transaction.numConfirmations).to.be.equal(0);
    });
    
    it("Try confirm not existed transaction", async () => {
        const {wallet} = await loadFixture(deployContractFixture);
        await expect(wallet.confirmTransaction(0)).to.revertedWith("Tx does not exists");
    });
    
    it("Try confirm transaction from not owner", async () => {
        const {wallet, owner1, notOwner} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )

        await expect(wallet.connect(notOwner).confirmTransaction(0)).to.revertedWith("Not owner");
    });
    
    it("Test confirm transaction", async () => {
        const {wallet, owner1} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )
        
        await expect(
            wallet.confirmTransaction(0)
        ).to.emit(wallet, "TxConfirmed")
            .withArgs(owner1.address, 0);
        
    });
    
    it("Try confirm already confirmed transaction", async () => {
        const {wallet, owner1} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )
        await wallet.confirmTransaction(0)
        
        await expect(
            wallet.confirmTransaction(0)
        ).to.be.revertedWith("Tx already confirmed");
    });
    
    it("Try execute not existed transaction", async () => {
        const {wallet} = await loadFixture(deployContractFixture);
        await expect(wallet.executeTransaction(0)).to.revertedWith("Tx does not exists");
    });
    
    it("Try execute transaction from not owner", async () => {
        const {wallet, owner1, notOwner} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                0
        )

        await expect(wallet.connect(notOwner).executeTransaction(0)).to.revertedWith("Not owner");
    });
    
    it("Try execute transaction but contract does not have founds", async () => {
        const {wallet, owner1, owner2} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )

        await wallet.connect(owner1).confirmTransaction(0);
        await wallet.connect(owner2).confirmTransaction(0);
        
        await expect(
            wallet.executeTransaction(0)
        ).to.be.revertedWith("Tx failed");
    });
    
    it("Try execute transaction but not enought confirmations", async () => {
        const {wallet, owner1} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )

        await wallet.connect(owner1).confirmTransaction(0);
        
        await expect(
            wallet.executeTransaction(0)
        ).to.be.revertedWith("Confirmations < required");
    });
    
    it("Test execute transaction", async () => {
        const {wallet, owner1, owner2, owner3} = await loadFixture(deployContractFixture);
        
        tx = {
            to: wallet.address,
            value: ethers.utils.parseEther('2', "ether")
        }
        await owner1.sendTransaction(tx);

        expect(await ethers.provider.getBalance(owner3.address)).to.be.equal(ethers.utils.parseEther('10000', 'eth'));

        await wallet.submitTransaction(
                owner3.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )

        await wallet.connect(owner1).confirmTransaction(0);
        await wallet.connect(owner2).confirmTransaction(0);
        
        await expect(
            wallet.executeTransaction(0)
        ).to.emit(wallet, "TxExecuted").withArgs(owner1.address, 0);
        
        expect(await ethers.provider.getBalance(owner3.address)).to.be.equal(ethers.utils.parseEther('10001', 'eth'));
        expect(await ethers.provider.getBalance(wallet.address)).to.be.equal(ethers.utils.parseEther('1', 'eth'));
        
        const transaction = await wallet.transactions(0);

        expect(transaction.executed).to.be.equal(true);
        expect(transaction.numConfirmations).to.be.equal(2);
    });
    
    it("Try execute already executed transaction", async () => {
        const {wallet, owner1, owner2, owner3} = await loadFixture(deployContractFixture);
        
        tx = {
            to: wallet.address,
            value: ethers.utils.parseEther('2', "ether")
        }
        await owner1.sendTransaction(tx);

        expect(await ethers.provider.getBalance(owner3.address)).to.be.equal(ethers.utils.parseEther('10000', 'eth'));

        await wallet.submitTransaction(
                owner3.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )

        await wallet.connect(owner1).confirmTransaction(0);
        await wallet.connect(owner2).confirmTransaction(0);
        await wallet.executeTransaction(0);
        
        expect(await ethers.provider.getBalance(owner3.address)).to.be.equal(ethers.utils.parseEther('10001', 'eth'));
        
        await expect(
            wallet.executeTransaction(0)
        ).to.be.revertedWith("Tx already executed")
        
        expect(await ethers.provider.getBalance(owner3.address)).to.be.equal(ethers.utils.parseEther('10001', 'eth'));
    });
    
    it("Try revoke not existed transaction", async () => {
        const {wallet} = await loadFixture(deployContractFixture);
        await expect(wallet.revokeTransaction(0)).to.revertedWith("Tx does not exists");
    });
    
    it("Try revoke transaction from not owner", async () => {
        const {wallet, owner1, notOwner} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                0
        )

        await expect(wallet.connect(notOwner).revokeTransaction(0)).to.revertedWith("Not owner");
    });
    
    it("Try revoke already executed transaction", async () => {
        const {wallet, owner1, owner2, owner3} = await loadFixture(deployContractFixture);
        
        tx = {
            to: wallet.address,
            value: ethers.utils.parseEther('2', "ether")
        }
        await owner1.sendTransaction(tx);

        expect(await ethers.provider.getBalance(owner3.address)).to.be.equal(ethers.utils.parseEther('10000', 'eth'));

        await wallet.submitTransaction(
                owner3.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )

        await wallet.connect(owner1).confirmTransaction(0);
        await wallet.connect(owner2).confirmTransaction(0);
        await wallet.executeTransaction(0);
        
        await expect(
            wallet.revokeTransaction(0)
        ).to.be.revertedWith("Tx already executed")
    });
    
    it("Try revoke not confirmed transaction", async () => {
        const {wallet, owner1} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                0
        )

        await expect(wallet.revokeTransaction(0)).to.revertedWith("Tx not confirmed");
    });
    
    it("Test revoke transaction", async () => {
        const {wallet, owner1} = await loadFixture(deployContractFixture);
        
        tx = {
            to: wallet.address,
            value: ethers.utils.parseEther('2', "ether")
        }
        await owner1.sendTransaction(tx);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )

        await wallet.connect(owner1).confirmTransaction(0);
        
        let transaction = await wallet.transactions(0);

        assert(transaction.numConfirmations == 1);
        
        await expect(
            wallet.revokeTransaction(0)
        ).to.emit(wallet, "TxRevoked").withArgs(owner1.address, 0);
        
        transaction = await wallet.transactions(0);

        assert(transaction.numConfirmations == 0);
    });
    
    it("Test get owners", async () => {
        const {wallet, owner1, owner2, owner3} = await loadFixture(deployContractFixture);

        const result = await wallet.getOwners();
        
        expect(result.length).to.be.equal(3);
        expect(result[0]).to.be.equal(owner1.address);
        expect(result[1]).to.be.equal(owner2.address);
        expect(result[2]).to.be.equal(owner3.address);
    });

    it("Test get transactions count", async () => {
        const {wallet, owner1} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )
        
        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )

        const result = await wallet.getTransactionsCount();
        expect(result).to.be.equal(2);
    });
    
    it("Test get transaction", async () => {
        const {wallet, owner1} = await loadFixture(deployContractFixture);

        await wallet.submitTransaction(
                owner1.address,
                ethers.utils.parseEther('1', 'ether'),
                "0x00"
        )

        const result = await wallet.getTransaction(0);

        expect(result.to).to.be.equal(owner1.address);
        expect(result.value).to.be.equal(ethers.utils.parseEther('1', 'eth'));
        expect(result.data).to.be.equal("0x00");
        expect(result.executed).to.be.equal(false);
        expect(result.numConfirmations).to.be.equal(0);
    });
});
