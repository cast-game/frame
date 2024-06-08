import { apiEndpoint, getSCVQuery, priceTiers } from "./constants.js";
import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import {
	getCast,
	getChannel,
	getUser,
	getUsersFromAddresses,
} from "./neynar.js";
import { init, fetchQuery } from "@airstack/node";

init(process.env.AIRSTACK_API_KEY!);

interface TicketData {
	cast: Cast;
	channel: Channel;
	socialCapitalValue: number;
	buyPrice: number;
	sellPrice: number;
	topHoldersPfps: string[];
	holdersCount: number;
	supply: number;
	ticketsOwned: number;
}

const queryData = async (query: string) => {
	const res = await fetch(apiEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({ query }),
	});
	const { data } = await res.json();

	return data;
};

export const getActiveTier = async (fid: number) => {
  const meta = {
    "x-dune-api-key": process.env.DUNE_API_KEY || "",
  };
  const header = new Headers(meta);
  try {
    const latest_response = await fetch(
      `https://api.dune.com/api/v1/query/3418402/results?&filters=fid=${
        fid
      }`,
      {
        method: "GET",
        headers: header,
      }
    );

    const body = await latest_response.text();
    const recs = JSON.parse(body).result.rows[0];
    return recs.fid_active_tier;
  } catch (error) {
    return 0;
  }
};

export function getPrice(tier: number, supply: number): number {
	const priceTier = priceTiers[tier];
	const growthRate =
		Math.log(priceTier.priceAt50 / priceTier.startingPrice) / 50;
	const newSupply = supply;
	const pricePerShare =
		priceTier.startingPrice * Math.exp(growthRate * newSupply);

	return Math.ceil(pricePerShare);
}

export const getData = async (
	castHash: string,
	fid: number
): Promise<TicketData> => {
	const [user, cast, ticketDetails, scvResponse] = await Promise.all([
		await getUser(fid),
		await getCast(castHash),
		await queryData(`{
    ticket(id: "${castHash}") {
        activeTier
        channelId
        holders
        supply
    }}`),
		await fetchQuery(getSCVQuery(castHash)),
	]);


  const socialCapitalValue =
		scvResponse.data.FarcasterCasts.Cast[0].socialCapitalValue.formattedValue.toFixed(
			2
		);

	if (!ticketDetails.ticket) {
		const channel = await getChannel(cast.parent_url!);
    const activeTier = await getActiveTier(fid);
    const startingPrice = getPrice(activeTier, 0);

		return {
			cast,
      channel,
      socialCapitalValue,
      buyPrice: startingPrice,
      sellPrice: startingPrice,
      topHoldersPfps: [],
      holdersCount: 0,
      supply: 0,
      ticketsOwned: 0,
		};
	}

	const [balance, channel, holders] = await Promise.all([
		await queryData(`{
			users(id: "${user.verifications[0]}:${castHash}) {
					ticketBalance
			}
			}`),
		await getChannel(cast.parent_url!),
		await getUsersFromAddresses(ticketDetails.ticket.holders),
	]);

	const topHoldersPfps = Object.values(holders)
		.flat()
		.sort((a, b) => b.follower_count - a.follower_count)
		.map((user) => user.pfp_url!);

	

	const buyPrice = getPrice(
		ticketDetails.ticket.activeTier,
		ticketDetails.ticket.supply + 1
	);
	const sellPrice = getPrice(
		ticketDetails.ticket.activeTier,
		ticketDetails.ticket.supply - 1
	);

	return {
		cast,
		channel,
		socialCapitalValue,
		buyPrice,
		sellPrice,
		topHoldersPfps,
		holdersCount: ticketDetails.ticket.holders.length,
		supply: ticketDetails.ticket.supply,
		ticketsOwned: balance.data.user.ticketBalance,
	};
};
