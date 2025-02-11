import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { priceTiers } from "./constants.js";
import { parseEther } from "viem";

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

export function getPrice(tier: bigint, supply: bigint): bigint {
	const { basePrice, curveExponent, scaleFactor } = priceTiers[Number(tier)]!;
	return parseEther(
		(
			basePrice +
			scaleFactor * Math.pow(Number(supply), curveExponent)
		).toString()
	);
}

export function getBuyPrice(
	tier: bigint,
	supply: bigint,
	amount: bigint
): bigint {
	let totalPrice = 0n;
	for (let i = 0; i < Number(amount); i++) {
		totalPrice += getPrice(tier, supply + BigInt(i));
	}
	return totalPrice;
}

export function getSellPrice(
	tier: bigint,
	supply: bigint,
	amount: bigint
): bigint {
	let totalPrice = 0n;
	if (supply === 0n)
		return parseEther((priceTiers[Number(tier)]!.basePrice * 0.8).toString());

	for (let i = 0; i < amount; i++) {
		if (supply < BigInt(i) + 1n) break;
		totalPrice += getPrice(tier, supply - BigInt(i) - 1n);
	}
	return (totalPrice * 80n) / 100n;
}
