import { Context } from 'telegraf';

import * as c from '../const';
import * as h from '../helpers';
import { DEF_MESSAGE_OPTS } from '../config';


export async function showTelegramIDs(ctx: any) {
  const chatID = ctx.chat?.id;
  const senderID = ctx.from?.id;
  const replyToMessage = ctx.update?.message?.reply_to_message;

  let text = "";
  if (replyToMessage && !replyToMessage.from.is_bot) {
    const repliedToName = `${replyToMessage.from.first_name}${replyToMessage.from.last_name ? replyToMessage.from.last_name + " " : ""
      }`;
    text = `${h.escapeHTML(repliedToName)}'s ID: <code>${replyToMessage.from.id}</code>\n`;
  } else {
    text = `Your ID: <code>${senderID}</code>\n`;
  }
  if (chatID !== senderID) {
    text += `This group's ID: <code>${chatID}</code>`;
  }

  return await h.tryReply(ctx, text, {
    ...DEF_MESSAGE_OPTS
  });
}
