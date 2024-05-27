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
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
						}}
					>
						<span>Cast by benbassler.eth in /memes</span>
						<span>Rank 1</span>
					</div>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
              fontSize: "3rem"
						}}
					>
						<span>Social Capital Value</span>
						<div style={{ display: "flex", alignItems: "center" }}>
							<span style={{ fontWeight: 600 }}>256.32</span>
						</div>
					</div>
				</div>
			</div>
		);
	};

	return c.res({
		image: getImage(),
		intents: [
			<TextInput placeholder="Enter custom fruit..." />,
			<Button value="apples">Apples</Button>,
			<Button value="oranges">Oranges</Button>,
			<Button value="bananas">Bananas</Button>,
			status === "response" && <Button.Reset>Reset</Button.Reset>,
		],
	});
});

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
