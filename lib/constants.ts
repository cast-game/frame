import { base, baseSepolia } from "viem/chains";

export const useMainnet = process.env.USE_MAINNET === "true";
export const chain = useMainnet ? base : baseSepolia;

export const ticketsAddress = "0x6e063e33112a0f3a4182af1969259e283dc305b7";
// TODO: prob move to db
export const gameAddress = "0xe93426c24999504d3a9ad3dd69cea6fb24faa7b7";

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
