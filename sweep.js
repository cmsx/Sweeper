#!/usr/bin/env node

const _ = require('lodash');
const fs = require('fs');
const ethers = require('ethers');
const colors = require('colors');
const consoleStamp = require('console-stamp');
consoleStamp(console, {format: ':date(HH:MM:ss).gray'});

const REAL_RUN = parseInt(process.argv[2]) || false;
const RPC = process.env.RPC;
const MAX_GWEI = process.env.MAX_GWEI;
const MAX_PRIORITY = process.env.MAX_PRIORITY;
const IGNORE_BALANCE = process.env.IGNORE_BALANCE;
const SLEEP_FROM = process.env.SLEEP_FROM;
const SLEEP_TO = process.env.SLEEP_TO;

const provider = new ethers.getDefaultProvider(RPC);

const tokenAddr = false;
const tokenAbi = require("./abi/erc20.json");

const fileFrom = './data/pk.txt';
const fileTo = './data/target.txt';

if (!fs.existsSync(fileFrom)) {
    throw new Error(`No such file ${fileFrom}`);
}

if (!fs.existsSync(fileTo)) {
    throw new Error(`No such file ${fileTo}`);
}

let accounts = _.filter(fs.readFileSync(fileFrom).toString().split("\n"));
let targets = _.filter(fs.readFileSync(fileTo).toString().split("\n"));

(async () => {
    console.log('Sweeper'.yellow, REAL_RUN ? 'REAL run'.magenta : 'TEST run'.grey);

    if (tokenAddr) {
        let tokenContract = new ethers.Contract(tokenAddr, tokenAbi, provider);
        let tokenDecimals = await tokenContract.decimals();
        let tokenName = await tokenContract.symbol();
    }

    for (let i in accounts) {
        let pk = accounts[i];
        let target = targets[i];

        let wallet = new ethers.Wallet(pk, provider);
        let addr = await wallet.getAddress();

        if (!target) {
            console.log(addr, `doesn't have a target!`.red);
            process.exit();
        }

        let bal = await provider.getBalance(addr);
        let balHuman = ethers.formatEther(bal);

        let {maxFeePerGas} = await provider.getFeeData();
        let gwei = _.min([ethers.parseUnits(`${MAX_GWEI}`, 'gwei'), maxFeePerGas]);
        let gweiHuman = ethers.formatUnits(gwei, 'gwei');
        let maxPriorityFeePerGas = _.min([gwei, ethers.parseUnits(`${MAX_PRIORITY}`, 'gwei')]);

        if (tokenAddr) {
            let tokenBal = await tokenContract.balanceOf(addr);
            let tokenBalHuman = ethers.formatUnits(tokenBal, tokenDecimals);

            // TODO
        } else {
            console.log(`${i*1+1}`.yellow, addr, 'has', balHuman)

            if (balHuman <= IGNORE_BALANCE) {
                console.log('Balance too low, skip...'.gray);

                continue;
            }

            let gasLimit = 21000n;
            let amount = bal - gasLimit * gwei;
            let amountHuman = ethers.formatEther(amount);

            console.log('Sending'.magenta, `${amountHuman} to ${target} with max fee ${gweiHuman} gwei`);
            let txData = {'to': target, 'from': addr, gasLimit, maxFeePerGas: gwei, maxPriorityFeePerGas, value: amount};

            if (REAL_RUN) {
                let txRes = await wallet.sendTransaction(txData);
                console.log('TX:', txRes.hash.gray);
                await txRes.wait();
                console.log('Sent'.green);

                await sleep(SLEEP_FROM, SLEEP_TO);
            } else {
                _.each(txData, (val, key) => console.log("\t", key.yellow, val.toString()));
                console.log(`I promise, I will sleep from ${SLEEP_FROM} to ${SLEEP_TO} sec!`.grey);
            }
        }
    }

    console.log('Done'.green);
    process.exit();
})();

async function sleep(fromSec, toSec) {
    let sec = _.random(fromSec, toSec);
    console.log(`Sleep for ${sec} seconds...`.grey);

    return new Promise((resolve) => setTimeout(resolve, sec * 1000));
}
