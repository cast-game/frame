import { base, baseSepolia } from "viem/chains";

export const useMainnet = process.env.USE_MAINNET === "true";
export const chain = useMainnet ? base : baseSepolia;
export const chainId = useMainnet ? "eip155:8453" : "eip155:84532";

export const ticketsAddress = "0x89184eb56b6c724b379b02ef8baa7fbdac4d02e3";
// TODO: prob move to db
export const gameAddress = "0xd141cbbfe8db842c2d9a8564fb7a3c751d461bbb";

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
