import * as solana from "@solana/web3.js";
import axios from "axios";
import { envConf } from "../config";

//import * as c from "../const";
import * as h from "../helpers";


const ESTIMATES_PER_SECOND = 60;
const SLIPPAGE_PERC = 3;

const TOKEN_ADDRS = [
  'So11111111111111111111111111111111111111112', // WSOL
  'BLXw8gGrwHeDMjEit5TN6VF9UqmYcesFhYejekSoX81d', // SOLP
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  '5BKw97mLkc3HyZY88ZjigiXbaqiGFzDbHHQCdCGpump',
  '8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn',
]

function getRandomTokens() {
  const indexA = h.getRandomNumber(1, TOKEN_ADDRS.length, 1) - 1;
  let indexB = h.getRandomNumber(1, TOKEN_ADDRS.length, 1) - 1;
  while (indexA === indexB) { // make sure the tokens are different
    indexB = h.getRandomNumber(1, TOKEN_ADDRS.length, 1) - 1;
  }
  return { addrA: TOKEN_ADDRS[indexA], addrB: TOKEN_ADDRS[indexB] };
}


async function makeRandomEstimate(): Promise<number> {
  const tokenAmountIn_inLamps = h.getRandomNumber(10000, 10 * solana.LAMPORTS_PER_SOL);
  const { addrA, addrB } = getRandomTokens();

  try {
    const response = await axios({
      method: "GET",
      url: `${envConf.JUPITER_API_URL}/quote`,
      params: {
        inputMint: addrA,
        outputMint: addrB,
        amount: tokenAmountIn_inLamps,
        slippageBps: SLIPPAGE_PERC * 100,
      },
    });
    if (response.status !== 200) {
      h.debug(`[${h.getShortAddr(addrA)}->${h.getShortAddr(addrB)}] got quote response with status != 200`);
      h.debug(response);
      return 0;
    }

    //h.debug(response.data);
    const { inAmount, outAmount, otherAmountThreshold, priceImpactPct, timeTaken } = response.data;
    //console.log(timeTaken);
    return timeTaken;

  } catch (e: any) {
    console.error(`[${h.getShortAddr(addrA)}->${h.getShortAddr(addrB)}] error when fetching quote: ${e}`);
    if (e.response) {
      // The request was made and the server responded with a non-2xx status code
      console.error(e.response.data);
      console.error(e.response.status);
      console.error(e.response.headers);
    } else {
      console.trace(e);
    }
    return 0;
  }
}


export async function stressTestJupiter() {
  console.info(`Running stress tests...`);
  console.log();
  let timeTakenAvg = await makeRandomEstimate() || 0.1;
  let totalTxs = 1;
  const intervalMain = setInterval(async () => {
    const results_p: Promise<number>[] = [];
    for (let i = 0; i <= ESTIMATES_PER_SECOND; i++) {
      results_p.push(makeRandomEstimate());
    }

    const results = await Promise.all(results_p);
    let statusString = '';
    for (const timeTaken of results) {
      totalTxs++;
      if (timeTaken) {
        timeTakenAvg = (timeTakenAvg + timeTaken) / 2;
        statusString += '.';
      } else {
        statusString += '#';
      }
    }
    process.stdout.write(statusString);
  }, 1000);

  const timeTakenReporter = setInterval(() => report(timeTakenAvg, totalTxs), 2000);
}


function report(timeTaken: number, totalTxs: number) {
  console.info(`\nn of estimates: ${totalTxs} | avg time per estimate: ${timeTaken}`);
}
