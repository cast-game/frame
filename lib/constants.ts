import { base, baseSepolia } from "viem/chains";

export const useMainnet = process.env.USE_MAINNET === "true";
export const chain = useMainnet ? base : baseSepolia;
export const chainId = useMainnet ? "eip155:8453" : "eip155:84532";

export const ticketsAddress = "0xbf45933b41fa7733a8cb5b94fc4791cd4f1d0967";
// TODO: prob move to db
export const gameAddress = "0x9d18a76c3609479968c43fbebee82ed81f6620d2";

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
