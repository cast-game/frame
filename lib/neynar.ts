import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { config } from "dotenv";
config();

export const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);

export const getCast = async (castHash: string) => {
  const res = await neynarClient.lookUpCastByHashOrWarpcastUrl(
    castHash,
    "hash"
  );
  return res.cast;
};

export const getUser = async (fid: number) => {
  const res = await neynarClient.fetchBulkUsers([fid]);
  return res.users[0];
};

export const getChannel = async (id: string) => {
  const res = await neynarClient.lookupChannel(id, {
    type: "id",
  });
  return res.channel;
};

export const getUsersFromAddresses = async (addresses: string[]) =>
  await neynarClient.fetchBulkUsersByEthereumAddress(addresses);
