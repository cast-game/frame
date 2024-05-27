import { Button, Frog, TextInput } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
// import { neynar } from 'frog/hubs'
import { handle } from "frog/vercel";
import { config } from "dotenv";
config();

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

export const app = new Frog({
	assetsPath: "/",
	basePath: "/api",
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
	// hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
});

app.frame("/", (c) => {
	const { buttonValue, inputText, status } = c;

	// Mock data
	const socialCapitalValue = 256.32;
	const rank = 1;
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

	const getImage = () => {
		return (
			<div
				style={{
					display: "flex",
				}}
			>
				<img
					src="http://localhost:5173/frame-bg.png"
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
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
						}}
					>
						<span>
							Cast by {cast.author.username} in /{channel}
						</span>
						<span>Rank {rank}</span>
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
            <span>
							Supply: {supply} tickets
						</span>
						<span>You own {ticketsOwned} tickets ({ownershipPercentage}%)</span>
          </div>
				</div>
			</div>
		);
	};

	const getIntents = () => {
		return [
			<Button>Buy</Button>,
			<Button.Reset>Refresh</Button.Reset>,
			<Button>Game details</Button>,
		];
	};

	return c.res({
		image: getImage(),
		intents: getIntents(),
	});
});

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
