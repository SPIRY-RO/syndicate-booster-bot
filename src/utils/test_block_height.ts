import { Connection, clusterApiUrl } from "@solana/web3.js";
import { envConf } from "../config";

const HTTP_RPC_URL_BACKUP = 'https://solana-mainnet.g.alchemy.com/v2/yKznUGE6i2hR_LPNU2-uhjYG2FS8oIiB' // alchemy
/*
#HTTP_RPC_URL='https://mainnet.helius-rpc.com/?api-key=6e407c59-d9a7-46a3-90c2-766dcd43ba52' # helius
HTTP_RPC_URL='http://169.197.85.114:8899' # private
#SOLANA_ENDPOINT='https://solana-api.projectserum.com'
#SOLANA_ENDPOINT='https://rpc.ankr.com/solana'
*/


async function getCurrentBlockNumber() {
  // Replace with your Solana RPC URLYou can also use a custom RPC URL here
  const connection = new Connection(envConf.HTTP_RPC_URL);

  try {
    const slot = await connection.getSlot();
    console.log("[PRIMARY] Current block number (slot):", slot);
  } catch (error) {
    console.error("Error fetching block number:", error);
  }
}
async function getCurrentBlockNumberBackup() {
  // Replace with your Solana RPC URLYou can also use a custom RPC URL here
  const connection = new Connection(HTTP_RPC_URL_BACKUP);

  try {
    const slot = await connection.getSlot();
    console.log("[BACKUP]  Current block number (slot):", slot);
  } catch (error) {
    console.error("Error fetching block number:", error);
  }
}

async function test() {
  while (true) {
    // Do them both at same time
    await Promise.all([getCurrentBlockNumber(), getCurrentBlockNumberBackup()]);
    // await getCurrentBlockNumber();
  }
}

async function getSyncStatus() {
  // Get block number from primary
  // Get bloock number from secondary
  // Compare the two and get the difference

  const connection = new Connection(envConf.HTTP_RPC_URL);
  const connectionBackup = new Connection(HTTP_RPC_URL_BACKUP);

  const slotPrimary = await connection.getSlot();
  const slotBackup = await connectionBackup.getSlot();

  // Clear the console
  console.clear();

  console.log(`[###] Node Sync Helper [###]`);
  console.log(`--------------------`);
  console.log("Primary RPC URL:", envConf.HTTP_RPC_URL);
  console.log("Backup RPC URL:", HTTP_RPC_URL_BACKUP);
  console.log(`--------------------`);
  console.log(`Solana Network Current Slot: ${slotBackup}`);
  console.log(`Our Node Current Slot:       ${slotPrimary}`);
  console.log(`--------------------`);
  console.log(`Difference: ${slotPrimary - slotBackup}`);
  console.log(`Status: ${slotPrimary - slotBackup > 100 ? "Out of sync" : "In sync"}`);
  console.log(`--------------------`);
}


export async function getSyncStatusLoop() {
  while (true) {
    await getSyncStatus();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// test();
// getSyncStatus();
//getSyncStatusLoop();
