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

// strategy config
const BUY_AMOUNT_USDC = "6"; // jumlah buy
const TAKE_PROFIT = 1.2;       // +20%
const STOP_LOSS = 0.8;         // -20%
const LOOP_INTERVAL = 15000;   // 15 detik

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
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// ==========================
// 🔗 CONTRACT INSTANCE
// ==========================
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);

// ==========================
// 🧮 GLOBAL STATE
// ==========================
let lastBuyPrice = 0;
let hasPosition = false;

// ==========================
// ✅ APPROVE
// ==========================
async function approveUSDC() {
  const amount = ethers.parseUnits("1000", 6);

  console.log("Approving USDC...");
  const tx = await usdc.approve(CONTRACT_ADDRESS, amount);
  await tx.wait();

  console.log("✅ USDC Approved");
}

// ==========================
// 🟢 BUY
// ==========================
async function buy() {
  try {
    const amountIn = ethers.parseUnits(BUY_AMOUNT_USDC, 6);

    const minOut = 0; // bisa kamu adjust nanti

    console.log("🚀 Buying...");

    const tx = await contract.buy(amountIn, minOut, {
      gasLimit: 300000
    });

    console.log("TX:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ BUY SUCCESS");

    // update state
    lastBuyPrice = Number(BUY_AMOUNT_USDC);
    hasPosition = true;

  } catch (err) {
    console.error("❌ BUY ERROR:", err.message);
  }
}

// ==========================
// 🔴 SELL
// ==========================
async function sell() {
  try {
    const balance = await token.balanceOf(wallet.address);

    if (balance == 0) {
      console.log("⚠️ No token to sell");
      return;
    }

    console.log("💸 Selling...");

    const minOut = 0;

    const tx = await contract.sell(balance, minOut, {
      gasLimit: 300000
    });

    console.log("TX:", tx.hash);

    await tx.wait();

    console.log("✅ SELL SUCCESS");

    hasPosition = false;

  } catch (err) {
    console.error("❌ SELL ERROR:", err.message);
  }
}

// ==========================
// 📊 CHECK PRICE (SIMULASI)
// ==========================
async function getCurrentPrice() {
  // NOTE:
  // contract kamu tidak expose harga
  // jadi ini dummy (kamu bisa ganti pakai API / logic lain)
  return Math.random() * 2;
}

// ==========================
// 🤖 AUTO TRADING LOOP
// ==========================
async function runBot() {
  console.log("🤖 BOT STARTED");

  while (true) {
    try {
      const price = await getCurrentPrice();
      console.log("📊 Price:", price);

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

  // step awal
  await approveUSDC();

  // start bot
  await runBot();
}

main();

