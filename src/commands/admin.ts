import { Context } from 'telegraf';

import * as c from '../const';
import * as h from '../helpers';
import { DEF_MESSAGE_OPTS, envConf } from "../config";
import { prisma, userManager } from '..';


let isMaintenanceMode: boolean = false;

export function isUnderMaintenance() {
  return isMaintenanceMode;
}

export async function notifyAboutMaintenance(ctx: Context) {
  await h.tryEditOrReply(ctx, `Bot is down for maintenance. It will be back online soon. Reach out to us in ${c.SOCIALS.telegram} if you have any questions`);
  return;
}


export async function admin_toggleMaintenance(ctx: any) {
  const user = await userManager.getOrCreateUser(ctx.from.id);
  if (!user.isBotAdmin) {
    h.debug(`[maintenance] non-admin tried to change maintenance status; userID: ${user.tgID}`);
    h.tryReply(ctx, `Not authorized.`);
    return;
  }

  isMaintenanceMode = !isMaintenanceMode;
  let text = `${c.icons.green} Bot is back online now.`
  if (isMaintenanceMode)
    text = `${c.icons.red} Bot taken down for maintenance. Normal users will not be able to interact with it now.`
  const adminChatNotification = text + `\nCalled by: ${await h.getUserProfileLinkFrom(user.tgID)}`;

  h.trySend(envConf.TEAM_NOTIFICATIONS_CHAT, adminChatNotification, DEF_MESSAGE_OPTS);
  return await h.tryReply(ctx, text, {
    ...DEF_MESSAGE_OPTS
  });
}


export async function admin_addAdmin(ctx: any) {
  const tag = '[admin_manager]';
  const callingUser = await userManager.getOrCreateUser(ctx.from.id);
  if (!callingUser.isBotAdmin) {
    h.debug(`${tag} non-admin tried to add another admin; sender ID: ${callingUser.tgID}`);
    h.tryReply(ctx, `Not authorized.`);
    return;
  }

  const args = h.unwrapCommandArguments(ctx, [
    {
      value: "newAdminID",
      placeholder: "309378400",
    },
  ]);
  if (!args)
    // no need to notify user here; unwrapper will do it for us
    return;

  const { newAdminID } = args;
  if (!newAdminID) {
    return;
  } else if (isNaN(parseInt(newAdminID))) {
    console.warn(`${tag} invalid user ID specified: ${newAdminID}`);
    h.tryReply(ctx, `Invalid user ID specified. Must be a numeric value.`);
    return;
  }

  try {
    const newAdmin = await userManager.makeBotAdmin_createIfNotFound(parseInt(newAdminID));
    const text = `Made sure that Telegram user with ID <code>${newAdmin.tgID}</code> has admin privileges. This command always succeeds, even if the ID you specified is not known to the bot.
Link to profile of user who just got promoted to admin: ${await h.getUserProfileLinkFrom(newAdmin.tgID)}
(if there's no link, then user never did /start in the bot or you got the wrong ID)`;
    const adminChatNotification = `Admin rights modified; ran by: ${await h.getUserProfileLinkFrom(callingUser.tgID)}. Summary:\n` + text;

    h.trySend(envConf.TEAM_NOTIFICATIONS_CHAT, adminChatNotification, DEF_MESSAGE_OPTS);
    return await h.tryReply(ctx, text, {
      ...DEF_MESSAGE_OPTS
    });

  } catch (e: any) {
    console.error(`${tag} error when working with DB for user entry ${newAdminID}: ${e}`)
    console.trace(e);
    h.tryReply(ctx, `Failed to give admin rights to user due to internal error
Details for devs: ${JSON.stringify(e)}`);
    return;
  }

}


export async function admin_stripAdmin(ctx: any) {
  const tag = '[admin_manager]';
  const callingUser = await userManager.getOrCreateUser(ctx.from.id);
  if (!callingUser.isBotAdmin) {
    h.debug(`${tag} non-admin tried to remove admin rights from another user; sender ID: ${callingUser.tgID}`);
    h.tryReply(ctx, `Not authorized.`);
    return;
  }

  const args = h.unwrapCommandArguments(ctx, [
    {
      value: "existingAdminID",
      placeholder: "309378400",
    },
  ]);
  if (!args)
    // no need to notify user here; unwrapper will do it for us
    return;
  const { existingAdminID } = args;
  if (!existingAdminID) {
    return;
  } else if (isNaN(parseInt(existingAdminID))) {
    console.warn(`${tag} invalid user ID specified: ${existingAdminID}`);
    h.tryReply(ctx, `Invalid user ID specified. Must be a numeric value.`);
    return;
  }

  const existingAdmin = await userManager.getUser(existingAdminID);
  if (!existingAdmin) {
    h.tryReply(ctx, `The user ID you provided is not known to the bot (user never interacted with the bot)`);
    return;
  } else if (existingAdmin && !existingAdmin.isBotAdmin) {
    h.tryReply(ctx, `This user is not an admin already.`);
    return;
  }

  try {
    await userManager.stripBotAdmin(existingAdminID);
    const text = `Stripped admin rights from user ${await h.getUserProfileLinkFrom(existingAdminID)}`;
    const adminChatNotification = `Admin rights modified; ran by: ${await h.getUserProfileLinkFrom(callingUser.tgID)}. Summary:\n` + text;
    h.trySend(envConf.TEAM_NOTIFICATIONS_CHAT, adminChatNotification, DEF_MESSAGE_OPTS);
    return await h.tryReply(ctx, text, {
      ...DEF_MESSAGE_OPTS
    });

  } catch (e: any) {
    console.error(`${tag} error when working with DB for user entry ${existingAdminID}: ${e}`)
    console.trace(e);
    h.tryReply(ctx, `Failed to strip admin rights from user due to internal error
Details for devs: ${JSON.stringify(e)}`);
    return;
  }
}


/* Rent */

export async function admin_rentAdd(ctx: any) {
  const tag = '[admin_rent]';
  const adminUser = await userManager.getOrCreateUser(ctx.from.id);
  if (!adminUser.isBotAdmin) {
    h.debug(`${tag} non-admin tried to add rent; sender ID: ${adminUser.tgID}`);
    h.tryReply(ctx, `Not authorized.`);
    return;
  }

  const args = h.unwrapCommandArguments(ctx, [
    {
      value: "timingNotation",
      placeholder: "2h30m",
    },
    {
      value: "targetUserID",
      placeholder: "309378400",
    },
  ]);
  if (!args)
    return;
  const { timingNotation, targetUserID } = args;
  if (!targetUserID || !timingNotation) {
    // no need to notify user here; unwrapper will do it for us
    return;
  } else if (isNaN(parseInt(targetUserID))) {
    console.warn(`${tag} invalid user ID specified: ${targetUserID}`);
    h.tryReply(ctx, `Invalid user ID specified. Must be a numeric value.`);
    return;
  } else if (!h.timingNotationToSeconds(timingNotation)) {
    console.warn(`${tag} invalid timing notation specified: ${timingNotation}`);
    h.tryReply(ctx, `Invalid timing notation supplied. Some examples of valid notations:
30m - 30 minutes
1h30m - 1 hour 30 minutes
1d - 1 day
`);
    return;
  }

  try {
    let targetUser = await userManager.getOrCreateUser(parseInt(targetUserID));
    const rentToAddSecs = Number(h.timingNotationToSeconds(timingNotation));

    let newExpiryTs: number;
    if (targetUser.rentExpiresAt > Date.now()) {
      const msToAdd = rentToAddSecs * 1000;
      newExpiryTs = h.roundDown(targetUser.rentExpiresAt + msToAdd);
    } else {
      const msTillExpiration = rentToAddSecs * 1000;
      newExpiryTs = h.roundDown(Date.now() + msTillExpiration);
    }

    targetUser = await prisma.user.update({
      where: { internalID: targetUser.internalID },
      data: { rentExpiresAt: newExpiryTs },
    });

    const text = `Command successful. Rent for user <code>${targetUser.tgID}</code>(aka ${await h.getUserProfileLinkFrom(targetUser.tgID)}) updated.
Time left until expiry: ${h.secondsToTimingNotation(h.roundDown((targetUser.rentExpiresAt - Date.now()) / 1000, 0))}`;
    const adminChatNotification = `Rent extended by admin: ${await h.getUserProfileLinkFrom(adminUser.tgID)}. Summary:\n` + text;

    h.trySend(envConf.TEAM_NOTIFICATIONS_CHAT, adminChatNotification, DEF_MESSAGE_OPTS);
    return await h.tryReply(ctx, text, {
      ...DEF_MESSAGE_OPTS
    });

  } catch (e: any) {
    console.error(`${tag} error when working with DB for user entry ${targetUserID}: ${e}`)
    console.trace(e);
    h.tryReply(ctx, `Failed to extend rent for user ${targetUserID}
Details for devs: ${JSON.stringify(e)}`);
    return;
  }
}


export async function admin_rentNullify(ctx: any) {
  const tag = '[admin_rent]';
  const adminUser = await userManager.getOrCreateUser(ctx.from.id);
  if (!adminUser.isBotAdmin) {
    h.debug(`${tag} non-admin tried to add rent; sender ID: ${adminUser.tgID}`);
    h.tryReply(ctx, `Not authorized.`);
    return;
  }

  const args = h.unwrapCommandArguments(ctx, [
    {
      value: "targetUserID",
      placeholder: "309378400",
    },
  ]);
  if (!args)
    // no need to notify user here; unwrapper will do it for us
    return;
  const { targetUserID } = args;
  if (!targetUserID) {
    return;
  } else if (isNaN(parseInt(targetUserID))) {
    console.warn(`${tag} invalid user ID specified: ${targetUserID}`);
    h.tryReply(ctx, `Invalid user ID specified. Must be a numeric value.`);
    return;
  }

  try {
    let targetUser = await userManager.getOrCreateUser(parseInt(targetUserID));
    if (!targetUser.rentExpiresAt || targetUser.rentExpiresAt < Date.now()) {
      h.tryReply(ctx, `User's rent is already expired or they never rented the bot before.`);
      return;
    }

    targetUser = await prisma.user.update({
      where: { internalID: targetUser.internalID },
      data: { rentExpiresAt: Date.now() },
    });

    const text = `Command successful. Rent for user <code>${targetUser.tgID}</code>(aka ${await h.getUserProfileLinkFrom(targetUser.tgID)}) forcibly expired.
They will no longer be able to run any boosters, until their rent is extended (by them buying more time, or by an admin command).`;
    const adminChatNotification = `Rent nullified by admin: ${await h.getUserProfileLinkFrom(adminUser.tgID)}. Summary:\n` + text;

    h.trySend(envConf.TEAM_NOTIFICATIONS_CHAT, adminChatNotification, DEF_MESSAGE_OPTS);
    return await h.tryReply(ctx, text, {
      ...DEF_MESSAGE_OPTS
    });

  } catch (e: any) {
    console.error(`${tag} error when working with DB for user entry ${targetUserID}: ${e}`)
    console.trace(e);
    h.tryReply(ctx, `Failed to expire rent for user ${targetUserID}
Details for devs: ${JSON.stringify(e)}`);
    return;
  }

}
