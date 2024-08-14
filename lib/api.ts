import {
  apiEndpoint,
  cmcEndpoint,
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
  // buyPriceFiat: string;
  sellPrice: number;
  // sellPriceFiat: string;
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
  const pricePerShare = priceTier.startingPrice * Math.exp(growthRate * supply);

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

// export const getFiatValue = async (amount: number): Promise<number> => {
//   const query = new URLSearchParams({
//     amount: amount.toString(),
//     // $DEGEN
//     // id: "30096",
//     // $ETH
//     id: "1027",
//     convert: "USD",
//   });

//   const res = await fetch(`${cmcEndpoint}?${query}`, {
//     headers: {
//       "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY!,
//     },
//   });
//   const { data } = await res.json();

//   return data.quote.USD.price;
// };

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
        channelId
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

  // let topHoldersPfps: string[] = [];

  // if (ticketDetails.ticket) {
  // 	const res = await getUsersFromAddresses(ticketDetails.ticket.holders);
  // 	const holders = Object.values(res).flatMap((arr) => arr);
  // 	topHoldersPfps = holders
  // 		.sort((a, b) => b.follower_count - a.follower_count)
  // 		.slice(0, 5)
  // 		.map((user) => user.pfp_url!);
  // }

  if (!ticketDetails.ticket || ticketDetails.ticket.supply === "0") {
    const activeTier = getActiveTier(cast.author);
    const startingPrice = getPrice(activeTier, 0);
    // const buyPriceFiat = Number(tokenPrice * startingPrice).toFixed(2);
    // const sellPriceFiat = Number(tokenPrice * startingPrice * 0.64).toFixed(2);

    return {
      author: cast.author.username,
      authorPfp: cast.author.pfp_url ?? "",
      scv: Number(totalScv),
      buyPrice: startingPrice,
      // buyPriceFiat,
      // buy price minus fees
      sellPrice: startingPrice * 0.64,
      // sellPriceFiat,
      supply: 0,
      topHoldersPfps: [],
      ticketsOwned: 0,
    };
  } else {
    const buyPrice = getPrice(
      ticketDetails.ticket.activeTier,
      ticketDetails.ticket.supply
    );

    const sellPrice =
      Math.ceil(
        getPrice(
          ticketDetails.ticket.activeTier,
          ticketDetails.ticket.supply - 1
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

    // const buyPriceFiat = (tokenPrice * buyPrice).toFixed(2);
    // const sellPriceFiat = (tokenPrice * sellPrice).toFixed(2);

    return {
      author: cast.author.username,
      authorPfp: cast.author.pfp_url ?? "",
      scv,
      buyPrice,
      // buyPriceFiat,
      sellPrice,
      // sellPriceFiat,
      supply: ticketDetails.ticket.supply,
      topHoldersPfps: [],
      ticketsOwned,
    };
  }
};
