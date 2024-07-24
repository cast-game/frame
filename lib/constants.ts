import { base, baseSepolia } from "viem/chains";

export const useMainnet = process.env.USE_MAINNET === "true";
export const chain = useMainnet ? base : baseSepolia;
export const chainId = useMainnet ? "eip155:8453" : "eip155:84532";

export const tokenSymbol = "ETH";

export const ticketsAddress = "0x83909330D0E5821F6116C921E94D212239F4631F";
// TODO: prob move to db
export const gameAddress = "0xCAc80268aBae7307C2Aa9C169251EBa876303a51";

export const apiEndpoint = "https://api-production-9d5d.up.railway.app/"

export const ipfsGateway = "https://ipfs.io/ipfs";
export const assetsIpfsHash = "QmP1ogNrTciYXRGANBwuHhsJeRS68ePK8erKN2TqYYafcC";

// For fetching $DEGEN price data
export const cmcEndpoint =
  "https://pro-api.coinmarketcap.com/v2/tools/price-conversion";

export const getSCVQuery = (castHash: string) => `{
    FarcasterCasts(
      input: {filter: {hash: {_eq: "${castHash}"}}, blockchain: ALL}
    ) {
      Cast {
        socialCapitalValue {
          formattedValue
          rawValue
        }
      }
    }
  }`;

// in $DEGEN
// export const priceTiers = [
// 	{
// 		startingPrice: 25, // $0.50
// 		priceAt50: 4000, // $80
// 	},
// 	{
// 		startingPrice: 50, // $1
// 		priceAt50: 5000, // $100
// 	},
// 	{
// 		startingPrice: 200, // $4
// 		priceAt50: 10000, // $200
// 	},
// 	{
// 		startingPrice: 350, // $7
// 		priceAt50: 12500, // $250
// 	},
// 	{
// 		startingPrice: 500, // $10
// 		priceAt50: 17500, // $350
// 	},
// ];

// in ETH
export const priceTiers = [
	{
			startingPrice: 0.00025, // $0.50
			priceAt50: 0.04,        // $80
	},
	{
			startingPrice: 0.0005,  // $1
			priceAt50: 0.05,        // $100
	},
	{
			startingPrice: 0.002,   // $4
			priceAt50: 0.1,         // $200
	},
	{
			startingPrice: 0.0035,  // $7
			priceAt50: 0.125,       // $250
	},
	{
			startingPrice: 0.005,   // $10
			priceAt50: 0.175,       // $350
	},
];
