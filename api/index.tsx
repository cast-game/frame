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
	logoIpfsHash,
	tokenSymbol,
} from "../lib/constants.js";
import { gameAbi } from "../lib/abis.js";
import { parseEther, zeroAddress } from "viem";
import { generateSignature } from "../lib/contract.js";
import { getData } from "../lib/api.js";
import { getCast, getChannel } from "../lib/neynar.js";
import { Box, Image } from "./ui.js";
// import { prisma } from "../lib/prisma.js";
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
	// Supply a Hub to enable frame verification.
	hub: neynarHub({ apiKey: process.env.NEYNAR_API_KEY! }),
	verify: "silent",
	secret: process.env.FROG_SECRET!,
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
		// const round = await prisma.round.findFirst();
		// const castCreatedTime = new Date(c.var.cast.timestamp);
		// if (
		// 	round &&
		// 	round.url === c.var.cast.parentUrl &&
		// 	round.startTime < castCreatedTime &&
		// 	round.tradingEnd > castCreatedTime
		// ) {
		if (c.var.cast.channel === null) {
			return c.error({
				message: "This cast is not eligible for the current round",
			});
		}

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
		if (referralCast.author.fid !== previousState.creator.fid) {
			referrer = referralCast.author.verifications
				? referralCast.author.verifications[0]
				: referralCast.author.custody_address;
		}
	}

	const signature = await generateSignature(
		previousState.castHash,
		previousState.creator.address,
		BigInt(1),
		parseEther(previousState.prices.buy),
		referrer
	);

	const args = [
		previousState.castHash,
		previousState.creator.address,
		BigInt(1),
		parseEther(previousState.prices.buy),
		referrer,
		signature,
	];

	return c.contract({
		abi: gameAbi,
		chainId,
		functionName: "buy",
		args,
		to: gameAddress,
		value: parseEther(previousState.prices.buy),
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
			referrer = referralCast.author.verifications
				? referralCast.author.verifications[0]
				: referralCast.author.custody_address;
		}
	}

	const signature = await generateSignature(
		previousState.castHash,
		previousState.creator.address,
		BigInt(1),
		parseEther(previousState.prices.sell),
		referrer
	);

	const args = [
		previousState.castHash,
		previousState.creator.address,
		BigInt(1),
		parseEther(previousState.prices.sell),
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
	const testCastHash = "0x35cb24ff22bf52b9888cd448f1fad4adf823aaac";

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
	const { req, deriveState } = c;
	let cast = await getCast(req.path.split("/")[req.path.split("/").length - 1]);

	// @ts-ignore
	const state = deriveState((previousState) => {
		if (cast) previousState.castHash = cast.hash;
	});

	const castImageUrl = `https://client.warpcast.com/v2/cast-image?castHash=${cast.hash}`;

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

	let cast = previousState.castHash
		? await getCast(previousState.castHash)
		: c.var.cast;

	const {
		author,
		buyPrice,
		buyPriceFiat,
		sellPrice,
		sellPriceFiat,
		supply,
		// topHoldersPfps,
		ticketsOwned,
	} = await getData(cast, c.var.interactor.fid);

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
		}
		if (buyPrice)
			previousState.prices = {
				buy: buyPrice.toString(),
				sell: sellPrice.toString(),
			};
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

		const ownershipPercentage = Math.ceil((ticketsOwned / supply) * 100);

		const params = new URLSearchParams({
			author,
			buyPrice: buyPrice.toString(),
			buyPriceFiat: buyPriceFiat.toString(),
			sellPrice: sellPrice.toString(),
			sellPriceFiat: sellPriceFiat.toString(),
			supply: supply.toString(),
			ticketsOwned: ticketsOwned.toString(),
			// topHoldersPfps: topHoldersPfps.toString(),
			ownershipPercentage: ownershipPercentage.toString(),
			channelId: cast.channel.id,
		});

		try {
			await fetch(
				`${process.env.PUBLIC_URL}/api/ticket-img?${params.toString()}`
			);
		} catch (e) {
			console.log("image fetch error:", e);
		}

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
				return [
					<Button.Link href={"https://cast.game"}>Share 🗣️</Button.Link>,
					<Button.Link href={`https://www.onceupon.gg/${state.txHash}`}>
						Transaction
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
			<Button value="refresh">Refresh</Button>,
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
		// imageOptions: {
		//   width: 1910,
		//   height: 1000,
		// },
		intents: getIntents(),
	});
});

// @ts-ignore
app.image("/ticket-img", async (c) => {
	const reqJSON = c.req.query();
	const json = removeAmpFromKeys(reqJSON);
	const {
		author,
		supply,
		buyPriceFiat,
		buyPrice,
		sellPriceFiat,
		sellPrice,
		ticketsOwned,
		// topHoldersPfps,
		ownershipPercentage,
		channelId,
	} = json;

	// const pfps = topHoldersPfps.split(",");
	// const baseUrl = process.env.NEXT_PUBLIC_API ?? "http://localhost:3000";

	const getImage = async () => {
		return (
			<div
				style={{
					display: "flex",
					backgroundImage: `url(${ipfsGateway}/${assetsIpfsHash}/ticket-bg.png)`,
					flexDirection: "column",
					width: "100%",
					height: "100%",
					padding: "6.5rem 7rem",
					fontSize: "3.5rem",
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
					<span style={{ fontWeight: 700 }}>/{channelId}</span>
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
						<span style={{ fontSize: "4.2rem" }}>Tickets minted</span>
						<span style={{ fontWeight: 600, fontSize: "4.5rem" }}>{supply}</span>
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
							fontSize: "4.2rem",
							width: "100%",
						}}
					>
						<span
							style={{
								gap: "1rem",
							}}
						>
							Earn <b style={{ color: "#ad0e6e" }}>double rewards</b> as the
							first buyer!
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
						<span style={{ fontSize: "4.2rem" }}>Buy Price</span>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "1.2rem",
							}}
						>
							{/* <span
								style={{
									fontWeight: "600",
									fontSize: "3.2rem",
									opacity: ".6",
								}}
							>
								${buyPriceFiat}
							</span> */}
							<span style={{ fontWeight: "700", fontSize: "4.5rem" }}>
								{buyPrice} {tokenSymbol}
							</span>
						</div>
					</div>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: "4rem",
						}}
					>
						<span style={{ fontSize: "4.2rem" }}>Sell Price</span>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "1.2rem",
							}}
						>
							{/* <span
								style={{
									fontWeight: "600",
									fontSize: "3.2rem",
									opacity: ".6",
								}}
							>
								${sellPriceFiat}
							</span> */}
							<span style={{ fontWeight: "700", fontSize: "4.5rem" }}>
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
		image: await getImage(),
		imageOptions: {
			width: 1910,
			height: 1000,
		},
	});
});

// @ts-ignore
app.frame("/details", async (c) => {
	const { previousState } = c;

	// TODO: get channelId from db
	const channel = await getChannel("memes");

	const params = new URLSearchParams({
		title: "Testnet Demo Competition",
		channelId: channel.id,
		imageUrl: channel.image_url ?? "",
		tradingEnd: "13 hours",
		rewardPool: "255k",
		txCount: "321",
		userCount: "128",
	});

	try {
		await fetch(
			`${process.env.PUBLIC_URL}/api/details-img?${params.toString()}`
		);
	} catch (e) {
		console.log("image fetch error:", e);
	}

	const imageUrl = `${
		process.env.PUBLIC_URL
	}/api/details-img?${params.toString()}`;

	return c.res({
		image: (
			<Box display="flex">
				<Image src={imageUrl} objectFit="contain" />
			</Box>
		),
		intents: [
			<Button.Link href="https://cast.game/about">Learn more</Button.Link>,
			<Button.Link href={`https://warpcast.com/~/channel/${channel.id}`}>
				/{channel.id}
			</Button.Link>,
			<Button action={`/trade`}>↩</Button>,
		],
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
										"https://s2.coinmarketcap.com/static/img/coins/200x200/30096.png"
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
					<span>Trading ends in {tradingEnd}.</span>
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
