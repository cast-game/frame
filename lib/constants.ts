import { base, baseSepolia } from "viem/chains";

export const useMainnet = process.env.USE_MAINNET === "true";
export const chain = useMainnet ? base : baseSepolia;
export const chainId = useMainnet ? "eip155:8453" : "eip155:84532";

export const tokenSymbol = "DEGEN";

export const ticketsAddress = "0xd51cb2fbe71502f0830e9d3a3bd1d90807dc12c6";
// TODO: prob move to db
export const gameAddress = "0x116affed0a9e9dfb5ee4dd769a8b8a2a476f9927";

export const apiEndpoint = "https://api-production-9d5d.up.railway.app/"

export const ipfsGateway = "https://ipfs.io/ipfs";
export const assetsIpfsHash = "QmWx4TWqnkgqYvbv2Y4XgiyzV8BLWLMJbfc3iwzJhVKmxg";

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
