import { Button, Frog } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { neynar as neynarHub } from "frog/hubs";
import { neynar } from "frog/middlewares";
import { handle } from "frog/vercel";
import { init, fetchQuery } from "@airstack/node";
import { config } from "dotenv";
import { getSCVQuery } from "../lib/constants.js";
import { getCast, getChannel } from "../lib/neynar.js";
config();

init(process.env.AIRSTACK_API_KEY!);

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

type State = {
	castHash: string | null;
	txHash: string | null;
	indexed: boolean;
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
		txHash: null,
		indexed: false,
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
app.frame("/ticket/:hash", neynarMiddleware, (c) => {
	const { req, deriveState, previousState, transactionId }: any = c;

	const castHash = req.path.split("/")[req.path.split("/").length - 1];

	// Mock data
	const tokenPrice = 1450;
	const tokenSymbol = "DEGEN";
	const holderCount = 32;
	const supply = 55;
	const ticketsOwned = 2;
	const ownershipPercentage = 3.64;

	let indexed: boolean;

	// @ts-ignore
	const state = deriveState((previousState) => {
		if (castHash) previousState.castHash = castHash;
		if (transactionId !== "0x") previousState.txHash = transactionId;
		if (indexed) previousState.indexed = true;
	});

	const getImage = async () => {
		if (!["0x", null].includes(previousState.txHash)) {
			return `${process.env.BASE_URL}/tx-success.png`;
		}

		const cast = await getCast(castHash);
		const channel = await getChannel(cast.parent_url!);

		const scvQuery = await fetchQuery(getSCVQuery(castHash));
		const socialCapitalValue =
			scvQuery.data.FarcasterCasts.Cast[0].socialCapitalValue.formattedValue.toFixed(
				2
			);

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
						padding: "4.5rem 5.5rem",
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
								{tokenPrice} {tokenSymbol}
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
						<span>Holders ({holderCount})</span>
						<div style={{ display: "flex", alignItems: "center" }}></div>
					</div>
					<div
						style={{
							display: "flex",
							width: "100%",
							justifyContent: "space-between",
						}}
					>
						<span>Supply: {supply} tickets</span>
						<span>
							You own {ticketsOwned} tickets ({ownershipPercentage}%)
						</span>
					</div>
				</div>
			</div>
		);
	};

	const getIntents = () => {
		return [
			<Button>Buy Ticket</Button>,
			<Button.Reset>↻</Button.Reset>,
			<Button action="/details/memes">Game Details</Button>,
		];
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
