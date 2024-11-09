import * as solana from '@solana/web3.js';
import bs58 from 'bs58';
import { Puppet, Settings } from '@prisma/client';

import * as c from '../../const';
import * as h from '../../helpers';
import * as sh from '../../utils/solana_helpers';
import { prisma } from '../..';
import PuppetVolume from './puppets/volume';
import BoosterBase, { BoosterType } from './base';
import { DEF_MESSAGE_OPTS } from '../../config';
import PuppetBase from './puppets/base';



class BoosterSalvager extends BoosterBase {
  type: BoosterType = 'salvager';


  async start(): Promise<void> {
    h.debug(`${this.tag} # starting up #`);
    this.startedAt = Date.now();
    const balance = await sh.getSolBalance(this.keypair.publicKey);
    if (balance === null) { 
      console.error(`${this.tag} failed to fetch own balance when starting booster(${balance}); aborting`);
      await h.trySend(this.ownerTgID, `Failed to get wallet balance from the blockchain; likely due to a network error; please try again later`);
      this._cleanup();
      return;
    }
    this.lastBalance = balance;
    const tokenAcc = await sh.getTokenAcc(this.tokenAddr, this.keypair.publicKey)
    if (!tokenAcc?.pubkey) {
      if (!await sh.ensureTokenAccountExists(this.keypair, this.tokenAddr, this.settings.jitoTip)) {
        h.debug(`${this.tag} couldn't ensure that token account is open`);
      } else {
        h.debug(`${this.tag} opened token account that previously didn't exist`);
      }
    } else {
      h.debug(`${this.tag} token acc already exists`);
    }

    const userPuppets = await prisma.puppet.findMany({
      where: { ownerTgID: this.ownerTgID }
    })
    const inactivePuppetDbEntries: Puppet[] = [];
    for (const puppet of userPuppets) {
      if (!PuppetBase.isPuppetActive(puppet.pubKey))
        inactivePuppetDbEntries.push(puppet);
    }
    if (inactivePuppetDbEntries.length === 0) {
      h.debug(`${this.tag} no puppets to salvage; terminating booster`);
      await h.trySend(this.ownerTgID, `You have no inactive puppets, so there is nothing to do.`, DEF_MESSAGE_OPTS);
      this._cleanup();
      return;
    }

    const balanceBeforeEmptying = this.lastBalance;
    const inactivePuppetsEmptiedOK = await this.tryEmptyInactivePuppets();
    this.lastBalance = await sh.getSolBalance(this.keypair.publicKey) || this.lastBalance;
    let message = `Failed to empty puppets; you could try again later`;
    if (inactivePuppetsEmptiedOK) {
      message = `Emptied puppet-wallets successfully or they were already empty!
Balance before: ${balanceBeforeEmptying} SOL; balance after: ${this.lastBalance} SOL`;
    } else if (balanceBeforeEmptying != this.lastBalance) {
      message = `Tried emptying puppet-wallets, but not all of them were emptied successfully.
Balance before: ${balanceBeforeEmptying} SOL; balance after: ${this.lastBalance} SOL`;
    }

    h.debug(`${this.tag} final result: ${message}`);
    await h.trySend(this.ownerTgID, message, DEF_MESSAGE_OPTS);
    this.wasAskedToStop = true;
    await this._cleanup();
    return;
  }


}


export default BoosterSalvager;