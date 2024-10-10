import axios from "axios";

interface TokenInfo {
  tokenName: string;
  tokenSymbol: string;
}

export async function getDexscreenerTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const response = await axios.get(url);

    const data = response.data;

    // Check if pairs array is empty
    if (!data.pairs || data.pairs.length === 0) {
      console.log("Invalid response: No pairs found");
      return null;
    }

    // Extract the first pair
    const firstPair = data.pairs[0];

    // Constants for WSOL address
    const WSOL_ADDRESS = "So11111111111111111111111111111111111111112";

    // Determine which token is WSOL and get the other token
    let actualToken;
    if (firstPair.baseToken.address === WSOL_ADDRESS) {
      actualToken = firstPair.quoteToken;
    } else if (firstPair.quoteToken.address === WSOL_ADDRESS) {
      actualToken = firstPair.baseToken;
    } else {
      console.log("Invalid pair: No WSOL found");
      return null;
    }

    // Return token name and symbol
    return {
      tokenName: actualToken.name,
      tokenSymbol: actualToken.symbol,
    };
  } catch (error) {
    console.error("Error fetching token data:", error);
    return null;
  }
}
