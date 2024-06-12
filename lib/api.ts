import { apiEndpoint, cmcEndpoint, priceTiers } from "./constants.js";
import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import { getChannel, getUser, neynarClient } from "./neynar.js";
import { parseEther } from "viem";

interface TicketData {
	author: string;
	holdersCount: number;
	buyPrice: number;
	buyPriceFiat: number;
	sellPrice: number;
	sellPriceFiat: number;
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

export const getActiveTier = (user: any) => {
	let tier;
	if (user.followerCount < 400) {
		tier = 0;
	} else if (user.followerCount > 400 && user.followerCount < 1000) {
		tier = 1;
	} else if (user.followerCount > 1000 && user.followerCount < 10000) {
		tier = 2;
	} else if (user.followerCount > 10000 && user.followerCount < 50000) {
		tier = 3;
	} else {
		tier = 4;
	}

	if (!user.powerBadge && tier > 0) tier--;
	return tier;
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
		const activeTier = getActiveTier(cast.author);
		price = getPrice(activeTier, 0);
	} else {
		price = getPrice(
			ticketDetails.ticket.activeTier,
			type === "buy"
				? ticketDetails.ticket.supply
				: ticketDetails.ticket.supply - 1
		);
	}

	return parseEther(price.toString());
};

// export const getFiatValue = async (amount: number): Promise<number> => {
// 	const query = new URLSearchParams({
// 		amount: amount.toString(),
// 		id: "30096",
// 		convert: "USD",
// 	});

// 	const res = await fetch(`${cmcEndpoint}?${query}`, {
// 		headers: {
// 			"X-CMC_PRO_API_KEY": process.env.CMC_API_KEY!,
// 		},
// 	});
// 	const { data } = await res.json();

// 	return data.quote.USD.price.toFixed(2);
// };

export const getData = async (cast: Cast, fid: number): Promise<TicketData> => {
	const [user, ticketDetails] = await Promise.all([
		await getUser(fid),
		await queryData(`{
    ticket(id: "${cast.hash}") {
        activeTier
        channelId
        holders
        supply
    }}`),
	]);

	if (!ticketDetails.ticket || ticketDetails.ticket.supply === "0") {
		const activeTier = getActiveTier(cast.author);
		const startingPrice = getPrice(activeTier, 0);
		// const buyPriceFiat = await getFiatValue(startingPrice);

		return {
			author: cast.author.username,
			holdersCount: 0,
			buyPrice: startingPrice,
			buyPriceFiat: 0,
			sellPrice: 0,
			sellPriceFiat: 0,
			supply: 0,
			ticketsOwned: 0,
		};
	} else {
		const buyPrice = getPrice(
			ticketDetails.ticket.activeTier,
			ticketDetails.ticket.supply
		);
		const sellPrice = Math.ceil(
			Math.ceil(
				getPrice(
					ticketDetails.ticket.activeTier,
					ticketDetails.ticket.supply - 1
				) * 0.8
			) * 0.8
		);

		const [balance, buyPriceFiat, sellPriceFiat] =
			await Promise.all([
				await queryData(`{
        user(id: "${user.verifications[0]?.toLowerCase() ?? "0x0"}:${
					cast.hash
				}") {
            ticketBalance
        }
        }`),
				// getFiatValue(buyPrice),
				// getFiatValue(sellPrice),
				0,
				0
			]);

		const ticketsOwned = balance.user ? Number(balance.user.ticketBalance) : 0;

		return {
			author: cast.author.username,
			holdersCount: ticketDetails.ticket.holders.length,
			buyPrice,
			buyPriceFiat,
			sellPrice,
			sellPriceFiat,
			supply: ticketDetails.ticket.supply,
			ticketsOwned,
		};
	}
};
