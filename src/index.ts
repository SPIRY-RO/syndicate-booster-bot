import * as solana from "@solana/web3.js";
import { Telegraf, Scenes, session } from "telegraf";
import { PrismaClient } from "@prisma/client";
import bs58 from "bs58";
import { Agent } from 'https';

import { envConf } from "./config";
import { showHelpMessage } from "./commands/help";
import { answerCbQuerySafe, keypairFrom, pubkeyFrom } from "./helpers";
//import { PkToAddress, TestCalcAmounts, TestMisc, TestRankBoostWorkflow } from "./test";
import UserManager from "./classes/UserManager";
import { showBooster } from "./actions/booster-show";
import {
  referIfNeeded_thenShowStart, refreshWorkMenu, showWelcomeMessage as showWelcomeMessage,
  showWorkMenu,
} from "./commands/start";
import { showReferralMenu } from "./actions/referrals-menu";
import { rentBot, showRentOptions } from "./actions/rent-bot";
import { emptyAllPuppets, showWallet_normal, showWallet_withPrivKey, withdrawFunds } from "./actions/wallet";
import { wizardWalletSet, wizardWalletSet_name } from "./scenes/wallet-set";
import { createAndStartBooster } from "./actions/booster-start";
import {
  holderSettingsDecrease, holderSettingsIncrease, setChangeMakerFreqSettings, setDurationSettings, setRankParallelSettings, setSpeedSettings, setVolumeParallelSettings, showChangeMakerFreqSettings, showDurationSettings,
  showRankParallelSettings,
  showSpeedSettings,
  showVolumeParallelSettings,
} from "./actions/settings";
import { wizardSetAddr, wizardSetAddr_name } from "./scenes/set-active-address";
import { registerCommands } from "./commands/register_commands";
import { stopBooster } from "./actions/booster-stop";
import { runJitoTipAccsUpdater, runJitoTipMetricUpdater } from "./utils/jito-tip-deamons";
import JitoStatusChecker from "./classes/JitoStatusChecker";
import { initSolanaPriceFeedDaemon } from "./utils/price-feeds";
import { admin_addAdmin, admin_rentAdd, admin_rentNullify, admin_stripAdmin, admin_toggleMaintenance } from "./commands/admin";
import { wizardSetJitoTip, wizardSetJitoTip_name } from "./scenes/set-jito-tip";
import { testFullTransfer } from "./test";
import { showTelegramIDs } from "./commands/id";
import { stressTestJupiter } from "./tests/node_stress_test";


export const prisma = new PrismaClient();
export const telegraf = new Telegraf(envConf.TG_BOT_TOKEN);
const solanaHttpAgent = new Agent({ keepAlive: true, maxSockets: 20 });
export const web3Connection = new solana.Connection(envConf.HTTP_RPC_URL, { commitment: "confirmed", httpAgent: solanaHttpAgent });
export const userManager = new UserManager();
export const statusChecker = new JitoStatusChecker();

console.log(`\nBooster bot starting up`);

//TestMisc();
//TestCalcAmounts();
//jupiterJitoTest();
//TestRankBoostWorkflow();
//PkToAddress();

//console.log(bs58.encode(solana.Keypair.generate().secretKey));


const stage = new Scenes.Stage([
  wizardWalletSet,
  wizardSetAddr,
  wizardSetJitoTip,
]);

telegraf.use(session());
telegraf.use(stage.middleware()); // in case you'll add scenes

/* Good place for calling & testing functions you want to test in isolation */

// has to be before telegraf.start()
telegraf.hears(/^\/start[ =](.+)$/, (ctx) => referIfNeeded_thenShowStart(ctx, ctx.match[1]));

telegraf.start(showWelcomeMessage);
telegraf.help(showHelpMessage);
telegraf.command("menu", showWorkMenu);
telegraf.command("id", showTelegramIDs);
//telegraf.command(["stop_boost", "stop_booster"], stopBooster);

/* Admin commands */
//telegraf.command("stop_all", stopAllBoosters_admin);
telegraf.command("register_commands", registerCommands);
telegraf.command("maintenance", admin_toggleMaintenance);
telegraf.command("admin", admin_addAdmin);
telegraf.command(["unadmin", "demote_admin", "strip_admin"], admin_stripAdmin);
telegraf.command("rent_add", admin_rentAdd);
telegraf.command(["rent_expire", "rent_cut", "rent_nullify", "rent_annul", "rent_void"], admin_rentNullify);

telegraf.action("welcome_message", showWelcomeMessage);
telegraf.action("work_menu", showWorkMenu);
telegraf.action("work_menu_refresh", refreshWorkMenu);
telegraf.action("referrals", showReferralMenu);
telegraf.action("show_rent", showRentOptions);
telegraf.action("wallet", showWallet_normal);
telegraf.action("wallet_pk", showWallet_withPrivKey);
telegraf.action("withdraw", withdrawFunds);
telegraf.action("empty_puppets", emptyAllPuppets);


telegraf.action("settings_speed", showSpeedSettings);
telegraf.action("settings_duration", showDurationSettings);
telegraf.action("settings_volume_parallel", showVolumeParallelSettings);
telegraf.action("settings_holders_inc", holderSettingsIncrease);
telegraf.action("settings_holders_dec", holderSettingsDecrease);
telegraf.action("settings_rank_parallel", showRankParallelSettings);
telegraf.action("settings_rank_frequency", showChangeMakerFreqSettings);

/* Wizards */

telegraf.action("token_address_wizard", async (ctx: any) => {
  ctx.scene.enter(wizardSetAddr_name, {});
});
telegraf.action("withdrawal_wallet", async (ctx: any) => {
  ctx.scene.enter(wizardWalletSet_name, {});
});

telegraf.action(/\bdata(-\w+)+\b/g, (ctx: any) => {
  const string = ctx.match[0];
  const args = string.split("-");
  const actionName = args[1];
  if (actionName === "setEntry") {
    const senderId = args[2];
    //setTimezoneCommand_forcedSender(ctx, senderId);
  } else if (actionName === "boosterShow") {
    const boosterType = args[2];
    const boosterID = args[3];
    showBooster(ctx, boosterType, boosterID);
  } else if (actionName === "boosterRefresh") {
    const boosterType = args[2];
    const boosterID = args[3];
    const refreshOnly = true;
    showBooster(ctx, boosterType, boosterID, refreshOnly);
  } else if (actionName === "boosterStart") {
    const boosterType = args[2];
    return createAndStartBooster(ctx, boosterType);
  } else if (actionName === "boosterStop") {
    const boosterType = args[2];
    const boosterID = args[3];
    return stopBooster(ctx, boosterType, boosterID);
  } else if (actionName === "settings") {
    const setting = args[2];
    const settingValue = args[3];
    if (setting == "speed") {
      setSpeedSettings(ctx, settingValue);
    } else if (setting == "duration") {
      setDurationSettings(ctx, settingValue);
    } else if (setting == "parallelVolume") {
      setVolumeParallelSettings(ctx, settingValue);
    } else if (setting == "parallelRank") {
      setRankParallelSettings(ctx, settingValue);
    } else if (setting == "makers") {
      setChangeMakerFreqSettings(ctx, settingValue);
    } else {
      return answerCbQuerySafe(ctx, `Unknown type of setting: ${setting}! 👎`);
    }
  } else if (actionName === "jitoTip") {
    const boosterType = args[2];
    ctx.scene.enter(wizardSetJitoTip_name, {
      returnToBoosterType: boosterType,
    });
  } else if (actionName === "rent") {
    const duration = args[2];
    rentBot(ctx, duration);
    /*ctx.scene.enter(wizardSetTzLocation_name, {
      senderId: senderId,
    });*/
  } else {
    return answerCbQuerySafe(ctx, `Unknown action: ${actionName}! 👎`);
  }

  //console.log(`Action name: ${actionName}`);
  return answerCbQuerySafe(ctx);
});

process.once("SIGINT", () => telegraf.stop("SIGINT"));
process.once("SIGTERM", () => telegraf.stop("SIGTERM"));

telegraf.launch();

runJitoTipMetricUpdater();
//runJitoTipAccsUpdater(); // no need to run this anymore
initSolanaPriceFeedDaemon();
statusChecker.run();


//adjustDatabaseValues();
async function adjustDatabaseValues() {
  const desiredParallelRankWallets = 15;

  await prisma.settings.updateMany({
    data: {
      rankParallelWallets: desiredParallelRankWallets,
    }
  });
  console.log(`Database values adjusted as requested`);
}

//showAllPubkeys();
async function showAllPubkeys() {
  const allEntries = await prisma.user.findMany();
  for (const entry of allEntries) {
    const kp = keypairFrom(entry.workWalletPrivKey);
    console.log(`${kp.publicKey.toBase58()}; tgID ${entry.tgID}`);
  }
}

//testFullTransfer();
//stressTestJupiter();