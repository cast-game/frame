import { base, baseSepolia } from "viem/chains";

export const useMainnet = process.env.USE_MAINNET === "true";
export const chain = useMainnet ? base : baseSepolia;
export const chainId = useMainnet ? "eip155:8453" : "eip155:84532";
export const blockExplorer = useMainnet
	? "https://basescan.org"
	: "https://sepolia.basescan.org";

export const tokenSymbol = "ETH";

export const gameAddress = "0x9B2839f3a1B76F00dCb23580AfDa8d93FAe334F9";

export const apiEndpoint = "https://api-production-c6c20.up.railway.app/";

export const ipfsGateway = "https://ipfs.io/ipfs";
export const assetsIpfsHash = "QmP1ogNrTciYXRGANBwuHhsJeRS68ePK8erKN2TqYYafcC";
export const logoIpfsHash = "QmPyhMaHL5w3teHNuSMADXFiUFC4FPurXcquyNUnMnAz57";

export const getSCVQuery = (castHash: string) => `{
    FarcasterCasts(
      input: {filter: {hash: {_eq: "${castHash}"}}, blockchain: ALL}
    ) {
      Cast {
        castValue {
					formattedValue
				}
      }
    }
  }`;

export function formatNumber(number: number): string {
	if (number >= 1000000) {
		return (number / 1000000).toFixed(1).replace(/\.0$/, "") + "m";
	} else if (number >= 1000) {
		return (number / 1000).toFixed(1).replace(/\.0$/, "") + "k";
	} else {
		return number.toString();
	}
}

export function timeUntil(futureDate: Date): string {
	const now = new Date();
	const diffMs = futureDate.getTime() - now.getTime();

	if (diffMs <= 0) {
		return "Trading time has ended";
	}

	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

	if (diffHours >= 1) {
		return `Trading ends in ${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
	} else {
		return `Trading ends in ${diffMinutes} minute${
			diffMinutes !== 1 ? "s" : ""
		}`;
	}
}

// in ETH
export const priceTiers = [
	{
		basePrice: 0.0001, // $0.25
		curveExponent: 1.2,
		scaleFactor: 0.00015,
	},
	{
		basePrice: 0.0002, // $0.50
		curveExponent: 1.25,
		scaleFactor: 0.00015,
	},
	{
		basePrice: 0.0004, // $1
		curveExponent: 1.3,
		scaleFactor: 0.00015,
	},
	{
		basePrice: 0.0006, // $1.50
		curveExponent: 1.3,
		scaleFactor: 0.0002,
	},
	{
		basePrice: 0.0008, // $2
		curveExponent: 1.35,
		scaleFactor: 0.0002,
	},
];
