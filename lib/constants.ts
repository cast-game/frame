import { base, baseSepolia } from "viem/chains";

export const useMainnet = process.env.USE_MAINNET === "true";
export const chain = useMainnet ? base : baseSepolia;
export const chainId = useMainnet ? "eip155:8453" : "eip155:84532";

export const ticketsAddress = "0x85e80330806bd6c9032a2dFA5eb40bAAba030d94";
// TODO: prob move to db
export const gameAddress = "0x3DC173846E9aBD600119095046f0feEa21ef58b4";

export const apiEndpoint = "https://api-production-9d5d.up.railway.app/"

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
export const priceTiers = [
	{
		startingPrice: 25, // $0.50
		priceAt50: 4000, // $80
	},
	{
		startingPrice: 50, // $1
		priceAt50: 5000, // $100
	},
	{
		startingPrice: 200, // $4
		priceAt50: 10000, // $200
	},
	{
		startingPrice: 350, // $7
		priceAt50: 12500, // $250
	},
	{
		startingPrice: 500, // $10
		priceAt50: 17500, // $350
	},
];
