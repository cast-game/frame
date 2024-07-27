import { apiEndpoint, cmcEndpoint, priceTiers } from "./constants.js";
import { Cast, User } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import { getUser, getUsersFromAddresses } from "./neynar.js";
import { parseEther } from "viem";

interface TicketData {
	author: string;
	buyPrice: number;
	buyPriceFiat: string;
	sellPrice: number;
	sellPriceFiat: string;
	supply: number;
	topHoldersPfps: string[];
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

	if (!user.power_badge && tier > 0) tier--;
	return tier;
};

export function getPrice(tier: number, supply: number): number {
	const priceTier = priceTiers[tier];
	const growthRate =
		Math.log(priceTier.priceAt50 / priceTier.startingPrice) / 50;
	const newSupply = supply;
	const pricePerShare =
		priceTier.startingPrice * Math.exp(growthRate * newSupply);

	return Math.ceil(pricePerShare * 100000) / 100000;
}

export const getPriceForTicket = async (
	castHash: string,
	author: User,
	type: "buy" | "sell"
) => {
	const ticketDetails = await queryData(`{
    ticket(id: "${castHash}") {
        activeTier
        channelId
        holders
        supply
    }}`);

	let price;
	if (!ticketDetails.ticket) {
		const activeTier = getActiveTier(author);
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

export const getFiatValue = async (amount: number): Promise<number> => {
	const query = new URLSearchParams({
		amount: amount.toString(),
		// $DEGEN
		// id: "30096",
		// $ETH
		id: "1027",
		convert: "USD",
	});

	const res = await fetch(`${cmcEndpoint}?${query}`, {
		headers: {
			"X-CMC_PRO_API_KEY": process.env.CMC_API_KEY!,
		},
	});
	const { data } = await res.json();

	return data.quote.USD.price;
};

export const getData = async (cast: Cast, fid: number): Promise<TicketData> => {
	const [user, ticketDetails, tokenPrice] = await Promise.all([
		await getUser(fid),
		await queryData(`{
    ticket(id: "${cast.hash}") {
        activeTier
        channelId
        holders
        supply
    }}`),
		getFiatValue(1),
	]);

	let topHoldersPfps: string[] = [];

	if (ticketDetails.ticket) {
		const res = await getUsersFromAddresses(ticketDetails.ticket.holders);
		const holders = Object.values(res).flatMap((arr) => arr);
		topHoldersPfps = holders
			.sort((a, b) => b.follower_count - a.follower_count)
			.slice(0, 5)
			.map((user) => user.pfp_url!);
	}

	if (!ticketDetails.ticket || ticketDetails.ticket.supply === "0") {
		const activeTier = getActiveTier(cast.author);
		const startingPrice = getPrice(activeTier, 0);
		const buyPriceFiat = Number(tokenPrice * startingPrice).toFixed(2);
		const sellPriceFiat = Number(tokenPrice * startingPrice * 0.64).toFixed(2);

		return {
			author: cast.author.username,
			buyPrice: startingPrice,
			buyPriceFiat,
			// buy price minus fees
			sellPrice: startingPrice * 0.64,
			sellPriceFiat,
			supply: 0,
			topHoldersPfps: [],
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

		const balance = await queryData(`{
        user(id: "${user.verifications[0]?.toLowerCase() ?? "0x0"}:${
			cast.hash
		}") {
            ticketBalance
        }
        }`);

		const ticketsOwned = balance.user ? Number(balance.user.ticketBalance) : 0;
		const buyPriceFiat = (tokenPrice * buyPrice).toFixed(2);
		const sellPriceFiat = (tokenPrice * sellPrice).toFixed(2);

		return {
			author: cast.author.username,
			buyPrice,
			buyPriceFiat,
			sellPrice,
			sellPriceFiat,
			supply: ticketDetails.ticket.supply,
			topHoldersPfps,
			ticketsOwned,
		};
	}
};
