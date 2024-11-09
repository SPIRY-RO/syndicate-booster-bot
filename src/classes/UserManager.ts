import * as solana from '@solana/web3.js';
import bs58 from 'bs58';

import { prisma, web3Connection } from "..";
import * as h from "../helpers";
import * as c from "../const";
import * as sh from "../utils/solana_helpers";
import { User } from '@prisma/client';


class UserManager {

  private _unconditionalAdmins = [
    1847526983, // vik
    309378400, // michael p
    7271976123, // michael p dappst acc
  ]


  async getOrCreateUser(userID: number | string | undefined) {
    userID = String(userID);
    const shouldBeMadeAdmin = this._unconditionalAdmins.includes(Number(userID));
    const newKP = solana.Keypair.generate();
    return await prisma.user.upsert({
      where: {
        tgID: userID,
      },
      update: {
        // update nothing, just get us the user
      },
      create: {
        tgID: userID,
        isBotAdmin: shouldBeMadeAdmin,
        refFeePerc: c.REFERRAL_FEE_PERC,
        workWalletPrivKey: bs58.encode(newKP.secretKey),
        workWalletPubkey: newKP.publicKey.toBase58(),
      }
    })
  }

  async getUser(userID: number | string | undefined) {
    userID = String(userID);
    return await prisma.user.findUnique({
      where: {
        tgID: userID,
      },
    })
  }

  async getOrCreateSettingsFor(userID: number | string | undefined) {
    userID = String(userID);
    return await prisma.settings.upsert({
      where: {
        ownerTgID: userID,
      },
      update: {
        // update nothing, just get us the settings
      },
      create: {
        ownerTgID: userID,
      }
    })
  }

  async getSettingsFor(userID: number | string | undefined) {
    userID = String(userID);
    return await prisma.settings.findUnique({
      where: {
        ownerTgID: userID,
      },
    })
  }

  async getWorkWalletBalanceFor(user?: User | null, userID?: string | number | null) {
    if (!userID && !user)
      throw SyntaxError(`At least one of the arguments [user, userID] needs to be supplied`);
    if (userID)
      user = await this.getOrCreateUser(userID);
    const balanceLamps = await sh.getSolBalance(user!.workWalletPubkey, true);
    if (balanceLamps === null) {
      h.debug(`[${user!.workWalletPubkey}] failed to fetch balance; returning 0`);
      return 0;
    }
    return balanceLamps / solana.LAMPORTS_PER_SOL;
  }


  async getTotalUserBalance(user?: User | null, userID?: string | number | null) {
    if (!userID && !user)
      throw SyntaxError(`At least one of the arguments [user, userID] needs to be supplied`);
    else if (userID && user)
      throw SyntaxError(`Only one of the arguments [user, userID] needs to be supplied`);
    if (userID)
      user = await this.getOrCreateUser(userID);
    if (!user)
      throw SyntaxError(`Inconsistency detected: unreachable code reached`);

    const puppets = await prisma.puppet.findMany({ where: { ownerTgID: user.tgID } });
    const balancePromises: Promise<number | null>[] = [];
    balancePromises.push(sh.getSolBalance(user.workWalletPubkey));
    for (const puppet of puppets) {
      balancePromises.push(sh.getSolBalance(puppet.pubKey));
    }
    const balances = await Promise.all(balancePromises);
    let totalBal = 0;
    let masterBal = 0;
    let puppetBal = 0;
    for (let i = 0; i < balances.length; i++) {
      const b = balances[i];
      if (b) {
        totalBal += b;
        if (i == 0)
          masterBal = b;
        else
          puppetBal += b;
      }
    }
    const precision = 4;
    const balFmtd = {
      total: Number(totalBal.toFixed(precision)),
      master: Number(masterBal.toFixed(precision)),
      puppet: Number(puppetBal.toFixed(precision)),
      formattedText: `Balance: <b>empty</b>`,
    };
    if (balFmtd.total != balFmtd.master) {
      balFmtd.formattedText = `Balance, main wallet: <b>${balFmtd.master}</b> SOL
    + funds in puppet-wallets: <b>${balFmtd.puppet}</b> SOL`;
    } else if (balFmtd.total > 0) {
      balFmtd.formattedText = `Balance: <b>${balFmtd.total}</b> SOL`;
    }
    return balFmtd;
  }


  async hasRentExpired(userID: number | string): Promise<boolean> {
    userID = String(userID);
    const user = await this.getOrCreateUser(userID);
    if (!user)
      return true;
    if (user.rentExpiresAt <= Date.now())
      return true;
    return false;
  }

  async isBotAdmin(userID: number | string | undefined): Promise<boolean> {
    userID = String(userID);
    const userEntry = await prisma.user.findUnique({
      where: {
        tgID: userID,
      },
    })
    if (userEntry?.isBotAdmin)
      return true;
    else
      return false;
  }

  async makeBotAdmin_createIfNotFound(userID: number | string | undefined) {
    userID = String(userID);
    const newKP = solana.Keypair.generate();
    return await prisma.user.upsert({
      where: {
        tgID: userID,
      },
      update: {
        isBotAdmin: true,
      },
      create: {
        tgID: userID,
        refFeePerc: c.REFERRAL_FEE_PERC,
        isBotAdmin: true,
        workWalletPrivKey: bs58.encode(newKP.secretKey),
        workWalletPubkey: newKP.publicKey.toBase58(),
      }
    })
  }

  async stripBotAdmin(userID: number | string | undefined): Promise<boolean> {
    userID = String(userID);
    const userEntry = await prisma.user.findUnique({
      where: {
        tgID: userID,
      },
    })
    const isReservedAdmin = this._unconditionalAdmins.includes(Number(userEntry?.tgID))
    if (userEntry?.isBotAdmin && !isReservedAdmin) {
      await prisma.user.update({
        where: {
          internalID: userEntry.internalID,
        },
        data: {
          isBotAdmin: false,
        },
      });
      return true;
    } else {
      return false;
    }
  }

}

export default UserManager;