import fs from "fs";

import { prisma, userManager } from "..";


const refExportFile = './referrals_export.json';

export async function exportReferralData() {
  console.log(`Dumping entries of all referred users into "${refExportFile}"`);
  const referralData: ReferralExport[] = [];

  const users = await prisma.user.findMany();
  for (const user of users) {
    if (user.referredByTgID) {
      referralData.push({
        tgID: user.tgID,
        referredByTgID: user.referredByTgID,
      });
    }
  }
  fs.writeFileSync(refExportFile, JSON.stringify(referralData));
  console.log(`Dump of referral entries complete. It's safe to stop this program now`);
}


export async function importReferralData() {
  console.log(`Importing entries of all referred users from: "${refExportFile}"`);
  const referralDataString = fs.readFileSync(refExportFile, {encoding: 'utf8'});
  if (!referralDataString)
    throw new Error(`Referral data file is empty`);

  const referralData: ReferralExport[] = JSON.parse(referralDataString);
  for (const refDat of referralData) {
    const user = await userManager.getOrCreateUser(refDat.tgID);
    userManager.getOrCreateUser(refDat.referredByTgID);
    await prisma.user.update({
      where: {internalID: user.internalID},
      data: {referredByTgID: refDat.referredByTgID},
    });
  }
  console.log(`Referral entries imported. It's safe to stop this program now`);
}


interface ReferralExport {
  tgID: string,
  referredByTgID: string,
}