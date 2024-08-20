import {
	apiEndpoint,
	gameAddress,
	getSCVQuery,
	priceTiers,
} from "./constants.js";
import { Cast, User } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import { getUser } from "./neynar.js";
import { formatEther, parseEther } from "viem";
import { client } from "./contract.js";
import { init, fetchQuery } from "@airstack/node";
init(process.env.AIRSTACK_API_KEY!);

interface TicketData {
	author: string;
	authorPfp: string;
	scv: number;
	buyPrice: number;
	sellPrice: number;
	supply: number;
	topHoldersPfps: string[];
	ticketsOwned: number;
	activeTier: number;
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

export const getActiveTier = (user: User) => {
	let tier;
	if (user.follower_count < 400) {
		tier = 0;
	} else if (user.follower_count > 400 && user.follower_count < 1000) {
		tier = 1;
	} else if (user.follower_count > 1000 && user.follower_count < 10000) {
		tier = 2;
	} else if (user.follower_count > 10000 && user.follower_count < 50000) {
		tier = 3;
	} else {
		tier = 4;
	}

	return tier;
};

export function getPrice(
	tier: number,
	supply: number,
	amount: number,
	isSell: boolean = false
): number {
	const priceTier = priceTiers[tier];
	const growthRate =
		Math.log(priceTier.priceAt50 / priceTier.startingPrice) / 50;

	let totalPrice = 0;
	for (let i = 0; i < amount; i++) {
		const supplyToUse = isSell ? supply - i - 1 : supply + i;

		// Break the loop if we're trying to sell more than the available supply
		if (supplyToUse < 0) break;

		const price = priceTier.startingPrice * Math.exp(growthRate * supplyToUse);
		totalPrice += price;
	}

	// Round to 5 decimal places
	return Math.ceil(totalPrice * 100000) / 100000;
}

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
	const [user, ticketDetails, scvRes] = await Promise.all([
		getUser(fid),
		queryData(`{
    ticket(id: "${cast.hash}") {
        activeTier
        holders
        supply
    }}`),
		// getFiatValue(1),
		fetchQuery(getSCVQuery(cast.hash)),
	]);
	const scvData = scvRes.data.FarcasterCasts.Cast[0];
	const scv =
		scvData.socialCapitalValue !== null
			? scvData.socialCapitalValue.formattedValue.toFixed(2)
			: 0;

	const notaTokenEarned =
		scvData.notaTokenEarned !== null
			? scvData.notaTokenEarned.formattedValue.toFixed(2)
			: 0;

	const totalScv = (Number(scv) + Number(notaTokenEarned)).toFixed(2);

	if (!ticketDetails.ticket || ticketDetails.ticket.supply === "0") {
		const activeTier = getActiveTier(cast.author);
		const startingPrice = getPrice(activeTier, 0, 1);

		return {
			author: cast.author.username,
			authorPfp: cast.author.pfp_url ?? "",
			scv: Number(totalScv),
			buyPrice: startingPrice,
			sellPrice: startingPrice * 0.64,
			supply: 0,
			topHoldersPfps: [],
			ticketsOwned: 0,
			activeTier,
		};
	} else {
		const buyPrice = getPrice(
			ticketDetails.ticket.activeTier,
			ticketDetails.ticket.supply,
			1
		);

		const sellPrice =
			Math.ceil(
				getPrice(
					ticketDetails.ticket.activeTier,
					ticketDetails.ticket.supply - 1,
					1
				) *
					0.64 *
					100000
			) / 100000;

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
			scv,
			buyPrice,
			sellPrice,
			supply: ticketDetails.ticket.supply,
			topHoldersPfps: [],
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
