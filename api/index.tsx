import { Button, Frog } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { neynar as neynarHub } from "frog/hubs";
import { neynar } from "frog/middlewares";
import { handle } from "frog/vercel";
import { chainId, gameAddress } from "../lib/constants.js";
import { getCast } from "../lib/neynar.js";
import { gameAbi } from "../lib/abis.js";
import { parseEther, zeroAddress } from "viem";
import { generateSignature } from "../lib/contract.js";
import { getData } from "../lib/api.js";
// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

type State = {
  castHash: string | null;
  channelId: string | null;
  txHash: string | null;
  indexed: boolean;
  txError: boolean;
};

const neynarMiddleware = neynar({
  apiKey: process.env.NEYNAR_API_KEY!,
  features: ["interactor", "cast"],
});

// @ts-ignore
export const app = new Frog<State>({
  assetsPath: "/",
  basePath: "/api",
  initialState: {
    castHash: null,
    channelId: null,
    txHash: null,
    indexed: false,
    txError: false,
  },
  imageOptions: {
    fonts: [
      {
        name: "Inter",
        weight: 500,
        source: "google",
      },
      {
        name: "Inter",
        weight: 600,
        source: "google",
      },
      {
        name: "Inter",
        weight: 700,
        source: "google",
      },
    ],
  },
  // Supply a Hub to enable frame verification.
  hub: neynarHub({ apiKey: process.env.NEYNAR_API_KEY! }),
  verify: "silent",
}) as any;

// @ts-ignore
// TODO: ideally remove or replace with cover
app.frame("/", (c) => {
  return c.res({
    image: <></>,
    intents: [
      <Button action="/ticket/0x372d4633cae9edcfdea4c3f37dcd519de0c78d8f">
        View Ticket
      </Button>,
    ],
  });
});

// @ts-ignore
app.transaction("/buy", async (c) => {
  const {
    previousState: { castHash },
    frameData,
  } = c;

  const cast = await getCast(castHash);

  // Check if the frame is a cast
  let referrer: string = zeroAddress;
  if (
    ![castHash, "0x0000000000000000000000000000000000000000"].includes(
      frameData.castId.hash
    )
  ) {
    const referralCast = await getCast(frameData.castId.hash);
    if (referralCast.author.fid !== cast.author.fid) {
      referrer =
        referralCast.author.verified_addresses.eth_addresses[0] ??
        referralCast.author.custody_address;
    }
  }

  // TODO: get price from bonding curve
  const price = parseEther("1");

  const signature = await generateSignature(
    castHash,
    cast.author.verified_addresses.eth_addresses[0] ??
      cast.author.custody_address,
    BigInt(1),
    price,
    referrer
  );

  const args = [
    castHash,
    cast.author.verified_addresses.eth_addresses[0] ??
      cast.author.custody_address,
    BigInt(1),
    price,
    referrer,
    signature,
  ];

  return c.contract({
    abi: gameAbi,
    chainId,
    functionName: "buy",
    args,
    to: gameAddress,
  });
});

// @ts-ignore
app.transaction("/sell", async (c) => {
  const {
    previousState: { castHash },
    frameData,
  } = c;

  const cast = await getCast(castHash);

  // Check if the frame is a cast
  let referrer: string = zeroAddress;
  if (
    ![castHash, "0x0000000000000000000000000000000000000000"].includes(
      frameData.castId.hash
    )
  ) {
    const referralCast = await getCast(frameData.castId.hash);
    if (referralCast.author.fid !== cast.author.fid) {
      referrer =
        referralCast.author.verified_addresses.eth_addresses[0] ??
        referralCast.author.custody_address;
    }
  }

  // TODO: get price from bonding curve
  const price = parseEther("0.5");

  const signature = await generateSignature(
    castHash,
    cast.author.verified_addresses.eth_addresses[0] ??
      cast.author.custody_address,
    BigInt(1),
    price,
    referrer
  );

  const args = [
    castHash,
    cast.author.verified_addresses.eth_addresses[0] ??
      cast.author.custody_address,
    BigInt(1),
    price,
    referrer,
    signature,
  ];

  return c.contract({
    abi: gameAbi,
    chainId,
    functionName: "sell",
    args,
    to: gameAddress,
  });
});

// @ts-ignore
app.frame("/ticket/:hash", neynarMiddleware, async (c) => {
  const {
    req,
    deriveState,
    previousState,
    transactionId,
    buttonValue,
    frameData,
  }: any = c;

  const castHash = req.path.split("/")[req.path.split("/").length - 1];

  const tokenSymbol = "DEGEN";
  let indexed: boolean;
  let txError: boolean;
  let channelId: string;

  if (previousState.txHash && !previousState.indexed) {
    const endpoint = `https://api.basescan.org/api?module=transaction&action=gettxreceiptstatus&txhash=${transactionId}&apikey=${process.env.BASESCAN_API_KEY}`;
    const res = await fetch(endpoint);

    const parsed = await res.json();
    console.log(parsed);

    if (parsed.status === "0") txError = true;
    if (parsed.status === "1") indexed = true;
  }

  const {
    cast,
    channel,
    socialCapitalValue,
    buyPrice,
    sellPrice,
    holdersCount,
    topHoldersPfps,
    supply,
    ticketsOwned,
  } = await getData(castHash, frameData.fid);

  // @ts-ignore
  const state = deriveState((previousState) => {
    if (castHash) previousState.castHash = castHash;
    if (channelId) previousState.channelId = channelId;
    if (transactionId !== "0x") previousState.txHash = transactionId;
    if (indexed) previousState.indexed = true;
    if (txError) previousState.txError = true;
    if (buttonValue === "return") {
      previousState.indexed = false;
      previousState.txHash = null;
      previousState.txError = false;
    }
  });

  const getImage = async () => {
    if (state.txHash) {
      if (state.indexed) {
        return (
          <div
            style={{
              display: "flex",
            }}
          >
            <img
              src={`${process.env.BASE_URL}/tx-success.png`}
              style={{
                position: "absolute",
              }}
            />
          </div>
        );
      } else if (state.txError) {
        return (
          <div
            style={{
              display: "flex",
            }}
          >
            <img
              src={`${process.env.BASE_URL}/tx-failed.png`}
              style={{
                position: "absolute",
              }}
            />
          </div>
        );
      }
      return (
        <div
          style={{
            display: "flex",
          }}
        >
          <img
            src={`${process.env.BASE_URL}/tx-pending.png`}
            style={{
              position: "absolute",
            }}
          />
        </div>
      );
    }

    const ownershipPercentage = (ticketsOwned / supply) * 100;

    return (
      <div
        style={{
          display: "flex",
        }}
      >
        <img
          src={`${process.env.BASE_URL}/ticket-bg.png`}
          style={{
            position: "absolute",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "4.8rem 5.5rem",
            fontSize: "2.5rem",
            gap: "2rem",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* TODO: add pfp */}
              {/* <span>Cast by {cast.author.username}</span> */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".7rem",
                }}
              >
                <span>Cast by</span>
                <img
                  src={cast.author.pfp_url}
                  style={{ borderRadius: "50%" }}
                  width="55px"
                  height="55px"
                />
                <span>{cast.author.username}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <img
                src={channel.image_url}
                style={{ borderRadius: "50%" }}
                width="55px"
                height="55px"
              />
              <span>/{channel.id}</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "3rem",
              marginBottom: "4rem",
            }}
          >
            <span>Social Capital Value</span>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>{socialCapitalValue}</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "3rem",
            }}
          >
            <span>Ticket Price</span>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>
                {buyPrice} {tokenSymbol}
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "3rem",
            }}
          >
            <span>Holders ({holdersCount.toString()})</span>
            <div
              style={{
                display: "flex",
                gap: ".5rem",
                alignItems: "center",
              }}
            >
              {topHoldersPfps.map((pfp: string) => (
                <img
                  src={pfp}
                  style={{
                    width: "65px",
                    height: "65px",
                    borderRadius: "50%",
                  }}
                />
              ))}
            </div>{" "}
          </div>
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-between",
            }}
          >
            <span>
              Supply: {supply.toString()} ticket{supply !== 1 ? "s" : ""}
            </span>
            {ticketsOwned > 0 ? (
              <span>
                You own {ticketsOwned} ticket{ticketsOwned !== 1 ? "s" : ""} (
                {ownershipPercentage}%)
              </span>
            ) : <span>Buy for potential 2x reward!</span>}
          </div>
        </div>
      </div>
    );
  };

  const getIntents = () => {
    if (state.txHash) {
      if (state.indexed) {
        return [
          <Button.Link href={`https://www.onceupon.gg/${state.txHash}`}>
            View
          </Button.Link>,
          <Button value="return">Done</Button>,
        ];
      } else if (state.txError) {
        return [
          <Button.Link href={`https://www.onceupon.gg/${state.txHash}`}>
            View
          </Button.Link>,
          <Button value="return">Try again</Button>,
        ];
      }
      return [
        <Button.Link href={`https://www.onceupon.gg/${state.txHash}`}>
          View Transaction
        </Button.Link>,
        <Button value="refresh">Refresh</Button>,
      ];
    }

    let buttons = [
      <Button.Transaction target="/buy">Buy</Button.Transaction>,
      <Button.Reset>Refresh</Button.Reset>,
      <Button action={`/details/${channelId}`}>Game Details</Button>,
    ];

    if (ticketsOwned > 0) {
      buttons.splice(
        1,
        0,
        <Button.Transaction target="/sell">Sell</Button.Transaction>
      );
    }

    return buttons;
  };

  return c.res({
    image: getImage(),
    intents: getIntents(),
  });
});

// @ts-ignore
app.frame("/details/:channel", (c) => {
  const { req, previousState } = c;

  // mock data
  const prizePool = 90123;
  const prizePoolUSD = 1234.56;
  const txCount = 829;
  const timeUntilTradingHalt = "5 hours";

  const channel = req.path.split("/")[req.path.split("/").length - 1];

  return c.res({
    image: (
      <div
        style={{
          display: "flex",
        }}
      >
        <img
          src={`${process.env.BASE_URL}/frame-bg.png`}
          style={{
            position: "absolute",
          }}
        />
        <div
          style={{
            display: "flex",
            width: "100%",
            padding: "5.5rem",
            flexDirection: "column",
            gap: "2rem",
            fontSize: "3rem",
            position: "relative",
            alignItems: "center",
          }}
        >
          <span>cast.game x {channel}</span>
          <span>Prize Pool:</span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "5rem", fontWeight: 700 }}>
              {prizePool} DEGEN
            </span>
            <span style={{ fontWeight: 600 }}>${prizePoolUSD}</span>
          </div>
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-between",
              fontSize: "2.5rem",
              position: "absolute",
              bottom: "0",
            }}
          >
            <span>{txCount} tickets purchased</span>
            <span>Trading stops in {timeUntilTradingHalt}</span>
          </div>
        </div>
      </div>
    ),
    intents: [
      <Button.Link href="https://cast.game/about">cast.game</Button.Link>,
      <Button.Link href={`https://warpcast.com/~/channel/${channel}`}>
        /{channel}
      </Button.Link>,
      <Button action={`/ticket/${previousState.castHash}`}>↩</Button>,
    ],
  });
});

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
