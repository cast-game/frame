import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import { getCast, getChannel, getUser } from "./neynar.js";
import { getTicketsOwned, getTicketSupply } from "./contract.js";
import { getSCVQuery } from "./constants.js";
import { fetchQuery, init } from "@airstack/node";

init(process.env.AIRSTACK_API_KEY!);

interface TicketData {
	cast: Cast;
	channel: Channel;
	socialCapitalValue: number;
	ticketPrice: number;
	topHoldersPfps: string[];
	holdersCount: number;
	supply: number;
	ticketsOwned: number;
}

export const getData = async (
	castHash: string,
	fid: number
): Promise<TicketData> => {
	const [user, cast, supply, scvResponse] = await Promise.all([
		await getUser(fid),
		await getCast(castHash),
		await getTicketSupply(castHash),
		await fetchQuery(getSCVQuery(castHash)),
	]);

	console.log(user);

	const [channel, ticketsOwned] = await Promise.all([
		await getChannel(cast.parent_url!),
		await getTicketsOwned(castHash, user.verifications)
	]);

	const socialCapitalValue =
		scvResponse.data.FarcasterCasts.Cast[0].socialCapitalValue.formattedValue.toFixed(
			2
		);

	// TODO: fill out all data
	return {
		cast,
		channel,
		socialCapitalValue,
		ticketPrice: 1,
		topHoldersPfps: [],
		holdersCount: supply,
		supply,
		ticketsOwned,
	};
};
