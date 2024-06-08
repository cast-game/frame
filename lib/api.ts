import { apiEndpoint, getSCVQuery, priceTiers } from "./constants.js";
import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import {
  getCast,
  getChannel,
  getUser,
  getUsersFromAddresses,
} from "./neynar.js";
import { fetchQuery } from "@airstack/node";

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
	console.log(castHash);

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

	console.log(ticketDetails)

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

  const socialCapitalValue =
    scvResponse.data.FarcasterCasts.Cast[0].socialCapitalValue.formattedValue.toFixed(
      2
    );

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
