import * as solana from "@solana/web3.js";
import { Context } from "telegraf";
import { User } from "@prisma/client";

import { DEF_MESSAGE_OPTS, envConf } from "../config";
import { prisma, telegraf, userManager, web3Connection } from "..";
import * as c from "../const";
import * as h from "../helpers";
import * as sh from "../utils/solana_helpers";
import { workMenuBackButton, workMenuBackButtonKeyboard } from "../commands/start";
import { isUnderMaintenance, notifyAboutMaintenance } from "../commands/admin";


const RENT_FAILED_MESSAGE = `Failed to send rent funds; try again, sometimes transaction on Solana can fail. However, if this error keeps repeating, contact our team.`;

export async function showRentOptions(ctx: Context) {
  h.answerCbQuerySafe(ctx);
  await h.tryEditOrReply(
    ctx,
    `How long would you like to rent the bot for?
${c.icons.hourglassFull} If you still have time left, purchased hours will be added to it ${c.icons.hourglassEmpty}`,
    {
      reply_markup: getPaymentKeyboard(),
      ...DEF_MESSAGE_OPTS,
    }
  );
}


export async function rentBot(ctx: Context, durationHours: string | number) {
  let user = await userManager.getOrCreateUser(ctx.from?.id);
  if (isUnderMaintenance() && !user.isBotAdmin) {
    await notifyAboutMaintenance(ctx);
    return;
  }

  if (user.isSendingRentNow) {
    h.answerCbQuerySafe(ctx, `${c.icons.warning} processing your previous request, plz wait`);
    return;
  }
  prisma.user.update({ where: { internalID: user.internalID }, data: { isSendingRentNow: true } }).then((newUser) => user = newUser);
  const settings = await userManager.getOrCreateSettingsFor(user.tgID);
  const tag = `[rent:${h.getShortAddr(user.workWalletPubkey)}_${user.tgID}]`;

  const priceSol = c.RENT_HOUR_TO_PRICE_MAP[durationHours];
  if (!priceSol) {
    h.tryReply(ctx, `Invalid rent duration specified: ${durationHours}; try again`);
    await prisma.user.update({ where: { internalID: user.internalID }, data: { isSendingRentNow: false } });
    return;
  }
  durationHours = Number(durationHours);

  let expiryTs: number;
  if (user.rentExpiresAt > Date.now()) {
    const msToAdd = durationHours * 60 * 60 * 1000;
    expiryTs = user.rentExpiresAt + msToAdd;
  } else {
    expiryTs = h.getExpiryTsHoursFromNow(durationHours);
  }
  h.answerCbQuerySafe(ctx, `Renting...`);
  try {
    const workWalletKP = h.keypairFrom(user.workWalletPrivKey);
    const balanceLamps = await web3Connection.getBalance(workWalletKP.publicKey);
    const balanceSol = balanceLamps / solana.LAMPORTS_PER_SOL;
    const minAllowedBalanceSol = priceSol + 0.001;

    if (balanceSol < minAllowedBalanceSol) {
      h.tryReply(
        ctx,
        `Not enough funds. You need at least ${minAllowedBalanceSol} SOL; you have: ${balanceSol} SOL`,
        { reply_markup: workMenuBackButtonKeyboard }
      );
      await prisma.user.update({ where: { internalID: user.internalID }, data: { isSendingRentNow: false } });
      return;
    }

    h.debug(`${tag} renting for ${durationHours}h...`);
    h.tryEditOrReply(ctx, `Funds detected. Beginning transfer... Waiting time: 20-60 seconds`);
    let transferAmount = 0;
    if (user.referredByTgID) {
      const referrer = await userManager.getOrCreateUser(user.referredByTgID);
      const refFee = (priceSol / 100) * referrer.refFeePerc;
      const refRewardSentOK = await rewardReferrerOf(user, refFee);
      if (!refRewardSentOK) {
        console.error(`${tag} failed to send referral rewards; aborting further transactions`);
        await h.tryReply(ctx, RENT_FAILED_MESSAGE);
        await prisma.user.update({ where: { internalID: user.internalID }, data: { isSendingRentNow: false } });
        return;
      }
      transferAmount = (priceSol - refFee) * solana.LAMPORTS_PER_SOL;
    } else {
      transferAmount = priceSol * solana.LAMPORTS_PER_SOL;
    }

    const success = await sh.sendSol_waitForBalChange(
      workWalletKP,
      new solana.PublicKey(envConf.REVENUE_WALLET),
      transferAmount
    );
    if (success) {
      h.debug(`${tag} rented successfully for ${durationHours}h`);
      await prisma.user.update({
        where: { internalID: user.internalID },
        data: { rentExpiresAt: expiryTs, isSendingRentNow: false },
      });

      const notification = `Received <b>${(transferAmount / solana.LAMPORTS_PER_SOL).toFixed(
        4
      )}</b> SOL after gas & referral fees
+${durationHours} hours
from user ${await h.getUserProfileLinkFrom(user.tgID)}
token addr at time of rent: <code>${settings.selectedTokenAddr}</code>`;

      h.trySend(envConf.TEAM_NOTIFICATIONS_CHAT, notification, DEF_MESSAGE_OPTS);
      //h.trySend(envConf.TEAM_NOTIFICATIONS_CHAT_FALLBACK, notification, DEF_MESSAGE_OPTS); // debug
    } else {
      h.debug(`${tag} rent transaction failed; either failed to get submitted, or balance-change check timed out`);
      h.tryReply(ctx, RENT_FAILED_MESSAGE);
      await prisma.user.update({ where: { internalID: user.internalID }, data: { isSendingRentNow: false } });
      return;
    }

    await h.tryEditOrReply(
      ctx,
      `Congratulations! Your rent is now valid for the next ${durationHours} hour(s)!
You can start using the bot right away`,
      { reply_markup: workMenuBackButtonKeyboard, ...DEF_MESSAGE_OPTS }
    );
    return;
  } catch (e: any) {
    console.error(`${tag} error while renting bot: ${e}`);
    console.trace(e);
    h.tryReply(ctx, `An error ocurred while handling your payment. Details for devs:\n${e}`);
    await prisma.user.update({ where: { internalID: user.internalID }, data: { isSendingRentNow: false } });
    return;
  }
}

function getPaymentKeyboard() {
  const CHAIN_TICKER = "SOL";
  const hours = Object.keys(c.RENT_HOUR_TO_PRICE_MAP);
  const prices = Object.values(c.RENT_HOUR_TO_PRICE_MAP);
  // return {
  //   inline_keyboard: [
  //     [
  //       { text: `${hours[0]} hour - ${prices[0]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[0]}` },
  //       { text: `${hours[1]} hours - ${prices[1]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[1]}` },
  //     ],
  //     [
  //       { text: `${hours[2]} hours - ${prices[2]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[2]}` },
  //       { text: `${hours[3]} hours - ${prices[3]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[3]}` },
  //     ],
  //     [
  //       { text: `${hours[4]} hours - ${prices[4]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[4]}` },
  //       { text: `1 week - ${prices[5]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[5]}` },
  //     ],
  //     [
  //       { text: `${Number(hours[6]) / 24} days - ${prices[6]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[6]}` },
  //     ],
  //     [workMenuBackButton],
  //   ],
  // };
  return {
    inline_keyboard: [
      [
        { text: `${hours[0]} hour - ${prices[0]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[0]}` },
        // { text: `${hours[1]} hours - ${prices[1]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[1]}` },
      ],
      [
        // { text: `${hours[2]} hours - ${prices[2]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[2]}` },
        // { text: `${hours[3]} hours - ${prices[3]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[3]}` },
      ],
      [{ text: `${hours[4]} hours - ${prices[4]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[4]}` }],
      [{ text: `1 week - ${prices[5]} ${CHAIN_TICKER}`, callback_data: `data-rent-${hours[5]}` }],
      // [
      //   {
      //     text: `${Number(hours[6]) / 24} days - ${prices[6]} ${CHAIN_TICKER}`,
      //     callback_data: `data-rent-${hours[6]}`,
      //   },
      // ],
      [workMenuBackButton],
    ],
  };
}

async function rewardReferrerOf(userDB: User, referralFeeSol: number) {
  if (!referralFeeSol) throw Error(`Can't reward referral with ${referralFeeSol} of SOL`);
  try {
    const referrer = await prisma.user.findUnique({
      where: { tgID: userDB.referredByTgID },
    });
    if (!referrer) {
      console.warn(`Attempting to reward referrer, but '${userDB.tgID}' is not referred!`);
      return false;
    }
    const receiverPubkey = new solana.PublicKey(referrer.workWalletPubkey);
    const senderKP = h.keypairFrom(userDB.workWalletPrivKey);
    const referralFeeLamps = Number((referralFeeSol * solana.LAMPORTS_PER_SOL).toFixed(0));
    h.debug(`[${h.getShortAddr(senderKP.publicKey)}] adding referral rewards of ${referralFeeSol} SOL`);
    const success = await sh.sendSol_waitForBalChange(senderKP, receiverPubkey, referralFeeLamps);
    if (success) {
      h.debug(
        `[${h.getShortAddr(senderKP.publicKey)}->${h.getShortAddr(
          receiverPubkey
        )}] ref reward ${referralFeeSol} SOL successfully transferred; ${userDB.tgID} -> ${referrer.tgID}`
      );
      await prisma.user.update({
        where: { internalID: referrer.internalID },
        data: { totalRefRewards: referrer.totalRefRewards + referralFeeSol },
      });
      return true;
    } else {
      console.error(`Tx to add ref rewards failed; referrer TG ID: ${referrer.tgID}`);
      return false;
    }
  } catch (e: any) {
    console.error(`Caught error while trying to reward referrer ${userDB.referredByTgID}; ${e}`);
    console.trace(e);
    return false;
  }
}
