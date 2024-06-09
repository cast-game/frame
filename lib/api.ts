import { apiEndpoint, priceTiers } from "./constants.js";
import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import { getCast, getChannel, getUser } from "./neynar.js";
import { parseEther } from "viem";

interface TicketData {
	author: string;
	channelId: string;
	buyPrice: number;
	sellPrice: number;
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
			`https://api.dune.com/api/v1/query/3418402/results?&filters=fid=${fid}`,
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

export const getPriceForCast = async (cast: Cast, type: "buy" | "sell") => {
	const ticketDetails = await queryData(`{
    ticket(id: "${cast.hash}") {
        activeTier
        channelId
        holders
        supply
    }}`);

	let price;
	if (!ticketDetails.ticket) {
		const activeTier = await getActiveTier(cast.author.fid);

		price = getPrice(activeTier, 0);
	} else {
		price = getPrice(
			ticketDetails.ticket.activeTier,
			type === "buy"
				? ticketDetails.ticket.supply + 1
				: ticketDetails.ticket.supply - 1
		);
	}

	return parseEther(price.toString());
};

export const getData = async (
	castHash: string,
	fid: number
): Promise<TicketData> => {
	const [user, cast, ticketDetails] = await Promise.all([
		await getUser(fid),
		await getCast(castHash),
		await queryData(`{
    ticket(id: "${castHash}") {
        activeTier
        channelId
        holders
        supply
    }}`),
	]);

	if (!ticketDetails.ticket) {
		const channel = await getChannel(cast.parent_url!);
		const activeTier = await getActiveTier(fid);
		const startingPrice = getPrice(activeTier, 0);

		return {
			author: cast.author.username,
			channelId: channel.id,
			buyPrice: startingPrice,
			sellPrice: startingPrice,
			supply: 0,
			ticketsOwned: 0,
		};
	} else {
		const [balance, channel] = await Promise.all([
			await queryData(`{
        user(id: "${
					user.verifications[0]?.toLowerCase() ?? "0x0"
				}:${castHash}") {
            ticketBalance
        }
        }`),
			await getChannel(cast.parent_url!),
		]);

		const buyPrice = getPrice(
			ticketDetails.ticket.activeTier,
			ticketDetails.ticket.supply
		);
		const sellPrice = Math.ceil(
			getPrice(
				ticketDetails.ticket.activeTier,
				ticketDetails.ticket.supply - 1
			) * 0.8
		);

		const ticketsOwned = balance.user ? Number(balance.user.ticketBalance) : 0;

		return {
			author: cast.author.username,
			channelId: channel.id,
			buyPrice,
			sellPrice,
			supply: ticketDetails.ticket.supply,
			ticketsOwned,
		};
	}
};
