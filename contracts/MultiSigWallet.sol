// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

contract MultiSigWallet {
    event Deposit(address indexed sender, uint amount, uint balance);
    event TxSubmited(
        uint indexed txId,
        address indexed owner,
        address indexed to,
        uint value,
        bytes data
    );
    event TxConfirmed(address indexed owner, uint indexed txId);
    event TxRevoked(address indexed owner, uint indexed txId);
    event TxExecuted(address indexed owner, uint indexed txId);

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint numConfirmations;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public numConfirmationsRequired;
    Transaction[] public transactions;
    mapping(uint => mapping(address => bool)) public isConfirmed;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }
    
    modifier txExists(uint _txId) {
        require(_txId < transactions.length, "Tx does not exists");
        _;
    }
    
    modifier notConfirmed(uint _txId) {
        require(!isConfirmed[_txId][msg.sender], "Tx already confirmed");
        _;
    }
    
    modifier notExecuted(uint _txId) {
        require(!transactions[_txId].executed, "Tx already approved");
        _;
    }


    constructor(address[] memory _owners, uint _numConfirmationsRequired) {
        require(_owners.length > 0, "Owners required");
        require(
            _numConfirmationsRequired > 0 && 
            _numConfirmationsRequired <= _owners.length, 
            "Invalid required numbers of owners"
        );

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(isOwner[owner] == false, "Owner is not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    receive() external payable {
        emit Deposit({
            sender: msg.sender,
            amount: msg.value,
            balance: address(this).balance
        });
    }

    function submitTransaction(address _to, uint _value, bytes calldata _data) external onlyOwner {
        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit TxSubmited({
            txId: transactions.length,
            owner: msg.sender,
            to: _to,
            value: _value,
            data: _data
        });
    }

    function confirmTransaction(uint _txId) external onlyOwner txExists(_txId) notConfirmed(_txId) notExecuted(_txId) {
        Transaction storage transaction = transactions[_txId];
        transaction.numConfirmations += 1;
        isConfirmed[_txId][msg.sender] = true;

        emit TxConfirmed(msg.sender, _txId);
    }

    function executeTransaction(uint _txId) external onlyOwner txExists(_txId) notExecuted(_txId) {
        Transaction storage transaction = transactions[_txId];
        
        require(transaction.numConfirmations >= numConfirmationsRequired, "Confirmations < required");


        transaction.executed = true;
        (bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);

        require(success, "tx failed");

        emit TxExecuted(msg.sender, _txId);
    }

    function revokeTransaction(uint _txId) external onlyOwner txExists(_txId) notExecuted(_txId) {
        Transaction storage transaction = transactions[_txId];

        require(isConfirmed[_txId][msg.sender], "Tx not confirmed");

        transaction.numConfirmations -= 1;
        isConfirmed[_txId][msg.sender] = false;

        emit TxRevoked(msg.sender, _txId);
    }
}