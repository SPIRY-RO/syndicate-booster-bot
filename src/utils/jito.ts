// Jito Bundling part
import * as solana from "@solana/web3.js";
import { SearcherClient, searcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
import { isError } from "jito-ts/dist/sdk/block-engine/utils";
import base58 from "bs58";
import axios from "axios";

import { statusChecker, web3Connection } from "..";
import * as h from "../helpers";
import * as c from "../const";
import { envConf } from "../config";
import { JITO_BUNDLE_TIMEOUT } from "../const";
import { getRandomTipAccount, getTipFromSetting, jitoTip, TipSetting } from "./jito-tip-deamons";

const MAX_TXS = 4;

const jitoKey = solana.Keypair.fromSecretKey(base58.decode(envConf.JITO_AUTH_PRIVATE_KEY));
export const searchClient = searcherClient(envConf.BLOCK_ENGINE_URL, jitoKey);

/**
 * Calculează un JitoTip dinamic pe baza profitului estimat și a congestionării.
 * Dacă nu există profit estimat, folosește tipul de bază din API.
 */
export async function calculateDynamicJitoTip({
  profitEstimate,
  congestionLevel,
  baseTip
}: {
  profitEstimate?: number,
  congestionLevel?: number,
  baseTip: number
}): Promise<number> {
  let tip = baseTip;
  if (profitEstimate && profitEstimate > 0) {
    tip = Math.max(baseTip, profitEstimate * 0.02); // 2% din profit
  }
  if (congestionLevel && congestionLevel > 0.8) {
    tip *= 2; // dublează tipul la congestionare mare
  }
  // Minim 0.0005 SOL
  return Math.max(tip, 0.0005 * 1e9);
}

export async function makeAndSendJitoBundle(
  txs: solana.VersionedTransaction[],
  keypair: solana.Keypair,
  tipOverrideSetting?: string | number,
  options?: { profitEstimate?: number, congestionLevel?: number }
): Promise<boolean> {
  let tipValue: number;
  if (!tipOverrideSetting || tipOverrideSetting == '0') {
    // Folosește tipul dinamic dacă nu e specificat explicit
    tipValue = await calculateDynamicJitoTip({
      profitEstimate: options?.profitEstimate,
      congestionLevel: options?.congestionLevel,
      baseTip: jitoTip.chanceOf75
    });
  } else if (isNaN(tipOverrideSetting as number)) {
    tipValue = getTipFromSetting(tipOverrideSetting as TipSetting)
  } else {
    tipValue = Number(tipOverrideSetting);
  }

  if (tipValue < jitoTip.chanceOf25 || tipValue > jitoTip.chanceOf99 * 10) {
    console.warn(`[jito] valid but inadequately large/small tip supplied: ${tipValue}`);
  }

  try {
    const txNum = Math.ceil(txs.length / 4);
    for (let i = 0; i < txNum; i++) {
      const upperIndex = (i + 1) * 4;
      const downIndex = i * 4;
      const newTxs = [];
      for (let j = downIndex; j < upperIndex; j++) {
        if (txs[j]) newTxs.push(txs[j]);
      }
      let bundleIDRaw = await _bundleExecuter(newTxs, keypair, tipValue);
      let bundleID: string | null = null;
      if (typeof bundleIDRaw === 'string') {
        bundleID = bundleIDRaw;
      } else if (bundleIDRaw && typeof bundleIDRaw === 'object' && 'ok' in bundleIDRaw && bundleIDRaw.ok && 'value' in bundleIDRaw) {
        bundleID = bundleIDRaw.value;
      }
      if (bundleID) {
        if (await waitUnilBundleSucceeds(bundleID)) return true;
        else {
          // Fallback: retrimite tranzacțiile cu priority fee nativ dacă bundle-ul eșuează
          console.warn(`[jito] Bundle failed, trying fallback with priority fee`);
          for (const tx of newTxs) {
            try {
              // Pentru VersionedTransaction, trebuie să reconstruim instrucțiunile
              // deoarece instructions nu există direct pe message, ci pe compiledInstructions
              // și nu pot fi mutate direct. Deci, nu putem modifica instrucțiunile unui VersionedTransaction deja semnat.
              // Ca fallback, poți reconstrui tranzacția cu priority fee dacă ai acces la instrucțiuni originale.
              // Aici doar logăm că fallback-ul nu poate modifica instrucțiunile unui VersionedTransaction deja semnat.
              console.warn('[jito] Fallback: nu pot adăuga priority fee la VersionedTransaction deja semnat. Recomandă reconstruirea tranzacției cu priority fee inclus.');
              // Poți trimite totuși tranzacția așa cum e, ca fallback simplu:
              await web3Connection.sendTransaction(tx, { maxRetries: 3, skipPreflight: false });
            } catch (e) {
              console.error(`[jito] Fallback priority fee tx failed:`, e);
            }
          }
          return false;
        }
      } else {
        return false;
      }
    }
    let successNum = 0;
    if (successNum == txNum) return true;
    else return false;
  } catch (error) {
    console.log("In bundle()");
    console.log(error);
    console.trace(error);
    return false;
  }
}

async function _bundleExecuter(txs: solana.VersionedTransaction[], signerKeypair: solana.Keypair, tipInLamps: number) {
  try {
    //const bundleTransactionLimit = 4; // this is a hard-limit as far as I can tell
    const bundleTransactionLimit = 5; // this is a hard-limit as far as I can tell

    const bundleID = await build_bundle(searchClient, bundleTransactionLimit, txs, signerKeypair, tipInLamps);
    // safe to keep below line commented-out. But it provides good debug output from Solana in case of fails
    //const bundleReturnCode = await onBundleResult(searchClient); // debug
    return bundleID;
  } catch (error) {
    console.log("In _bundleExecuter()");
    console.log(error);
    console.trace(error);
    return null;
  }
}

async function build_bundle(
  search: SearcherClient,
  bundleTransactionLimit: number,
  txs: solana.VersionedTransaction[],
  signerKeypair: solana.Keypair,
  tipInLamps: number
) {
  const tipAccount = getRandomTipAccount();

  const bund = new Bundle([], bundleTransactionLimit);
  const resp = await web3Connection.getLatestBlockhash("processed");
  bund.addTransactions(...txs);

  //let jitoTipLamps = h.incrementByPercent(jitoTipSizeFor.chanceOf99, 10);

  h.debug(`[jito] tip is ${tipInLamps} lamports`);

  let maybeBundle = bund.addTipTx(signerKeypair, tipInLamps, tipAccount, resp.blockhash);

  if (isError(maybeBundle)) {
    throw maybeBundle;
  }
  try {
    const bundleID = await search.sendBundle(maybeBundle);
    return bundleID;
  } catch (e) {
    console.error("Error in build_bundle()");
    console.error(e);
    console.trace(e);
  }
  return null;
}

const onBundleResult = (searchClient: SearcherClient): Promise<number> => {
  let first = 0;
  let isResolved = false;

  return new Promise((resolve) => {
    // Set a timeout to reject the promise if no bundle is accepted
    setTimeout(() => {
      resolve(first);
      isResolved = true;
    }, JITO_BUNDLE_TIMEOUT);

    searchClient.onBundleResult(
      (result: any) => {
        console.log(`result in onBundleResult:`);
        console.log(result);
        if (isResolved) return first;
        // clearTimeout(timeout) // Clear the timeout if a bundle is accepted
        const isAccepted = result.accepted;
        const isRejected = result.rejected;
        if (isResolved == false) {
          if (isAccepted) {
            console.log(`bundle accepted, ID: ${result.bundleId}  | Slot: ${result.accepted!.slot}`);
            first += 1;
            isResolved = true;
            resolve(first); // Resolve with 'first' when a bundle is accepted
          }
          if (isRejected) {
            // Do not resolve or reject the promise here
          }
        }
      },
      (e: any) => {
        console.log("In onBundleResult()");
        console.log(e);
        console.trace(e);
        // Do not reject the promise here
      }
    );
  });
};

export async function getBundleStatuses(bundleIds: [string]) {
  try {
    const response = await axios({
      method: "POST",
      url: `https://${envConf.BLOCK_ENGINE_URL}/api/v1/bundles`,
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "getBundleStatuses",
        params: [bundleIds],
      },
    });

    console.dir(response.data, {depth: 6});
    return response.data?.result?.value;
    //return response.data;
  } catch (e: any) {
    console.error(`Error while getting bundle status: ${String(e)}`);
  }
}

async function waitUnilBundleSucceeds(bundleID: string) {
  if (!bundleID) return false;
  return await statusChecker.waitForResult(bundleID);
}
