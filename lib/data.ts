import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import {
  getCast,
  getChannel,
  getUser,
  getUsersFromAddresses,
} from "./neynar.js";
import { getTicketsOwned, getTicketSupply, getTokenId } from "./contract.js";
import { getSCVQuery, priceTiers, ticketsAddress } from "./constants.js";
import { fetchQuery, init } from "@airstack/node";
import { Alchemy, Network } from "alchemy-sdk";

init(process.env.AIRSTACK_API_KEY!);
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_SEPOLIA,
});

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

const getHoldersData = async (contractAddress: string, tokenId: bigint) => {
	const { owners } = await alchemy.nft.getOwnersForNft(contractAddress, tokenId);
	const holders = await getUsersFromAddresses(owners);

	const topHoldersPfps = Object.values(holders)
    .flat()
    .sort((a, b) => b.follower_count - a.follower_count)
		.map((user) => user.pfp_url!);
	
	return { count: owners.length, topHoldersPfps };
}

export const getData = async (
  castHash: string,
  fid: number
): Promise<TicketData> => {
  const [user, cast, tokenId, scvResponse] = await Promise.all([
    await getUser(fid),
    await getCast(castHash),
    await getTokenId(castHash),
    await fetchQuery(getSCVQuery(castHash)),
  ]);

  const [channel, ticketsOwned, supply, holdersData] = await Promise.all([
    await getChannel(cast.parent_url!),
    await getTicketsOwned(tokenId, user.verifications),
    await getTicketSupply(tokenId),
    await getHoldersData(ticketsAddress, tokenId),
  ]);

  const socialCapitalValue =
    scvResponse.data.FarcasterCasts.Cast[0].socialCapitalValue.formattedValue.toFixed(
      2
    );

  return {
    cast,
    channel,
    socialCapitalValue,
    ticketPrice: 1,
    topHoldersPfps: holdersData.topHoldersPfps,
    holdersCount: holdersData.count,
    supply,
    ticketsOwned,
  };
};

// TODO: fetch user tier from Andrew's dune query

export function getPrice(tier: number, supply: number, amount: number): number {
  const priceTier = priceTiers[tier];
  const growthRate =
    Math.log(priceTier.priceAt50 / priceTier.startingPrice) / 50;
  const newSupply = supply + amount;
  const pricePerShare =
    priceTier.startingPrice * Math.exp(growthRate * newSupply);

  return Math.ceil(pricePerShare * amount);
}
