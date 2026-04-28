require("dotenv").config();
const { ethers } = require("ethers");

// ==========================
// ⚙️ CONFIG
// ==========================
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const CONTRACT_ADDRESS = process.env.CONTRACT;
const USDC_ADDRESS = process.env.USDC;
const TOKEN_ADDRESS = process.env.TOKEN;

// STRATEGY
const USE_PERCENT = 95n; // pakai 95% balance
const MAX_BUY = "10";    // max 10 USDC
const TAKE_PROFIT = 1.2;
const STOP_LOSS = 0.8;
const LOOP_INTERVAL = 15000;

// ==========================
// 🔌 SETUP
// ==========================
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// ==========================
// 📜 ABI
// ==========================
const CONTRACT_ABI = [
  "function buy(uint256 quoteAmount, uint256 minTokenAmount)",
  "function sell(uint256 tokenAmount, uint256 minUSDCOut)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount)",
  "function balanceOf(address owner) view returns (uint256)"
];

// ==========================
// 🔗 CONTRACT
// ==========================
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);

// ==========================
// 🧠 STATE
// ==========================
let lastBuyPrice = 0;
let hasPosition = false;

// ==========================
// ✅ APPROVE
// ==========================
async function approveUSDC() {
  try {
    const amount = ethers.parseUnits("1000", 6);

    console.log("Approving USDC...");
    const tx = await usdc.approve(CONTRACT_ADDRESS, amount);

    console.log("Approve TX:", tx.hash);
    await tx.wait();

    console.log("✅ APPROVED");
  } catch (e) {
    console.error("Approve error:", e.message);
  }
}

// ==========================
// 🟢 BUY
// ==========================
async function buy() {
  try {
    const balance = await usdc.balanceOf(wallet.address);

    console.log("USDC Balance:", ethers.formatUnits(balance, 6));

    if (balance <= 0n) {
      console.log("❌ No USDC");
      return;
    }

    // pakai persen
    let amountIn = balance * USE_PERCENT / 100n;

    // max buy limit
    const maxBuy = ethers.parseUnits(MAX_BUY, 6);
    if (amountIn > maxBuy) {
      amountIn = maxBuy;
    }

    if (amountIn <= 0n) {
      console.log("❌ Amount too small");
      return;
    }

    console.log("🚀 Buying:", ethers.formatUnits(amountIn, 6), "USDC");

    const tx = await contract.buy(amountIn, 0, {
      gasLimit: 300000
    });

    console.log("BUY TX:", tx.hash);
    await tx.wait();

    console.log("✅ BUY SUCCESS");

    lastBuyPrice = Number(ethers.formatUnits(amountIn, 6));
    hasPosition = true;

  } catch (err) {
    console.error("BUY ERROR:", err.message);
  }
}

// ==========================
// 🔴 SELL
// ==========================
async function sell() {
  try {
    const balance = await token.balanceOf(wallet.address);

    if (balance == 0n) {
      console.log("⚠️ No token");
      return;
    }

    console.log("💸 Selling token...");

    const tx = await contract.sell(balance, 0, {
      gasLimit: 300000
    });

    console.log("SELL TX:", tx.hash);
    await tx.wait();

    console.log("✅ SELL SUCCESS");

    hasPosition = false;

  } catch (err) {
    console.error("SELL ERROR:", err.message);
  }
}

// ==========================
// 📊 PRICE (DUMMY)
// ==========================
async function getPrice() {
  return Math.random() * 2;
}

// ==========================
// 🤖 LOOP
// ==========================
async function runBot() {
  console.log("🤖 BOT STARTED");

  while (true) {
    try {
      const price = await getPrice();
      console.log("Price:", price);

      if (!hasPosition) {
        await buy();
      } else {
        if (price >= lastBuyPrice * TAKE_PROFIT) {
          console.log("🎯 TAKE PROFIT");
          await sell();
        }

        if (price <= lastBuyPrice * STOP_LOSS) {
          console.log("🛑 STOP LOSS");
          await sell();
        }
      }

    } catch (e) {
      console.error("Loop error:", e.message);
    }

    await new Promise(r => setTimeout(r, LOOP_INTERVAL));
  }
}

// ==========================
// 🚀 MAIN
// ==========================
async function main() {
  console.log("Wallet:", wallet.address);

  await approveUSDC();
  await runBot();
}

main();