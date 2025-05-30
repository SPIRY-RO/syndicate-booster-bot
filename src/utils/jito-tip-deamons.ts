import * as solana from "@solana/web3.js";
import axios from "axios";

import * as h from "../helpers";
import { searchClient } from "./jito";

const JITO_TIP_ACC_REFETCH_INTERVAL = 120 * 1000;
const JITO_TIP_STAT_CHECK_INTERVAL = 5 * 1000;
const TIP_STATS_API_URL = "https://bundles.jito.wtf/api/v1/bundles/tip_floor";
const OVER_99_INCREMENT_FACTOR = 1.15;

const AVG_TIP_MAX_LIMIT = 500000;

export const jitoTip: TipMetrics = {
  chanceOf25_inSol: 0,
  chanceOf50_inSol: 0,
  chanceOf75_inSol: 0,
  chanceOf95_inSol: 0,
  chanceOf99_inSol: 0,
  chanceOfOver99_inSol: 0,
  average_inSol: 0,

  chanceOf25: 0,
  chanceOf50: 0,
  chanceOf75: 0,
  chanceOf95: 0,
  chanceOf99: 0,
  chanceOfOver99: 0,
  average: 0,
};

// static values that seem to never change; were previously fetched from Jito
let tipAccounts: string[] = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"
];


export async function runJitoTipMetricUpdater() {
  while (true) {
    await fetchTipFloorData();
    //console.log(`jito tips updated:`);
    //console.log(jitoTip);
    // await calcAverageTip();
    await h.sleep(JITO_TIP_STAT_CHECK_INTERVAL);
  }
}


async function fetchTipFloorData(): Promise<void> {
  try {
    const response = await axios.get(TIP_STATS_API_URL);
    const data = response.data[0];

    jitoTip.chanceOf25_inSol = data.landed_tips_25th_percentile;
    jitoTip.chanceOf50_inSol = data.landed_tips_50th_percentile;
    jitoTip.chanceOf75_inSol = data.landed_tips_75th_percentile;
    jitoTip.chanceOf95_inSol = data.landed_tips_95th_percentile;
    jitoTip.chanceOf99_inSol = data.landed_tips_99th_percentile;
    jitoTip.chanceOfOver99_inSol = Number(data.landed_tips_99th_percentile) * OVER_99_INCREMENT_FACTOR;

    jitoTip.chanceOf25 = Math.round(jitoTip.chanceOf25_inSol * solana.LAMPORTS_PER_SOL);
    jitoTip.chanceOf50 = Math.round(jitoTip.chanceOf50_inSol * solana.LAMPORTS_PER_SOL);
    jitoTip.chanceOf75 = Math.round(jitoTip.chanceOf75_inSol * solana.LAMPORTS_PER_SOL);
    jitoTip.chanceOf95 = Math.round(jitoTip.chanceOf95_inSol * solana.LAMPORTS_PER_SOL);
    jitoTip.chanceOf99 = Math.round(jitoTip.chanceOf99_inSol * solana.LAMPORTS_PER_SOL);
    jitoTip.chanceOfOver99 = Math.round(jitoTip.chanceOfOver99_inSol * solana.LAMPORTS_PER_SOL);
  } catch (e: any) {
    console.error("Error fetching tip floor data:");
    if (e.response) {
      // The request was made and the server responded with a non-2xx status code
      console.error(e.response.data);
      console.error(e.response.status);
      //console.error(e.response.headers);
    } else {
      console.trace(e);
    }
  }
}

async function calcAverageTip() {
  let newAvgTip = await getAverageJitoTip();
  if (!newAvgTip) return;
  if (newAvgTip.lamps > AVG_TIP_MAX_LIMIT) {
    //console.warn(`[jito] average tip is too high(${newAvgTip.lamps}); capping it at max ${AVG_TIP_MAX_LIMIT} lamports`);
    newAvgTip = { lamps: AVG_TIP_MAX_LIMIT, sol: h.roundDown(AVG_TIP_MAX_LIMIT / solana.LAMPORTS_PER_SOL, 9) };
  }
  jitoTip.average = newAvgTip.lamps;
  jitoTip.average_inSol = newAvgTip.sol;
}

async function getAverageJitoTip() {
  try {
    const response = await axios({
      method: "get",
      url: "https://explorer.jito.wtf/wtfrest/api/v1/bundles/recent",
      params: {
        limit: 200,
        sort: "Time",
        asc: false,
        timeframe: "Week",
      },
    });

    const data = response.data;
    const averageTip_lamps = calculateAverageTip(data);

    // Round to the nearest 5 decimals
    const averageTip_sol = Math.round((averageTip_lamps / solana.LAMPORTS_PER_SOL) * 100000) / 100000;
    //h.debug(`[jito-tip] Average tip: ${averageTip_sol} SOL`);
    return { lamps: averageTip_lamps, sol: averageTip_sol };
  } catch (e: any) {
    console.error(`[jito-tip] Error when calculating average tip:`);
    if (e.response) {
      // The request was made and the server responded with a non-2xx status code
      console.error(e.response.data);
      console.error(e.response.status);
      //console.error(e.response.headers);
    } else {
      console.trace(e);
    }
    return null;
  }
}

function calculateAverageTip(data: JitoBundle[]) {
  if (!Array.isArray(data) || data.length === 0) {
    return 0;
  }
  const totalTip = data.reduce((sum, item) => sum + item.landedTipLamports, 0);
  return Number((totalTip / data.length).toFixed(0));
}


// no need to run this anymore; we now simply use static values supplied at the top of this file
export async function runJitoTipAccsUpdater() {
  while (true) {
    await fetchTipAccounts();
    await h.sleep(JITO_TIP_ACC_REFETCH_INTERVAL);
  }
}

// broken on node v22; works fine on v20
async function fetchTipAccounts() {
  try {
    const newAccounts = await searchClient.getTipAccounts();
    if (!newAccounts || newAccounts?.length === 0) return;
    tipAccounts = newAccounts;
  } catch (e: any) {
    console.error(`[jito-deamons] error while fetching tip accounts: ${e}`);
  }
}


export function getRandomTipAccount() {
  const _tipAccount = tipAccounts[Math.min(Math.floor(Math.random() * tipAccounts.length), 3)];
  return new solana.PublicKey(_tipAccount);
}

export async function waitForJitoTipMetrics() {
  const timeout = 10 * 1000;
  const timeoutAt = Date.now() + timeout;
  while (Date.now() < timeoutAt) {
    if (jitoTip.chanceOf99 != 0 && jitoTip.average != 0) return true;
    await h.sleep(250);
  }
  console.warn(`Jito tip metrics are still not fetched after ${timeout / 1000}s`);
  return false;
}


export function getTipFromSetting_forPrint(tipSetting: TipSetting) {
  const tipNumeric = getTipFromSetting(tipSetting);
  return (tipNumeric / solana.LAMPORTS_PER_SOL).toPrecision(3);
}

export function getTipFromSetting(tipSetting: TipSetting) {
  switch (tipSetting) {
    case "high":
      return jitoTip.chanceOf95;
      break;
    case "normal":
      return jitoTip.chanceOf75;
      break;
    case "low":
      return jitoTip.chanceOf50;
      break;
    case "min":
      return jitoTip.chanceOf25;
      break;
    default:
      console.warn(`[jito_tip] unknown tip setting received: ${tipSetting}`);
      return jitoTip.chanceOf75;
      break;
  }
}

export type TipSetting = "min" | "low" | "normal" | "high"

export type TipMetrics = {
  chanceOf25_inSol: number;
  chanceOf50_inSol: number;
  chanceOf75_inSol: number;
  chanceOf95_inSol: number;
  chanceOf99_inSol: number;
  chanceOfOver99_inSol: number;
  average_inSol: number;

  chanceOf25: number;
  chanceOf50: number;
  chanceOf75: number;
  chanceOf95: number;
  chanceOf99: number;
  chanceOfOver99: number;
  average: number;
};

interface JitoBundle {
  bundleId: string;
  timestamp: string;
  tippers: string[];
  transactions: string[];
  landedTipLamports: number;
}

