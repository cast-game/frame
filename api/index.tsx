import { Button, Frog } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { neynar as neynarHub } from "frog/hubs";
import { neynar } from "frog/middlewares";
import { handle } from "frog/vercel";
import { init, fetchQuery } from "@airstack/node";
import { config } from "dotenv";
import { getSCVQuery } from "../lib/constants.js";
config();

init(process.env.AIRSTACK_API_KEY!);

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

type State = {
	txHash: string | null;
	indexed: boolean;
};

const neynarMiddleware = neynar({
	apiKey: process.env.NEYNAR_API_KEY!,
	features: ["interactor", "cast"],
});

export const app = new Frog<State>({
	assetsPath: "/",
	basePath: "/api",
	initialState: {
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
app.frame("/", neynarMiddleware, (c) => {
	const {
		deriveState,
		previousState,
		transactionId,
		buttonValue,
		frameData,
	}: any = c;

	// Mock data
	const cast = {
		author: {
			username: "benbassler.eth",
		},
	};
	const channel = "memes";
	const tokenPrice = 1450;
	const tokenSymbol = "DEGEN";
	const holderCount = 32;
	const supply = 55;
	const ticketsOwned = 2;
	const ownershipPercentage = 3.64;

	let indexed: boolean;

	// @ts-ignore
	const state = deriveState((previousState) => {
		if (transactionId !== "0x") previousState.txHash = transactionId;
		if (indexed) previousState.indexed = true;
	});

	const getImage = async () => {
		if (!["0x", null].includes(state.txHash)) {
			return `${process.env.BASE_URL}/tx-success.png`;
		}

		let socialCapitalValue = "-";
		// TODO: fix frameData and remove this
		const castHash = "0x1f87f72d06ba1ae45cc87574d656d0ed918315a8";

		// TODO remove !
		if (!frameData) {
			const scvQuery = await fetchQuery(getSCVQuery(castHash));
			socialCapitalValue =
				scvQuery.data.FarcasterCasts.Cast[0].socialCapitalValue.formattedValue.toFixed(
					2
				);
		}

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
						padding: "5.5rem",
						fontSize: "2.5rem",
						gap: "2rem",
						position: "relative",
					}}
				>
					<div style={{ display: "flex", justifyContent: "space-between" }}>
						<span>Cast by {cast.author.username}</span>
						<span>/{channel}</span>
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
			<Button.Reset>Refresh</Button.Reset>,
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
	const { req } = c;

	// mock data
	const prizePool = 90123;
	const prizePoolUSD = 1234.56;
	const txCount = 829;
	const timeUntilTradingHalt = "5 hours"

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
					<span>
						cast.game x {req.path.split("/")[req.path.split("/").length - 1]}
					</span>
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
			<Button action="/">Return</Button>,
			<Button.Link href="https://cast.game/about">Learn more</Button.Link>,
		],
	});
});

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
