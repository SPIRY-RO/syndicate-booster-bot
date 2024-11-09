import * as solana from '@solana/web3.js';
import { Context, Scenes } from "telegraf";

import { prisma, userManager } from "..";
import * as h from "../helpers";
import * as c from "../const";
import { BoosterType } from "../classes/boosters/base";
import { getTipFromSetting, getTipFromSetting_forPrint, jitoTip as jitoTip_globals, TipSetting } from "../utils/jito-tip-deamons";
import { DEF_MESSAGE_OPTS } from "../config";
import { showBooster } from "../actions/booster-show";

const tag = `[jito_tip_wiz]`;

const kbBack = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: `${c.icons.backArrow} Back`, callback_data: `go_back` },
      ],
    ],
  }
};

export const wizardSetJitoTip_name = "wizard-set-jito-tip";
export const wizardSetJitoTip = new Scenes.WizardScene(
  wizardSetJitoTip_name,
  sPrompt,
  sFinal,
);
wizardSetJitoTip.command('cancel', h.cancelWizardGeneric);
wizardSetJitoTip.action('go_back', goBack);
wizardSetJitoTip.command('back', goBack);



async function sPrompt(ctx: any) {
  h.answerCbQuerySafe(ctx);

  const boosterType: BoosterType = ctx.wizard.state.returnToBoosterType;
  if (!boosterType) {
    console.error(`${tag} no returnToBoosterType specified when setting jito tip`);
    await h.tryReply(ctx, `Error: no returnToBoosterType option specified.`);
    return ctx.scene.leave();
  }

  const settings = await userManager.getOrCreateSettingsFor(ctx.from.id);

  let tipFormatted = ``;
  const tipNumeric = parseInt(settings.jitoTip);
  if (isNaN(tipNumeric)) {
    tipFormatted = `<b>${settings.jitoTip}</b>`;
  } else if (tipNumeric == 0) {
    tipFormatted = `<b>normal</b>`;
  } else { // numeric, needs formatting
    tipFormatted = `<b>${(tipNumeric / solana.LAMPORTS_PER_SOL).toPrecision(3)}</b> SOL`
  }

  const text = `
${c.icons.gasBarrel} <b>Jito tip</b> (in SOL)

${c.icons.gasBarrel} Your tip preference: ${tipFormatted}
${(isNaN(tipNumeric) ? `(this will auto-adjust tips accordingly)` : ``)}
`;

  await h.tryEditOrReply(ctx, text, {
    reply_markup: {
      inline_keyboard: [
        ...getTipPresetButtons(),
        [
          { text: `${c.icons.lifebuoy} Help`, callback_data: 'help' },
          { text: `${c.icons.backArrow} Cancel`, callback_data: 'go_back' },
        ],
        [{ text: `(or send custom tip size below, in SOL)`, callback_data: '#' }],
      ],
    },
    ...DEF_MESSAGE_OPTS,
  });
  return ctx.wizard.next();
}



async function sFinal(ctx: any) {
  const textInput = ctx.message?.text || '';
  const cbData = ctx.callbackQuery?.data;
  const boosterType: BoosterType = ctx.wizard.state.returnToBoosterType;
  const settings = await userManager.getOrCreateSettingsFor(ctx.from.id);

  if (cbData && cbData == 'help') {
    await h.tryEditOrReply(ctx, helpText, {
      reply_markup: {
        inline_keyboard: [
          ...getTipPresetButtons(),
          [
            { text: `${c.icons.backArrow} Cancel`, callback_data: 'go_back' },
          ],
          [{ text: `(or send custom tip size below, in SOL)`, callback_data: '#' }],
        ],
      },
      ...DEF_MESSAGE_OPTS,
    });
    //ctx.wizard.back();
    return;
  }

  const customValue = parseFloat(textInput);
  if (textInput && isNaN(customValue)) {
    h.debug(`${tag} user ${ctx.from.id} supplied invalid jito tip: ${customValue}`);
    h.tryReply(ctx, `Invalid input: "${textInput}"; you need to specify a whole positive number, or use one of the provided buttons`);
    return;
  } else if (cbData && !["min", "low", "normal", "high"].includes(cbData)) {
    h.debug(`${tag} user ${ctx.from.id} supplied invalid jito tip callback data: ${cbData}`);
    h.tryReply(ctx, `Invalid input; please use one of the provided buttons or send me a custom value for the jito tip`);
    return;
  }

  let finalValueToRecord: string = '0';
  if (customValue) {
    if (customValue == 0) {
      // no remarks, just record it
    } else if (customValue < 0) {
      h.debug(`${tag} user ${settings.ownerTgID} tried setting invalid tip: ${customValue}; aborted, user informed`);
      h.tryReply(ctx, `The value you provided (${textInput}) is invalid. Try again or send me /back`, DEF_MESSAGE_OPTS);
      return;
    } else if (customValue < jitoTip_globals.chanceOf25_inSol) {
      h.debug(`${tag} user ${settings.ownerTgID} set their tip too low: ${customValue}`);
      h.tryReply(ctx, `The value you provided (${textInput}) is lower than the recommended minimum (${jitoTip_globals.chanceOf25_inSol}). Bot's performance may suffer and transactions may get dropped.`, DEF_MESSAGE_OPTS);
      await h.sleep(3000);
    } else if (customValue > jitoTip_globals.chanceOf95_inSol) {
      h.debug(`${tag} user ${settings.ownerTgID} set their tip too high: ${customValue}`);
      h.tryReply(ctx, `The value you provided (${textInput}) is higher than the recommended maximum (${jitoTip_globals.chanceOf95_inSol}). This can quickly drain bot's balance, as each transaction will cost you at least ${h.roundDown(customValue / 10 ** 9, 7)} SOL`, DEF_MESSAGE_OPTS);
      await h.sleep(3000);
    }
    finalValueToRecord = String(h.roundDown(customValue * solana.LAMPORTS_PER_SOL));
  } else {
    finalValueToRecord = cbData;
  }

  h.debug(`${tag} setting user ${settings.ownerTgID} jito tip to '${finalValueToRecord}'`);
  try {
    await prisma.settings.update({
      where: { internalID: settings.internalID },
      data: { jitoTip: finalValueToRecord }
    });
  } catch (e: any) {
    h.tryReply(ctx, `Failed to save jito tip due to internal error.`, kbBack);
    console.error(`${tag} failed to set jito tip for user ${settings.ownerTgID}`, e);
    console.trace(e);
  }

  goBack(ctx);
}


async function goBack(ctx: any) {
  const returnToBoosterType: BoosterType = ctx.wizard.state.returnToBoosterType;
  showBooster(ctx, returnToBoosterType);
  return ctx.scene.leave();
}



export async function getJitoTipSettingsButton(ctx: Context, boosterType: BoosterType) {
  const settings = await userManager.getOrCreateSettingsFor(ctx.from?.id);

  const tipNumeric = parseInt(settings.jitoTip);
  let tipValue = tipNumeric;
  if (!isNaN(tipNumeric) && tipNumeric == 0) {
    tipValue = getTipFromSetting("normal");
  } else if (isNaN(tipNumeric)) {
    tipValue = getTipFromSetting(settings.jitoTip as TipSetting);
  }

  tipValue = Number(h.roundDown(tipValue / solana.LAMPORTS_PER_SOL, 9).toPrecision(3));
  const tipFormatted = `${c.icons.gasBarrel} Jito tip: ${tipValue} SOL`;

  return {
    text: tipFormatted,
    callback_data: `data-jitoTip-${boosterType}`,
  }
}


function getTipPresetButtons() {
  return [
    [
      {
        text: `High | ${getTipFromSetting_forPrint("high")}`,
        callback_data: `high`,
      },
      {
        text: `Normal | ${getTipFromSetting_forPrint("normal")}`,
        callback_data: `normal`,
      },
    ],
    [
      {
        text: `Low | ${getTipFromSetting_forPrint("low")}`,
        callback_data: `low`,
      },
      {
        text: `Minimal | ${getTipFromSetting_forPrint("min")}`,
        callback_data: `min`,
      },
    ],
  ]
}


const helpText = `
Tips apply per transaction.

Higher tip = faster confirmation and greater success rate 

Default preset is <i>normal</i>, if success % is good, try lowering to <i>low</i> or <i>minimal</i>

<i>normal</i> is usually adequate, although during peak chain activity you may need to increase to <i>high</i>.

Please be advised that higher tips will reduce your volume generated per SOL and we do not recommend running on <i>high</i> for prolonged periods of time.

If you encounter issues or need further help - contact our team over at ${c.SOCIALS.telegram}
`