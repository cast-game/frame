import { Button, Frog, TextInput } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { neynar } from "frog/middlewares";
import { handle } from "frog/vercel";
import {
	assetsIpfsHash,
	blockExplorer,
	chainId,
	formatNumber,
	gameAddress,
	ipfsGateway,
	logoIpfsHash,
	timeUntil,
	tokenSymbol,
} from "../lib/constants.js";
import { gameAbi } from "../lib/abis.js";
import { parseEther, zeroAddress, encodeAbiParameters } from "viem";
import { generateSignature } from "../lib/contract.js";
import {
	createWarpcastLink,
	getData,
	getDetails,
	queryData,
} from "../lib/api.js";
import { getCast, getChannel } from "../lib/neynar.js";
import { Box, Image } from "./ui.js";
import { prisma } from "../lib/prisma.js";
import { getActiveTier, getBuyPrice, getSellPrice } from "../lib/price.js";
// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

type State = {
	castHash: string | null;
	prices: {
		buy: string;
		sell: string;
	} | null;
	creator: {
		fid: number;
		address: string;
	} | null;
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
		prices: null,
		creator: null,
		txHash: null,
		indexed: false,
		txError: false,
	},
	hub: {
		apiUrl: "https://hubs.airstack.xyz",
		fetchOptions: {
			headers: {
				"x-airstack-hubs": process.env.AIRSTACK_API_KEY!,
			},
		},
	},
	verify: "silent",
	imageAspectRatio: "1.91:1",
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
		const round = await prisma.round.findFirst();
		const castCreatedTime = new Date(c.var.cast!.timestamp).getTime();

		if (
			!round ||
			round.channelUrl !== c.var.cast!.parentUrl ||
			round.start.getTime() > castCreatedTime
		) {
			return c.error({
				message: `Only casts in /${round?.channelId} are eligible for this round.`,
			});
		}

		if (round.tradingEnd < new Date()) {
			return c.error({
				message: "The trading period for this round has ended.",
			});
		}

		return c.frame({
			path: `/trade/${c.var.cast!.hash}`,
		});
	},
	{ name: "cast.game ticket", icon: "tag" }
);

// @ts-ignore
app.transaction("/buy", neynarMiddleware, async (c) => {
	const { previousState, frameData, inputText } = c as any;
	const amount = inputText ? BigInt(inputText) : 1n;

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
			referrer = referralCast.author.verifications
				? referralCast.author.verifications[0]
				: referralCast.author.custody_address;
		}
	}

	let price;
	if (amount === 1n) price = parseEther(previousState.prices.buy);
	else {
		const ticketData = await queryData(`{
			ticket(id: "${previousState.castHash}") {
				activeTier
				supply
			}
		}`);
		const activeTier = getActiveTier(previousState.creator);

		price = getBuyPrice(
			BigInt(ticketData.ticket ? ticketData.ticket.activeTier : activeTier),
			BigInt(ticketData.ticket ? ticketData.ticket.supply : 0),
			amount
		);
	}

	const signature = await generateSignature(
		previousState.castHash,
		previousState.creator.address,
		BigInt(c.var.interactor?.fid!),
		amount,
		price,
		referrer
	);

	const encodedParams = encodeAbiParameters(
		[
			{ type: "address", name: "castCreator" },
			{ type: "uint256", name: "senderFid" },
			{ type: "uint256", name: "amount" },
			{ type: "uint256", name: "price" },
			{ type: "address", name: "referrer" },
		],
		[
			previousState.creator.address,
			BigInt(c.var.interactor?.fid!),
			amount,
			price,
			referrer as `0x${string}`,
		]
	);

	const args = [previousState.castHash, encodedParams, signature];

	return c.contract({
		abi: gameAbi,
		chainId,
		functionName: "buy",
		args,
		to: gameAddress,
		value: price,
	});
});

// @ts-ignore
app.transaction("/sell", neynarMiddleware, async (c) => {
	const { previousState, frameData, inputText } = c as any;
	const amount = inputText ? BigInt(inputText) : 1n;

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
			referrer = referralCast.author.verifications
				? referralCast.author.verifications[0]
				: referralCast.author.custody_address;
		}
	}

	let price;
	if (amount === 1n) price = parseEther(previousState.prices.sell);
	else {
		const ticketData = await queryData(`{
			ticket(id: "${previousState.castHash}") {
				activeTier
				supply
			}
		}`);

		price = getSellPrice(
			BigInt(ticketData.ticket.activeTier),
			BigInt(ticketData.ticket.supply),
			amount
		);
	}

	const signature = await generateSignature(
		previousState.castHash,
		previousState.creator.address,
		BigInt(c.var.interactor?.fid!),
		amount,
		price,
		referrer
	);

	const encodedParams = encodeAbiParameters(
		[
			{ type: "address", name: "castCreator" },
			{ type: "uint256", name: "senderFid" },
			{ type: "uint256", name: "amount" },
			{ type: "uint256", name: "price" },
			{ type: "address", name: "referrer" },
		],
		[
			previousState.creator.address,
			BigInt(c.var.interactor?.fid!),
			amount,
			price,
			referrer as `0x${string}`,
		]
	);

	const args = [previousState.castHash, encodedParams, signature];

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
	const testCastHash = "0x6021b06e14eef8fad572823362bbc437981f6e54";

	return c.res({
		image: <></>,
		title: "cast.game",
		intents: [
			<Button.AddCastAction action="/action">
				Install Action
			</Button.AddCastAction>,
			<Button action={`/ticket/${testCastHash}`}>Ticket</Button>,
		],
	});
});

// @ts-ignore
app.frame("/ticket/:hash", neynarMiddleware, async (c) => {
	const { req, deriveState } = c as any;

	const castHash = req.path.split("/")[req.path.split("/").length - 1];
	const [cast, round] = await Promise.all([
		getCast(castHash),
		prisma.round.findFirst(),
	]);

	if (
		!round ||
		round.channelUrl !== cast.parent_url ||
		round.start.getTime() > new Date(cast.timestamp).getTime()
	) {
		console.log(round?.start.getTime(), new Date(cast.timestamp).getTime());
		return c.error({
			message: "This cast is not part of a cast.game round.",
		});
	}

	// @ts-ignore
	const state = deriveState((previousState) => {
		if (cast) previousState.castHash = cast.hash;
	});

	const castImageUrl = `https://client.warpcast.com/v2/cast-image?castHash=${castHash}`;

	return c.res({
		image: (
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					padding: "2rem",
					backgroundColor: "#370b70",
				}}
			>
				<img
					src={castImageUrl}
					style={{
						height: "100%",
						borderRadius: "10px",
					}}
				/>
			</div>
		),
		intents: [
			<Button action={`/trade/${castHash}`}>Trade</Button>,
			<Button.Link href="https://cast.game/about">Learn more</Button.Link>,
			<Button.Link
				href={`https://warpcast.com/${cast.author.username}/${castHash}`}
			>
				Cast
			</Button.Link>,
		],
	});
});

// @ts-ignore
app.frame("/trade/:hash", neynarMiddleware, async (c) => {
	const { req, deriveState, previousState, transactionId, buttonValue }: any =
		c;

	let indexed: boolean;
	let txError: boolean;

	if (previousState.txHash && !previousState.indexed) {
		const endpoint = `https://api.basescan.org/api?module=transaction&action=gettxreceiptstatus&txhash=${transactionId}&apikey=${process.env.BASESCAN_API_KEY}`;
		const res = await fetch(endpoint);

		const parsed = await res.json();

		if (parsed.status === "0") txError = true;
		if (parsed.status === "1") indexed = true;
	}

	let cast = await getCast(req.path.split("/")[req.path.split("/").length - 1]);

	const { author, castScore, buyPrice, sellPrice, supply, ticketsOwned } =
		await getData(cast, c.var.interactor?.fid!);

	// @ts-ignore
	const state = deriveState((previousState) => {
		if (cast) {
			previousState.castHash = cast.hash;
			previousState.creator = {
				fid: cast.author.fid,
				address: cast.author.verifications
					? cast.author.verifications[0]
					: cast.author.custody_address,
			};
			previousState.prices = {
				buy: buyPrice,
				sell: sellPrice,
			};
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
		const ownershipPercentage =
			ticketsOwned === 0 ? 0 : Math.ceil((ticketsOwned / supply) * 100);

		const params = new URLSearchParams({
			author,
			buyPrice: Number(Number(buyPrice).toFixed(5)).toString(),
			sellPrice: Number((Number(sellPrice) * 0.8).toFixed(5)).toString(),
			supply: supply.toString(),
			ticketsOwned: ticketsOwned.toString(),
			castScore: castScore.toString(),
			ownershipPercentage: ownershipPercentage.toString(),
		});

		// try {
		// 	await fetch(
		// 		`${process.env.PUBLIC_URL}/api/ticket-img?${params.toString()}`
		// 	);
		// } catch (e) {
		// 	console.log("image fetch error:", e);
		// }

		const imageUrl = `${
			process.env.PUBLIC_URL
		}/api/ticket-img?${params.toString()}`;

		return (
			<Box display="flex">
				<Image src={imageUrl} objectFit="contain" />
			</Box>
		);
	};

	const getIntents = () => {
		if (state.txHash) {
			if (state.indexed) {
				const referralLink = createWarpcastLink(
					"I just placed a bet on this cast with /castgame! Trade cast tickets and join the social betting game yourself:",
					`${process.env.PUBLIC_URL}/api/ticket/${state.castHash}`
				);
				return [
					<Button.Link href={referralLink}>Share 🗣️</Button.Link>,
					<Button.Link href={`${blockExplorer}/tx/${state.txHash}`}>
						Transaction
					</Button.Link>,
					<Button value="return">Done</Button>,
				];
			} else if (state.txError) {
				return [
					<Button.Link href={`${blockExplorer}/tx/${state.txHash}`}>
						View
					</Button.Link>,
					<Button value="return">Try again</Button>,
				];
			}
			return [
				<Button.Link href={`${blockExplorer}/tx/${state.txHash}`}>
					View Transaction
				</Button.Link>,
				<Button value="refresh">Refresh</Button>,
			];
		}

		let buttons = [
			<TextInput placeholder="Amount (default: 1)" />,
			<Button.Transaction target="/buy">Buy</Button.Transaction>,
			<Button action={`/details`}>Stats</Button>,
		];

		if (ticketsOwned > 0) {
			buttons.splice(
				2,
				0,
				<Button.Transaction target="/sell">Sell</Button.Transaction>
			);
		}

		return buttons;
	};

	return c.res({
		image: await getImage(),
		intents: getIntents(),
	});
});

// @ts-ignore
app.image("/ticket-img", (c) => {
	// const { previousState } = c as any;
	// const {
	// 	author,
	// 	castScore,
	// 	supply,
	// 	buyPrice,
	// 	sellPrice,
	// 	ticketsOwned,
	// 	ownershipPercentage,
	// } = previousState.ticket;

	const reqJSON = c.req.query();
	const json = removeAmpFromKeys(reqJSON);
	const {
		author,
		castScore,
		supply,
		buyPrice,
		sellPrice,
		ticketsOwned,
		ownershipPercentage,
	} = json;

	// const pfps = topHoldersPfps.split(",");
	// const baseUrl = process.env.NEXT_PUBLIC_API ?? "http://localhost:3000";

	const getImage = () => {
		return (
			<div
				style={{
					display: "flex",
					backgroundImage: `url(${ipfsGateway}/${assetsIpfsHash}/ticket-bg.png)`,
					flexDirection: "column",
					width: "100%",
					height: "100%",
					padding: "6.5rem 7rem",
					fontSize: "3.3rem",
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
						marginBottom: "1rem",
						alignItems: "center",
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
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "1rem",
						}}
					>
						<span style={{ fontWeight: 600 }}>Score</span>
						<div
							style={{
								display: "flex",
								padding: ".5rem 1.5rem",
								background: "linear-gradient(90deg, #45A3B8 0%, #23B68A 100%)",
								alignItems: "center",
								color: "white",
								fontWeight: 600,
								borderRadius: "10px",
							}}
						>
							{castScore}
						</div>
					</div>
				</div>
				{Number(supply) > 0 ? (
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							fontSize: "4rem",
							width: "100%",
						}}
					>
						<span style={{ fontSize: "4.5rem" }}>Tickets minted</span>
						<span style={{ fontWeight: 600, fontSize: "5rem" }}>{supply}</span>
						{/* {pfps.map((pfp: string) => (
							<img
								src={pfp}
								style={{
									width: "80px",
									height: "80px",
									borderRadius: "50%",
								}}
							/>
						))} */}
					</div>
				) : (
					<div
						style={{
							display: "flex",
							justifyContent: "flex-start",
							fontSize: "4.5rem",
							width: "100%",
						}}
					>
						<span
							style={{
								gap: "1rem",
								fontSize: "4.3rem",
							}}
						>
							Get <b style={{ color: "#108f36" }}>double earning power</b> as
							the first buyer!
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
						}}
					>
						<span style={{ fontSize: "4.5rem" }}>Buy Price</span>
						<span style={{ fontWeight: "700", fontSize: "5rem" }}>
							{buyPrice} {tokenSymbol}
						</span>
					</div>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: "4rem",
						}}
					>
						<span style={{ fontSize: "4.5rem" }}>Sell Price</span>
						<span style={{ fontWeight: "700", fontSize: "5rem" }}>
							{sellPrice} {tokenSymbol}
						</span>
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
								{ticketsOwned} ticket
								{supply.toString() !== "1" ? "s" : ""}
							</span>
						</span>
						{Number(ticketsOwned) > 0 && (
							<span style={{ gap: "1rem" }}>
								Cast ownership:
								<span style={{ fontWeight: 700 }}>{ownershipPercentage}%</span>
							</span>
						)}
					</div>
				</div>
			</div>
		);
	};

	return c.res({
		image: getImage(),
		imageOptions: {
			width: 1910,
			height: 1000,
		},
	});
});

// @ts-ignore
app.frame("/details", async (c) => {
	const { previousState } = c as any;

	// TODO: get channelId from db
	const [round, details] = await Promise.all([
		prisma.round.findFirst(),
		getDetails(),
	]);

	if (!round) {
		return c.error({
			message: "Failed to fetch round details.",
		});
	}

	const channel = await getChannel(round?.channelId);

	const params = new URLSearchParams({
		title: round?.title ?? "",
		channelId: channel.id,
		imageUrl: channel.image_url ?? "",
		tradingEnd: timeUntil(round?.tradingEnd),
		rewardPool: formatNumber(Number(details.rewardPool)),
		txCount: details.transactionCount.toString(),
		userCount: details.userCount.toString(),
	});

	const imageUrl = `${
		process.env.PUBLIC_URL
	}/api/details-img?${params.toString()}`;

	const getIntents = () => {
		let intents = [
			<Button.AddCastAction action="/action">
				Install Action
			</Button.AddCastAction>,
		];
		if (previousState.castHash) {
			intents.push(
				<Button.Link href="https://cast.game">Dashboard</Button.Link>,
				<Button action={`/trade/${previousState.castHash}`}>↩</Button>
			);
		} else {
			intents.push(
				<Button.Link href="https://cast.game/about">Learn more</Button.Link>
			);
		}
		return intents;
	};

	return c.res({
		image: (
			<Box display="flex">
				<Image src={imageUrl} objectFit="contain" />
			</Box>
		),
		intents: getIntents(),
	});
});

// @ts-ignore
app.image("/details-img", (c) => {
	const reqJSON = c.req.query();
	const json = removeAmpFromKeys(reqJSON);
	const {
		title,
		channelId,
		imageUrl,
		tradingEnd,
		rewardPool,
		txCount,
		userCount,
	} = json;

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
						padding: "4.5rem",
						flexDirection: "column",
						gap: "2rem",
						fontSize: "2.5rem",
						position: "relative",
						alignItems: "center",
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							width: "100%",
						}}
					>
						<img src={`${ipfsGateway}/${logoIpfsHash}`} height={40} />
						<div
							style={{
								display: "flex",
								alignItems: "center",
								fontWeight: 600,
								gap: "1rem",
							}}
						>
							<img
								src={imageUrl}
								style={{
									width: "50px",
									height: "50px",
									borderRadius: "50%",
								}}
							/>
							<span>/{channelId}</span>
						</div>
					</div>
					<span
						style={{ fontSize: "3.2rem", fontWeight: 600, marginTop: ".4rem" }}
					>
						{title}
					</span>
					<div
						style={{
							display: "flex",
							gap: "2rem",
							alignItems: "center",
							justifyContent: "center",
							width: "100%",
							margin: "1.7rem 0",
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "1.5rem 3rem",
								minWidth: "340px",
								borderRadius: "10px",
								backgroundColor: "#E6E6E6",
								flexDirection: "column",
								gap: "5px",
							}}
						>
							<div
								style={{ display: "flex", gap: "1rem", alignItems: "center" }}
							>
								<img
									src={
										"https://seeklogo.com/images/E/ethereum-logo-EC6CDBA45B-seeklogo.com.png"
									}
									style={{
										width: "50px",
										height: "50px",
										borderRadius: "50%",
									}}
								/>
								<span style={{ fontSize: "50px", fontWeight: 600 }}>
									{rewardPool}
								</span>
							</div>
							<span style={{ fontSize: "37px" }}>reward pool</span>
						</div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "1.5rem 3rem",
								minWidth: "320px",
								borderRadius: "10px",
								backgroundColor: "#E6E6E6",
								flexDirection: "column",
								gap: "5px",
							}}
						>
							<span style={{ fontSize: "50px", fontWeight: 600 }}>
								{txCount}
							</span>
							<span style={{ fontSize: "37px" }}>transactions</span>
						</div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "1.5rem 3rem",
								minWidth: "320px",
								borderRadius: "10px",
								backgroundColor: "#E6E6E6",
								flexDirection: "column",
								gap: "5px",
							}}
						>
							<span style={{ fontSize: "50px", fontWeight: 600 }}>
								{userCount}
							</span>
							<span style={{ fontSize: "37px" }}>participants</span>
						</div>
					</div>
					<span>{tradingEnd}.</span>
				</div>
			</div>
		),
	});
});

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);

function removeAmpFromKeys(obj: Record<string, string>) {
	const newObj: Record<string, string> = {};
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			const newKey = key.replace(/^amp;/, "");
			newObj[newKey] = obj[key];
		}
	}
	return newObj;
}
