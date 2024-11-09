import * as solana from "@solana/web3.js";
import bs58 from "bs58";
import { Context } from "telegraf";
import { Booster as BoosterPrisma } from "@prisma/client";

import { DEF_MESSAGE_OPTS } from "../config";
import { prisma, userManager, web3Connection } from "..";
import * as c from "../const";
import * as h from "../helpers";
import * as sh from "../utils/solana_helpers";
import { workMenuBackButton } from "../commands/start";
import { User } from "@prisma/client";
import BoosterBase, { BoosterType } from "../classes/boosters/base";
import BoosterSalvager from "../classes/boosters/salvager";
import { isUnderMaintenance, notifyAboutMaintenance } from "../commands/admin";



export async function showWallet_normal(ctx: Context) {
  return _showWallet(ctx, false);
}
export async function showWallet_withPrivKey(ctx: Context) {
  return _showWallet(ctx, true);
}


async function _showWallet(ctx: Context, isShowingPK = false) {
  const keyboard = {
    inline_keyboard: [
      [{ text: `${c.icons.arrowDoubledown} Withdraw all funds`, callback_data: `withdraw` }],
      [{ text: `${c.icons.write} Set withdrawal wallet`, callback_data: `withdrawal_wallet` }],
      [{
        text: `${c.icons.cashBankHouse}${c.icons.recyleTrashDump} Empty all inactive puppet-wallets`,
        callback_data: `empty_puppets`
      }],
      [{
        text: `${c.icons.lock} ${(isShowingPK ? 'Hide secret key' : 'Show secret key')}`,
        callback_data: (isShowingPK ? `wallet` : `wallet_pk`),
      }],
      [workMenuBackButton, { text: `${c.icons.refresh} Refresh`, callback_data: `wallet` }],
    ],
  };


  const user = await userManager.getOrCreateUser(ctx.from?.id);
  const workKP = h.keypairFrom(user.workWalletPrivKey);
  if (isShowingPK)
    h.debug(`[${h.getShortAddr(workKP.publicKey)}] user ${user.tgID} revealed secret key`);
  else
    h.debug(`[${h.getShortAddr(workKP.publicKey)}] user ${user.tgID} requested wallet overview`);

  const balance = await userManager.getTotalUserBalance(user);
  h.answerCbQuerySafe(ctx);

  await h.tryEdit(
    ctx,
    `
${c.icons.cashBankHouse} ${balance.formattedText}

${c.icons.cashBanknote} Address:
<code>${workKP.publicKey.toBase58()}</code>
${(isShowingPK ?
      `${c.icons.lock} Secret key:\n<code>${bs58.encode(workKP.secretKey)}</code>` :
      '(secret key hidden)'
    )}

${c.icons.arrowDoubledown} Withdrawal wallet:
${user.withdrawWalletAddr ? `<code>${user.withdrawWalletAddr}</code>` : "<i>unset</i>"}
`,
    {
      reply_markup: keyboard,
      ...DEF_MESSAGE_OPTS,
    }
  );
}



export async function withdrawFunds(ctx: Context) {
  h.answerCbQuerySafe(ctx);
  const user = await userManager.getOrCreateUser(ctx.from?.id);
  const workWalletKP = h.keypairFrom(user.workWalletPrivKey);
  h.debug(`[${h.getShortAddr(workWalletKP.publicKey)}] user ${user.tgID} requested withdrawal`);

  if (!user.withdrawWalletAddr) {
    await h.tryEditOrReply(ctx, `No withdrawal wallet set. Please go back and set your withdrawal wallet first!`,
      backToWalletKeyboard);
    return;
  }

  const balanceSol = await sh.getSolBalance(workWalletKP.publicKey);
  if (balanceSol === null) {
    h.debug(`[${h.getShortAddr(workWalletKP.publicKey)}] failed to fetch balance(${balanceSol})`);
    await h.tryEditOrReply(ctx, `Failed to fetch balance, likely due to network error; please, try again, it'll work after a few tries`);
    return;
  }
  const availableBalance = balanceSol - 0.003;
  if (availableBalance <= 0) {
    h.debug(`[${h.getShortAddr(workWalletKP.publicKey)}] not enough funds to withdraw`);
    await h.tryEditOrReply(ctx, `Not enough funds to withdraw`);
    return;
  }

  h.tryReply(ctx, `Funds detected. Beginning transfer... Waiting time: 20-60 seconds`);
  const txHash = await sh.sendAllSol(workWalletKP, new solana.PublicKey(user.withdrawWalletAddr));
  const success = !!txHash;
  if (success) {
    await h.tryReply(ctx, `Withdrawal successful! Withdrew ${availableBalance} SOL`);
  } else {
    await h.tryReply(ctx, `Failed to withdraw funds; try again. If this error keeps repeating, contact our team.`);
  }
  return;
}



export async function emptyAllPuppets(ctx: Context) {
  const user = await userManager.getOrCreateUser(ctx.from?.id);
  if (isUnderMaintenance() && !user.isBotAdmin) {
    await notifyAboutMaintenance(ctx);
    return;
  }

  const type: BoosterType = "salvager";
  const settings = await userManager.getOrCreateSettingsFor(user.tgID);
  const balance = await userManager.getTotalUserBalance(user);
  if (balance.puppet == 0) {
    h.tryEditOrReply(ctx, `You don't have any puppets with funds in them.`, backToWalletKeyboard);
    return;
  }

  const activeBoosterOfSameType = BoosterBase.getActiveBoosterFor(settings.selectedTokenAddr, type, user.tgID);
  let existingDbEntry_OtherOfSameType: BoosterPrisma | null = null;
  if (activeBoosterOfSameType) {
    existingDbEntry_OtherOfSameType = await prisma.booster.findFirst({
      where: {
        tokenAddress: activeBoosterOfSameType.tokenAddr.toBase58(),
        ownerTgID: user.tgID,
        NOT: {
          internalID: {
            equals: activeBoosterOfSameType.internalID || '',
          }
        }
      }
    });
  }
  const existingDbEntry_isActive = (
    existingDbEntry_OtherOfSameType && BoosterBase.getActiveByID(existingDbEntry_OtherOfSameType.internalID)
  );

  if (existingDbEntry_OtherOfSameType && !existingDbEntry_isActive) {
    await prisma.booster.delete({ where: { internalID: existingDbEntry_OtherOfSameType.internalID } });
    h.debug(`found and removed old inactive booster DB entry for ${h.getShortAddr(existingDbEntry_OtherOfSameType.tokenAddress)}:${existingDbEntry_OtherOfSameType.type}, user '${user.tgID}'`);
  }
  if (activeBoosterOfSameType || existingDbEntry_isActive) {
    await h.tryEditOrReply(ctx, `You are already trying to empty your puppets. It can take up to 10 minutes to empty them all, depending on how busy Solana is`, backToWalletKeyboard);
    return;
  }

  try {
    h.answerCbQuerySafe(ctx, `Starting the process, please wait...`);
    const salvager = new BoosterSalvager(
      h.keypairFrom(user.workWalletPrivKey), user.tgID, new solana.PublicKey(settings.selectedTokenAddr), settings
    );

    salvager.start();
    await h.tryReply(ctx, `Process started. Emptying of inactive puppet-wallets can take up to 10 minutes.
You will be notified about the results.`);
    return;
  } catch (e: any) {
    await h.tryEditOrReply(ctx, `Failed to start the process; technical details for devs:\n${String(e)}`, backToWalletKeyboard);
    return;
  }
}


export const backToWalletKeyboard = {
  reply_markup: {
    inline_keyboard: [[{
      text: `${c.icons.backArrow} Go back`,
      callback_data: `wallet`,
    }]]
  }
}
