import { userManager } from "..";
import { DEF_MESSAGE_OPTS } from "../config";
import { tryReply } from "../helpers";


export async function showHelpMessage(ctx: any) {
  const user = await userManager.getOrCreateUser(ctx.from.id);

  let helpMessage = `
/start - set token address
/menu - main menu
/help - show this text
/id - show user ID
`;

  if (user.isBotAdmin)
    helpMessage += `
Admin commands:
/maintenance - toggle maintenance mode
/admin - add new admin
/unadmin - strip admin rights
/rent_add - adds rent to user
/rent_expire, /rent_void - nullifies user rent time. They can still rent the bot again, if they pay for it.
`;

  return await tryReply(ctx, helpMessage, {
    ...DEF_MESSAGE_OPTS
  });
}