import {
	apiEndpoint,
	gameAddress,
	getSCVQuery,
	priceTiers,
} from "./constants.js";
import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import { getUser } from "./neynar.js";
import { formatEther } from "viem";
import { client } from "./contract.js";
import { init, fetchQuery } from "@airstack/node";
import { getActiveTier } from "./price.js";
init(process.env.AIRSTACK_API_KEY!);

interface TicketData {
	author: string;
	authorPfp: string;
	castScore: number | string;
	buyPrice: string;
	sellPrice: string;
	supply: number;
	ticketsOwned: number;
	activeTier: number;
}

export const queryData = async (query: string) => {
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

export const getDetails = async () => {
	const [rewardPool, txsRes, statsRes] = await Promise.all([
		client.getBalance({
			address: gameAddress,
		}),
		queryData(`{
			transactions {
				items {
					id
				}
			}
		}`),
		queryData(`{
			gameStats(id: "0") {
				users
			}
		}`),
	]);

	return {
		rewardPool: Number(formatEther(rewardPool)).toFixed(3),
		transactionCount: txsRes.transactions.items.length,
		userCount: statsRes.gameStats.users.length,
	};
};

export const getData = async (cast: Cast, fid: number): Promise<TicketData> => {
	const [user, ticketDetails, valueRes] = await Promise.all([
		getUser(fid),
		queryData(`{
    ticket(id: "${cast.hash}") {
				buyPrice
				sellPrice
        activeTier
        holders
        supply
    }}`),
		fetchQuery(getSCVQuery(cast.hash)),
	]);
	let castScore = 0;
	try {
		castScore = valueRes.data.FarcasterCasts.Cast[0].castValue.formattedValue;
		if (castScore >= 10) {
			castScore = Math.ceil(castScore);
		} else {
			castScore = Math.ceil(castScore);
		}
	} catch (e) {
		console.error(valueRes.data.FarcasterCasts.Cast)
	}

	if (!ticketDetails.ticket || ticketDetails.ticket.supply === "0") {
		const activeTier = getActiveTier(cast.author);

		return {
			author: cast.author.username,
			authorPfp: cast.author.pfp_url ?? "",
			castScore: castScore > 0 ? castScore : "-",
			buyPrice: priceTiers[activeTier].basePrice.toString(),
			sellPrice: priceTiers[activeTier].basePrice.toString(),
			supply: 0,
			ticketsOwned: 0,
			activeTier,
		};
	} else {
		const res = await queryData(`{
			users(where: {id_ends_with: "${cast.hash}"}) {
				items {
					id
					ticketBalance
				}
			}
		}`);

		let ticketsOwned: number = 0;
		const userAddresses = [user.custody_address, ...user.verifications];

		res.users.items.forEach((user: any) => {
			if (userAddresses.includes(user.id.split(":")[0])) {
				ticketsOwned += Number(user.ticketBalance);
			}
		});

		return {
			author: cast.author.username,
			authorPfp: cast.author.pfp_url ?? "",
			castScore,
			buyPrice: formatEther(BigInt(ticketDetails.ticket.buyPrice)),
			sellPrice: formatEther(BigInt(ticketDetails.ticket.sellPrice)),
			supply: ticketDetails.ticket.supply,
			ticketsOwned,
			activeTier: ticketDetails.ticket.activeTier,
		};
	}
};

export const createWarpcastLink = (
	content: string,
	embedUrl: string
): string => {
	const baseUrl = "https://warpcast.com/~/compose?text=";
	const encodedContent = encodeURIComponent(content);
	const encodedEmbedUrl = encodeURIComponent(embedUrl);

	return `${baseUrl}${encodedContent}&embeds%5B%5D=${encodedEmbedUrl}`;
};
