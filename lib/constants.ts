export const getSCVQuery = (castHash: string) => `{
    FarcasterCasts(
      input: {filter: {hash: {_eq: "0xaf2596c0a498f4dd0f47fea40c20fe151471e30d"}}, blockchain: ALL}
    ) {
      Cast {
        socialCapitalValue {
          formattedValue
          rawValue
        }
      }
    }
  }`;
