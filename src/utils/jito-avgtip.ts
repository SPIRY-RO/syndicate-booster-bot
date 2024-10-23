import axios from "axios";
import { sleep } from "../helpers";

export let averageJitoTip = 0;

type TipFloorResponse = {
  time: string;
  landed_tips_25th_percentile: number;
  landed_tips_50th_percentile: number;
  landed_tips_75th_percentile: number;
  landed_tips_95th_percentile: number;
  landed_tips_99th_percentile: number;
  ema_landed_tips_50th_percentile: number;
};

async function getAverageJitoTip() {
  try {
    const response = await axios.get<TipFloorResponse[]>("http://bundles-api-rest.jito.wtf/api/v1/bundles/tip_floor");

    const data = response.data;

    if (Array.isArray(data) && data.length > 0) {
      const averageTip = data[0].landed_tips_75th_percentile;

      console.log(`[jito::average_tip] Average tip: ${averageTip} SOL`);

      return averageTip;
    } else {
      console.error(`[jito::average_tip] Unexpected response data: ${JSON.stringify(data)}`);
      return averageJitoTip;
    }
  } catch (error) {
    console.error(`[jito::average_tip] Error: ${error}`);
    return averageJitoTip;
  }
}

export async function initJitoAverageTipLoop() {
  while (true) {
    averageJitoTip = await getAverageJitoTip();
    await sleep(1000 * 60 * 1);
  }
}
