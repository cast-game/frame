import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { config } from "dotenv";
config();

export const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);

export const getCast = async (castHash: string) => {
	const res = await neynarClient.lookUpCastByHashOrWarpcastUrl(
		castHash,
		"hash"
	);
	return res.cast;
};
