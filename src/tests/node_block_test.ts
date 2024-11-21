import { Connection } from "@solana/web3.js";
import { envConf } from "../config";


const RPC_HTTPS_ALCHEMY = "https://solana-mainnet.g.alchemy.com/v2/yKznUGE6i2hR_LPNU2-uhjYG2FS8oIiB";
const RPC_HTTPS_PRIVATE_NODE = "http://185.26.10.225:8899";
//GRPC = "https://185.26.10.233:10000"
//RPC_HTTPS_ALCHEMY = 
//RPC_HTTPS_PRIVATE_NODE = 

async function getCurrentBlockNumber() {
  // Replace with your Solana RPC URLYou can also use a custom RPC URL here

  try {
    const connection = new Connection(RPC_HTTPS_PRIVATE_NODE);
    const slot = await connection.getSlot();
    return slot;
    console.log("[PRIMARY] Current block number (slot):", slot);
  } catch (error) {
    console.error("Error fetching block number:", error);
    return 0;
  }
}
async function getCurrentBlockNumberAlchemy() {
  // Replace with your Solana RPC URLYou can also use a custom RPC URL here

  try {
    const connection = new Connection(RPC_HTTPS_ALCHEMY);
    const slot = await connection.getSlot();
    return slot;
    console.log("[BACKUP]  Current block number (slot):", slot);
  } catch (error) {
    console.error("Error fetching block number:", error);
    return 0;
  }
}

async function getSyncStatus() {
  // Get block number from primary
  // Get bloock number from secondary
  // Compare the two and get the difference

  const slotPrimary = await getCurrentBlockNumber();
  const slotAlchemy = await getCurrentBlockNumberAlchemy();

  // Clear the console
  console.clear();

  console.log(`[###] Node Sync Helper [###]`);
  console.log(`--------------------`);
  console.log("Primary RPC URL:", RPC_HTTPS_PRIVATE_NODE);
  console.log("Backup RPC URL:", RPC_HTTPS_ALCHEMY);
  console.log(`--------------------`);
  console.log(`Our Node Current Slot:       ${slotPrimary}`);
  console.log(`Solana Network Current Slot: ${slotAlchemy}`);
  console.log(`--------------------`);
  console.log(`Difference: ${slotPrimary - slotAlchemy}`);
  console.log(`Status: ${slotPrimary - slotAlchemy > 100 ? "Out of sync" : "In sync"}`);
  console.log(`--------------------`);
}
async function getSyncStatusLoop() {
  while (true) {
    await getSyncStatus();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// test();
// getSyncStatus();
getSyncStatusLoop();
