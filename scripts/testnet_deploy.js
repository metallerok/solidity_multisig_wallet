const { ethers } = require("hardhat");

async function main() {
    const [owner1, owner2, owner3] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", owner1.address);
    console.log("Account balance before:", (await owner1.getBalance()).toString());

    const Wallet = await ethers.getContractFactory("MultiSigWallet");
    const wallet = await Wallet.deploy(
        [owner1.address, owner2.address, owner3.address],
        2
    );

    console.log("Contract address:", wallet.address);
    console.log("Account balance after:", (await owner1.getBalance()).toString());
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });