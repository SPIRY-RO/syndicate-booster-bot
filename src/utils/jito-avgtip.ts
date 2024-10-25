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
  ema_landed_tips_25th_percentile: number;
};

async function getAverageJitoTip(): Promise<number> {
  try {
    const response = await axios.get<TipFloorResponse[]>("http://bundles-api-rest.jito.wtf/api/v1/bundles/tip_floor");

    const data = response.data;

    if (Array.isArray(data) && data.length > 0) {
      const tipData = data[0];
      const averageTip = (tipData.landed_tips_75th_percentile - tipData.ema_landed_tips_50th_percentile) / 0.5;

      console.log(`[jito::average_tip] Calculated average tip: ${averageTip} SOL`);

      return averageTip;
    } else {
      console.error(`[jito::average_tip] Unexpected response data: ${JSON.stringify(data)}`);
      return averageJitoTip;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[jito::average_tip] Axios error: ${error.message}`);
      if (error.response) {
        console.error(`[jito::average_tip] Response data: ${JSON.stringify(error.response.data)}`);
        console.error(`[jito::average_tip] Response status: ${error.response.status}`);
        console.error(`[jito::average_tip] Response headers: ${JSON.stringify(error.response.headers)}`);
      }
    } else {
      console.error(`[jito::average_tip] Error: ${error}`);
    }
    return averageJitoTip;
  }
}

export async function initJitoAverageTipLoop() {
  while (true) {
    const newAverageTip = await getAverageJitoTip();
    if (newAverageTip !== averageJitoTip) {
      averageJitoTip = newAverageTip;
    }
    await sleep(1000 * 10 * 1); // Sleep for 10 seconds.
  }
}
