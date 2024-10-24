
import * as solana from '@solana/web3.js';
import bs58 from 'bs58';

import { prisma, userManager, web3Connection } from "..";
import { DEF_MESSAGE_OPTS } from "../config";
import * as c from "../const";
import * as h from "../helpers";
import { showHelpMessage } from "./help";
import { wizardSetAddr_name } from '../scenes/set-active-address';
import { Context } from 'telegraf';
import { getDexscreenerTokenInfo } from "../utils/dexscreener";

const workMenuKeyboard = {
  inline_keyboard: [
    [
      {
        text: `${c.icons.lock} RENT BOOSTER`,
        callback_data: `show_rent`,
      },

    ],
    /*
    [
      {
        text: `My boosters`,
        callback_data: `my_boosters`,
      },
    ],
    */
    [
      {
        text: `${c.icons.chartBars} BOOST VOLUME `,
        callback_data: `data-boosterShow-volume`,
      },
      {
        text: `${c.icons.cup} BOOST RANK`,
        callback_data: `data-boosterShow-rank`,
      },
      {
        text: `${c.icons.bag} BOOST HOLDERS`,
        callback_data: `data-boosterShow-holders`,
      },
    ],
    [
      {
        text: `${c.icons.handshake}REFERRALS - EARN $$$$`,
        callback_data: `referrals`,
      },
      {
        text: `${c.icons.refresh} REFRESH DATA`,
        callback_data: `work_menu_refresh`
      },
    ],
    [
    {
      text: `${c.icons.cashBankHouse} WALLET`,
      callback_data: `wallet`,
    }
  ],
    [
      {
        text: `${c.icons.write}CHANGE CONTRACT ADDRESS`,
        callback_data: `token_address_wizard`,
      },
    ],
  ]
}

export const workMenuBackButtonKeyboard = {
  inline_keyboard: [[{
    text: `${c.icons.backArrow} MAIN MENU`,
    callback_data: `work_menu`,
  }]]
};
export const workMenuBackButton = {
  text: `${c.icons.backArrow} MAIN MENU`,
  callback_data: `work_menu`,
};



export async function refreshWorkMenu(ctx: any) {
  return workMenu(ctx, true);
}

export async function showWorkMenu(ctx: any) {
  const isPMs = (ctx.chat?.type === "private");
  if (!isPMs) {
    await h.tryReply(ctx, `This command is intended for use in PMs`);
    return;
  } 
  return workMenu(ctx, false);
}

async function workMenu(ctx: any, onlyRefresh = false) {
  h.answerCbQuerySafe(ctx);

  const user = await userManager.getOrCreateUser(ctx.from.id);
  const settings = await userManager.getOrCreateSettingsFor(ctx.from.id);
  const balanceLamps = await web3Connection.getBalance(h.keypairFrom(user.workWalletPrivKey).publicKey);
  const balanceSol = balanceLamps / solana.LAMPORTS_PER_SOL;
  //const tokenData = await web3.getParsedAccountInfo(new solana.PublicKey(settings.selectedTokenAddr));
  const tokenInfo = await getDexscreenerTokenInfo(settings.selectedTokenAddr);
  if (!tokenInfo) {
    await h.tryReply(ctx, `Could not fetch token info for ${settings.selectedTokenAddr}`);
    return;
  }
  if (!settings.selectedTokenAddr) {
    return ctx.scene.enter(wizardSetAddr_name, {});
  }

  const text = `⫸ MAIN MENU ⫷

${c.icons.moonWhite} TOKEN CONTRACT : <code>${settings.selectedTokenAddr}</code>
${c.icons.moonWhite} TOKEN NAME : <code>${tokenInfo.tokenName}</code>

${c.icons.clockRed} RENT TIME LEFT : <b>${h.secondsToTimingNotation((user.rentExpiresAt - Date.now()) / 1000)}</b>
${c.icons.cashBanknote} BALANCE : <b>${balanceSol < c.MIN_BOOSTER_BALANCE_SOL ? 'empty' : `${balanceSol.toFixed(4)}`}</b> SOL
${c.icons.cashBankHouse} YOUR WALLET ADDRESS : <code>${h.keypairFrom(user.workWalletPrivKey).publicKey.toBase58()}</code>



⫸ "${c.icons.cashBankHouse} MY WALLET" TO DEPOSIT AND WITHDRAW FUNDS.

⫸ "${c.icons.lock} RENT BOOSTER" TO RENT THE BOT AND START

⫸ "${c.icons.chartBars} BOOST VOLUME" AFTER BOT WAS RENTED, YOU CAN START BOOSTING YOUR TOKEN VOLUME HERE.

⫸ "${c.icons.cup} BOOST RANK" AFTER BOT WAS RENTED, YOU CAN START BOOSTING YOUR TOKEN RANK HERE.

⫸ "${c.icons.bag} BOOST HOLDERS" AFTER BOT WAS RENTED, YOU CAN START BOOSTING YOUR TOKEN HOLDERS HERE.




If any inquiries don't hesitate to reach us directly.
`;

  if (onlyRefresh)
    await h.tryEdit(ctx, text, { reply_markup: workMenuKeyboard, ...DEF_MESSAGE_OPTS });
  else
    await h.tryEditOrReply(ctx, text, { reply_markup: workMenuKeyboard, ...DEF_MESSAGE_OPTS });
  return;
}
export async function showWelcomeMessage(ctx: Context) {
  h.answerCbQuerySafe(ctx);
  const isPMs = (ctx.chat?.type === "private");
  if (!isPMs) {
    await h.tryReply(ctx, `This command is intended for use in PMs`);
    return;
  }
  const userSettings = await userManager.getOrCreateSettingsFor(ctx.from?.id);

  // Send the image banner only once


  /* Start message */
  const startMessage = `

${c.icons.star} SYNDICATE BOOSTING BOT ${c.icons.star}

We are here to provide you the best Volume Boosting Bot on Solana

${c.icons.flame} Efficient Volume Handling ${c.icons.flame}
- Maximize the impact of every trade with a system designed to manage volume smoothly and effectively.

${c.icons.sprout} Organic Volume Module ${c.icons.sprout}
- Create a consistent and reliable trading volume that attracts investors and builds long-term market trust.

${c.icons.shield} Anti MEV-Protection ${c.icons.shield}
- Protect your trades with built-in defense against MEV exploitation.

${c.icons.chainLink} FOR SUPPORT & SALES CONTACT @SpiryBTC OR @dukuweb3 
`;

  const keyboard = [
    [{
      text: `${c.icons.green} START HERE - ENTER TOKEN CONTRACT ADDRESS`,
      callback_data: `token_address_wizard`,
    }],
    [{
      text: `${c.icons.cashBankHouse} WALLET`,
      callback_data: `wallet`,
    }],
    [{
      text: `${c.icons.handshake} REFERRAL PROGRAM / EARN $$$ `,
      callback_data: `referrals`,
    }],
  ];

  if (userSettings.selectedTokenAddr) {
    keyboard.push([{
      text: `${c.icons.diskette} PREVIOUS TOKEN -  / MAIN MENU`,
      callback_data: `work_menu`,
    }]);
  }

  await h.tryEditOrReply(ctx, startMessage, {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
  return;
}


export async function referIfNeeded_thenShowStart(ctx: any, referrerInfo?: string) {
  const senderID_str = String(ctx.from?.id);

  if (!referrerInfo) {
    return showWelcomeMessage(ctx);
  }
  referrerInfo = referrerInfo.slice(2); // strip away "r-" 
  //@ts-ignore
  if (isNaN(referrerInfo)) {
    const text = `Received referrer ID, but it appears to be broken: ${referrerInfo}`;
    console.warn(text);
    await h.tryReply(ctx, text);
    return showWelcomeMessage(ctx);
  }
  const referrer = await userManager.getUser(referrerInfo);
  if (!referrer) {
    const text = `Attempting to refer to non-existent user: ${referrerInfo}`;
    console.warn(text);
    await h.tryReply(ctx, text);
    return showWelcomeMessage(ctx);
  }
  let thisUser = await userManager.getUser(senderID_str);
  if (thisUser) {
    console.warn(`User account already exists; not referring them`);
    return showWelcomeMessage(ctx);
  } else {
    thisUser = await userManager.getOrCreateUser(senderID_str);
  }
  if (thisUser.referredByTgID) {
    const text = `Current user ${senderID_str} is already referred by someone else; will not overwrite the existing referrer`;
    console.warn(text);
    //await tryReply(ctx, text);
    return showWelcomeMessage(ctx);
  } else if (thisUser.tgID === referrer.tgID) {
    console.warn(`User ${thisUser.tgID} attempted to refer themselves; likely clicked their own referral link`);
    return showWelcomeMessage(ctx);
  }
  await prisma.user.update({
    where: {
      internalID: thisUser.internalID,
    },
    data: {
      referredByTgID: referrer.tgID,
    }
  })
  console.info(`Referred user ${thisUser.tgID} to ${referrer.tgID} successfully`);
  await h.tryReply(ctx, '✅ You have successfully used a referral link');

  return showWelcomeMessage(ctx);
}