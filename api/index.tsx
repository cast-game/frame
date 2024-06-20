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
import { getData, getPriceForTicket } from "../lib/api.js";
import { getCast } from "../lib/neynar.js";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2/index.js";
import { prisma } from "../lib/prisma.js";
// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

type State = {
	castHash: string | null;
	creator: User | null;
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
		creator: null,
		txHash: null,
		indexed: false,
		txError: false,
	},
	// Supply a Hub to enable frame verification.
	hub: neynarHub({ apiKey: process.env.NEYNAR_API_KEY! }),
	verify: "silent",
	secret: process.env.FROG_SECRET!,
	imageAspectRatio: '1.91:1',
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
	neynarMiddleware,
	// @ts-ignore
	async (c) => {
		// const round = await prisma.round.findFirst();
		// const castCreatedTime = new Date(c.var.cast.timestamp);
		// if (
		// 	round &&
		// 	round.url === c.var.cast.parentUrl &&
		// 	round.startTime < castCreatedTime &&
		// 	round.tradingEnd > castCreatedTime
		// ) {
			return c.frame({
				path: `/trade`,
			});
		// } else {
		// 	return c.error({
		// 		message: "This cast is not eligible for the current round",
		// 	});
		// }
	},
	{ name: "cast.game ticket", icon: "tag" }
);

// @ts-ignore
app.transaction("/buy", neynarMiddleware, async (c) => {
	const { previousState, frameData } = c;

	// Check if the frame is a cast
	let referrer: string = zeroAddress;
	if (
		![
			previousState.castHash,
			"0x0000000000000000000000000000000000000000",
		].includes(frameData.castId.hash)
	) {
		const referralCast = await getCast(frameData.castId.hash);
		if (referralCast.author.fid !== previousState.creatorFid) {
			referrer =
				referralCast.author.verified_addresses.eth_addresses[0] ??
				referralCast.author.custody_address;
		}
	}

	const price = await getPriceForTicket(
		previousState.castHash,
		previousState.creator,
		"buy"
	);

	const signature = await generateSignature(
		previousState.castHash,
		previousState.creator.verifiedAddresses.ethAddresses[0] ??
			previousState.creator.custodyAddress,
		BigInt(1),
		price,
		referrer
	);

	const args = [
		previousState.castHash,
		previousState.creator.verifiedAddresses.ethAddresses[0] ??
			previousState.creator.custodyAddress,
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
	const { previousState, frameData } = c;

	// Check if the frame is a cast
	let referrer: string = zeroAddress;
	if (
		![
			previousState.castHash,
			"0x0000000000000000000000000000000000000000",
		].includes(frameData.castId.hash)
	) {
		const referralCast = await getCast(frameData.castId.hash);
		if (referralCast.author.fid !== previousState.creator.fid) {
			referrer =
				referralCast.author.verified_addresses.eth_addresses[0] ??
				referralCast.author.custody_address;
		}
	}

	const price = await getPriceForTicket(
		previousState.castHash,
		previousState.creator,
		"sell"
	);

	const signature = await generateSignature(
		previousState.castHash,
		previousState.creator.verifiedAddresses.ethAddresses[0] ??
			previousState.creator.custodyAddress,
		BigInt(1),
		price,
		referrer
	);

	const args = [
		previousState.castHash,
		previousState.creator.verifiedAddresses.ethAddresses[0] ??
			previousState.creator.custodyAddress,
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
		title: "cast.game",
		intents: [
			<Button.AddCastAction action="/action">
				Install Action
			</Button.AddCastAction>,
			<Button action="/ticket/0x845d16eff0bb77c828eeb4c7d3d79ce612652bbd">
				Ticket
			</Button>,
		],
	});
});

// @ts-ignore
app.frame("/ticket/:hash", neynarMiddleware, async (c) => {
	const { req, deriveState } = c;
	let cast = await getCast(req.path.split("/")[req.path.split("/").length - 1]);

	// @ts-ignore
	const state = deriveState((previousState) => {
		if (cast) {
			previousState.castHash = cast.hash;
			previousState.creator = cast.author;
		}
	});

	return c.res({
		image: `https://client.warpcast.com/v2/cast-image?castHash=${cast.hash}`,
		imageOptions: {
			width: 765,
			height: 765,
		},
		intents: [
			<Button.AddCastAction action="/action">
				Install Action
			</Button.AddCastAction>,
			<Button action={`/trade`}>Ticket</Button>,
		],
	});
});

// @ts-ignore
app.frame("/trade", neynarMiddleware, async (c) => {
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

	let cast = previousState.castHash ? await getCast(previousState.castHash) : c.var.cast;

	const {
		author,
		buyPrice,
		buyPriceFiat,
		sellPrice,
		sellPriceFiat,
		supply,
		ticketsOwned,
	} = await getData(cast, c.var.interactor.fid);

	// @ts-ignore
	const state = deriveState((previousState) => {
		if (cast) {
			previousState.castHash = cast.hash;
			previousState.creator = cast.author;
		}
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
					height: "100%",
					padding: "6.5rem 7rem",
					fontSize: "3rem",
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
							<span
								style={{
									gap: ".8rem",
								}}
							>
								Cast by
								<span style={{ fontWeight: 700 }}>@{author}</span>
							</span>
						</div>
					</div>
					<span style={{ fontWeight: 700 }}>/test</span>
				</div>
				{supply > 0 ? (
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							fontSize: "3.7rem",
							width: "100%",
						}}
					>
						<span>Supply</span>
						<span style={{ fontWeight: 700 }}>
							{supply.toString()} ticket{supply > 1 ? "s" : ""}
						</span>
					</div>
				) : (
					<div
						style={{
							display: "flex",
							justifyContent: "flex-start",
							fontSize: "3.7rem",
							width: "100%",
						}}
					>
						<span
							style={{
								gap: "1rem",
							}}
						>
							Buy now to earn{" "}
							<b style={{ color: "#80751A", fontWeight: 700 }}>2x rewards</b> if
							this cast wins!
						</span>
					</div>
				)}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "2rem",
						width: "100%",
						position: "absolute",
						bottom: "6.5rem",
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: "3.7rem",
						}}
					>
						<span>Buy Price</span>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "1.2rem",
							}}
						>
							<span
								style={{
									fontWeight: "600",
									fontSize: "2.9rem",
									opacity: ".6",
								}}
							>
								${buyPriceFiat}
							</span>
							<span style={{ fontWeight: "700" }}>
								{buyPrice} {tokenSymbol}
							</span>
						</div>
					</div>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: "3.7rem",
						}}
					>
						<span>Sell Price</span>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "1.2rem",
							}}
						>
							<span
								style={{
									fontWeight: "600",
									fontSize: "2.9rem",
									opacity: ".6",
								}}
							>
								${sellPriceFiat}
							</span>
							<span style={{ fontWeight: "700" }}>
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
						<span style={{ gap: "1rem" }}>
							You own
							<span style={{ fontWeight: 700 }}>
								{ticketsOwned.toString()} ticket
								{supply.toString() !== "1" ? "s" : ""}
							</span>
						</span>
						{ticketsOwned > 0 && (
							<span style={{ gap: "1rem" }}>
								Pool reward:
								<span style={{ fontWeight: 700 }}>{ownershipPercentage}%</span>
							</span>
						)}
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
			<Button action={`/details`}>Details</Button>,
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
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "max-age=0",
		},
		intents: getIntents(),
	});
});

// @ts-ignore
app.frame("/details", (c) => {
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
