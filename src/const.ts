import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { envConf } from "./config";

//export const CHANGE_WALLET_EVERY_N_BUYS = envConf.TEST_MODE ? 5 : 10;
//export const CHANGE_WALLET_EVERY_N_BUYS = 999999999; // unused; debug; do not change wallet
export const MIN_BOOSTER_BALANCE_SOL = 0.015;
export const RESERVED_BOOSTER_BALANCE_SOL = 0.01;
export const EMPTY_PUPPET_BALANCE_THRESHOLD = 0.005; // when a puppet is considered empty
export const RESERVED_PUPPET_BALANCE = 0.005; // min to keep when transacting
export const MIN_NEW_PUPPET_BUDGET = EMPTY_PUPPET_BALANCE_THRESHOLD + 0.002;

export const REFERRAL_FEE_PERC = 25;
export const MIN_REF_CLAIM_AMOUNT_SOL = envConf.TEST_MODE ? 0.001 : 0.01;

export const NEW_BOOSTER_BALANCE_CHECK_INTERVAL = envConf.TEST_MODE ? 5 * 1000 : 30 * 1000;
export const NEW_BOOSTER_BALANCE_CHECK_HARD_TIMEOUT = 4 * 60 * 60 * 1000;
export const NEW_BOOSTER_MIN_ACCEPTED_BALANCE_SOL = envConf.TEST_MODE ? 0.05 : 0.25;
export const SAVED_BOOSTER_START_DELAY = envConf.TEST_MODE ? 2 * 1000 : 30 * 1000;

export const BOOSTER_TOP_GEAR = 5;
export const MAX_HOLDERS_PER_BOOSTER = 5000;
export const HOLDER_INCREMENT_STEP = 250;

export const POOL_UPDATE_INTERVAL = 1200 * 1000;
export const POOL_DATA_LARGE_URL = "https://api.raydium.io/v2/sdk/liquidity/mainnet.json";

export const JUPITER_API_URL = envConf.JUPITER_API_URL; // self-hosted

export const JITO_BUNDLE_CHECK_TIMEOUT = 25 * 1000;
export const JITO_STATUS_CHECK_INTERVAL = 2 * 1000; // check new bundle status this often

export const BALANCE_CHANGE_CHECK_TIMEOUT = 30 * 1000;
export const JITO_BUNDLE_TIMEOUT = 30 * 1000;


export const JITO_MAX_BUNDLES_PER_SEC_RATE_LIMIT = 50; // for our special key
export const JITO_MAX_BUNDLE_IDS_PER_STATUS_CHECK = 5;

export const SOCIALS = {
  name: "Syndicate Volume Bot",
  telegram: "@SpiryBTC",
};

export const WSOL_MINT_ADDR = "So11111111111111111111111111111111111111112";
export const DEFAULT_SOLANA_FEE_IN_LAMPS = 5000;
export const PRIORITY_FEE_SWAP_IN_LAMPS = 10001;
export const PRIORITY_FEE_TRANSFER_DEFAULT_IN_LAMPS = 100000; // will be divided by 200 000, so use large whole values
export const SWAP_SLIPPAGE_PERCENT = 1.5;
export const SWAP_SLIPPAGE_PERCENT_FOR_VOLUME = 10;
// total gas = cu * price1cu
export const DEFAULT_uLAMPS_PER_CU = 50000; // lamports per compute-unit; default Solana value
export const DEFAULT_NUM_OF_CU_PER_TX = 200000; // compute units per transaction; default Solana value

export const RENT_HOUR_TO_PRICE_MAP: any = {
  // hours : amount of SOL
  "1": 0.75,
  "3": 1.5,
  "12": 4,
  "24": 6,
  [String(7 * 24)]: 12,
  [String(30 * 24)]: 20,
};


export const icons = {
  green: "🟢",
  red: "🔴",
  yellow: "🟡",
  orange: "🟠",
  blue: "🔵",
  white: "⚪️",
  black: "⚫️",
  globeFinancial: "🌐",
  globeRealistic: "🌍",
  rocket: "🚀",
  lock: "🔐",
  lightning: "⚡️",
  hourglassFull: "⏳",
  hourglassEmpty: "⌛️",
  clockRed: "⏰",
  clockAntique: "🕰",
  clockRound: "🕟",
  speechBubbleFull: "💬",
  speechBubbleEmpty: "💭",
  diskette: "💾",
  microscope: "🔬",
  gear: "⚙️",
  tool: "🛠",
  key: "🔑",
  keyAntique: "🗝",
  moonPlanet: "🪐",
  moonYellow: "🌕",
  moonWhite: "🪙",
  chainLink: "🔗",
  chartUpRed: "📈",
  chartDownBlue: "📉",
  chartBars: "📊",
  alienHappy: "👾",
  dice: "🎲",
  clover: "🍀",
  flame: "🔥",
  fire: "🔥",
  lightbulb: "💡",
  bulb: "💡",
  palette: "🎨",
  target: "🎯",
  magnifier: "🔎",
  tractor: "🚜",
  truck: "🚛",
  car: "🚙",
  copcar: "🚓",
  racecar: "🏎",
  plane: "✈️",
  lifebuoy: "🛟",
  questionRed: "❓",
  questionWhite: "❔",
  cup: "🏆",
  goblet: "🏆",
  people: "👫",
  peopleGrayFaceless: "🫂",
  recyleTrashDump: "🚮",
  gasBarrel: "🛢",
  ape: "🦧",
  bird: "🐦",
  bot: "🤖",
  bag: "🎒",
  attention: "⚠️",
  warning: "⚠️",
  greenSquare: "🟩",
  check: "✅",
  cross: "❌",
  crossGray: "✖️",
  stupidFuckingHouse: "🏠",
  backArrow: "↪️",
  rightArrow: "➡️",
  leftArrow: "⬅️",
  diagonalUpArrow: "↗️",
  diagonalDownArrow: "↘️",
  chevronLeft: "◀️",
  chevronRight: "▶️",
  circularArrow: "🔄",
  refresh: "🔄",
  arrowDoubledown: "⏬️",
  tag: "🏷",
  write: "📝",
  notepad: "🗒",
  read: "📖",
  book: "📖",
  fileOpen: "📑",
  bookRed: "📕",
  bookOrange: "📙",
  bookGreen: "📗",
  bookYellow: "📒",
  bookBlue: "📘",
  bookStack: "📚",
  plus: "➕",
  minus: "➖",
  cashCreditCard: "💳",
  cashBanknote: "💵",
  cashBag: "💰",
  cashWadShapeless: "💸",
  cashBankHouse: "🏦",
  cashDiamond: "💎",
  star: "✨",
  heart: "♥️",
  brain: "🧠",
  salute: "🫡",
  thumbUp: "👍",
  thumbDown: "👎",
  handshake: "🤝",
  fingersCrossed: "🫰",
  emoSadConfused: "😟",
  emoAnger: "🤬",
  emoCashFaceTongue: "🤑",
};



export const cars = {
  "1": icons.tractor,
  "2": icons.truck,
  "3": icons.car,
  "4": icons.racecar,
  "5": `${icons.racecar}${icons.copcar}${icons.copcar}${icons.copcar}`,
};
