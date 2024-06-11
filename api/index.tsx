import { Button, Frog } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { neynar as neynarHub } from "frog/hubs";
import { neynar } from "frog/middlewares";
import { handle } from "frog/vercel";
import {
	assetsIpfsHash,
	chainId,
	gameAddress,
	ipfsGateway,
	tokenSymbol,
} from "../lib/constants.js";
import { gameAbi } from "../lib/abis.js";
import { zeroAddress } from "viem";
import { generateSignature } from "../lib/contract.js";
import { getData, getPriceForCast } from "../lib/api.js";
// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

type State = {
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
		txHash: null,
		indexed: false,
		txError: false,
	},
	// Supply a Hub to enable frame verification.
	hub: neynarHub({ apiKey: process.env.NEYNAR_API_KEY! }),
	verify: "silent",
	secret: process.env.FROG_SECRET,
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
}) as any;

app.castAction(
	"/action",
	// @ts-ignore
	(c) => {
		console.log(
			`Cast Action to ${JSON.stringify(c.actionData.castId)} from ${
				c.actionData.fid
			}`
		);
		return c.frame({
			path: `/ticket`,
		});
	},
	{ name: "cast.game ticket", icon: "tag" }
);

// @ts-ignore
app.transaction("/buy", neynarMiddleware, async (c) => {
	// Check if the frame is a cast
	let referrer: string = zeroAddress;
	const cast = c.var.cast;
	// if (
	// 	![castHash, "0x0000000000000000000000000000000000000000"].includes(
	// 		frameData.castId.hash
	// 	)
	// ) {
	// 	const referralCast = await getCast(frameData.castId.hash);
	// 	if (referralCast.author.fid !== cast.author.fid) {
	// 		referrer =
	// 			referralCast.author.verified_addresses.eth_addresses[0] ??
	// 			referralCast.author.custody_address;
	// 	}
	// }

	const price = await getPriceForCast(c.var.cast, "buy");

	const signature = await generateSignature(
		cast.hash,
		cast.author.verifiedAddresses.ethAddresses[0] ?? cast.author.custodyAddress,
		BigInt(1),
		price,
		referrer
	);

	const args = [
		cast.hash,
		cast.author.verifiedAddresses.ethAddresses[0] ?? cast.author.custodyAddress,
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
app.transaction("/sell", neynarMiddleware, async (c) => {
	// Check if the frame is a cast
	const cast = c.var.cast;
	let referrer: string = zeroAddress;
	// if (
	// 	![castHash, "0x0000000000000000000000000000000000000000"].includes(
	// 		frameData.castId.hash
	// 	)
	// ) {
	// 	const referralCast = await getCast(frameData.castId.hash);
	// 	if (referralCast.author.fid !== cast.author.fid) {
	// 		referrer =
	// 			referralCast.author.verified_addresses.eth_addresses[0] ??
	// 			referralCast.author.custody_address;
	// 	}
	// }

	const price = await getPriceForCast(cast, "sell");

	const signature = await generateSignature(
		cast.hash,
		cast.author.verifiedAddresses.ethAddresses[0] ?? cast.author.custodyAddress,
		BigInt(1),
		price,
		referrer
	);

	const args = [
		cast.hash,
		cast.author.verifiedAddresses.ethAddresses[0] ?? cast.author.custodyAddress,
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
// TODO: ideally remove or replace with cover
app.frame("/", (c) => {
	return c.res({
		image: <></>,
		intents: [
			<Button.AddCastAction action="/action">
				Install Action
			</Button.AddCastAction>,
			<Button action="/ticket">Ticket</Button>,
		],
	});
});

// @ts-ignore
app.frame("/ticket", neynarMiddleware, async (c) => {
	const { deriveState, previousState, transactionId, buttonValue }: any = c;

	let indexed: boolean;
	let txError: boolean;

	if (previousState.txHash && !previousState.indexed) {
		const endpoint = `https://api.basescan.org/api?module=transaction&action=gettxreceiptstatus&txhash=${transactionId}&apikey=${process.env.BASESCAN_API_KEY}`;
		const res = await fetch(endpoint);

		const parsed = await res.json();

		if (parsed.status === "0") txError = true;
		if (parsed.status === "1") indexed = true;
	}

	const { author, channelId, buyPrice, sellPrice, supply, ticketsOwned } =
		await getData(c.var.cast, c.var.interactor.fid);

	// @ts-ignore
	const state = deriveState((previousState) => {
		if (indexed) previousState.indexed = true;
		if (txError) previousState.txError = true;
		if (transactionId !== "0x" && transactionId !== undefined)
			previousState.txHash = transactionId;
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
							src={`${ipfsGateway}/${assetsIpfsHash}/tx-success.png`}
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
							src={`${ipfsGateway}/${assetsIpfsHash}/tx-failed.png`}
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
						src={`${ipfsGateway}/${assetsIpfsHash}/tx-pending.png`}
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
					backgroundImage: `url(${ipfsGateway}/${assetsIpfsHash}/ticket-bg.png)`,
					flexDirection: "column",
					width: "100%",
					height: "100vh",
					padding: "4.8rem 5.5rem",
					fontSize: "2.5rem",
					gap: "2rem",
					alignItems: "center",
					position: "relative",
				}}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						width: "100%",
					}}
				>
					<div style={{ display: "flex", alignItems: "center" }}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "1rem",
							}}
						>
							<span>Cast by @{author}</span>
						</div>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
						<span>/{channelId}</span>
					</div>
				</div>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						fontSize: "3rem",
						width: "100%",
					}}
				>
					<span>Social Capital Value</span>
					<div style={{ display: "flex", alignItems: "center" }}>
						<span style={{ fontWeight: 600 }}>-</span>
					</div>
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "2rem",
						width: "100%",
						position: "absolute",
						bottom: "4.5rem",
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: "3rem",
						}}
					>
						<span>Buy Price</span>
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
						<span>Sell Price</span>
						<div style={{ display: "flex", alignItems: "center" }}>
							<span style={{ fontWeight: 600 }}>
								{sellPrice} {tokenSymbol}
							</span>
						</div>
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
						{ticketsOwned > 0 && (
							<span>
								You own {ticketsOwned} ticket{ticketsOwned !== 1 ? "s" : ""} (
								{ownershipPercentage}%)
							</span>
						)}
						{supply === 0 && <span>Buy for potential 2x reward!</span>}
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
		image: await getImage(),
		imageOptions: {
			width: 1528,
			height: 800,
		},
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
					src={`${ipfsGateway}/${assetsIpfsHash}/frame-bg.png`}
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
