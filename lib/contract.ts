import {
  createPublicClient,
  http,
  getContract,
  keccak256,
  encodePacked,
  zeroAddress,
} from "viem";
import { ticketsAbi, gameAbi } from "./abis.js";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "dotenv";
import { chain, ticketsAddress, gameAddress } from "./constants.js";
config();

const deployer = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

export const client = createPublicClient({
  chain,
  transport: http(),
});

export const gameContract = getContract({
  address: gameAddress,
  abi: gameAbi,
  client,
});

export const ticketsContract = getContract({
  address: ticketsAddress,
  abi: ticketsAbi,
  client,
});

export const generateSignature = async (
  castHash: string,
  castCreator: string,
  amount: bigint,
  price: bigint,
  referrer: string = zeroAddress
) => {
  const nonce = await gameContract.read.nonce([castHash]);
  const hash = keccak256(
    encodePacked(
      ["string", "address", "uint256", "uint256", "address", "uint256"],
      [
        castHash,
        castCreator as `0x${string}`,
        amount,
        price,
        referrer as `0x${string}`,
        nonce as bigint,
      ]
    )
  );

  const signature = await deployer.signMessage({ message: { raw: hash } });
  return signature;
};

export const getTokenId = async (castHash: string): Promise<bigint> =>
  (await ticketsContract.read.castTokenId([castHash])) as bigint;

export const getTicketSupply = async (tokenId: bigint) => {
  const supply = await ticketsContract.read.supply([tokenId]);
  return Number(supply);
};

export const getTicketsOwned = async (tokenId: bigint, addresses: string[]) => {
  const balance = await ticketsContract.read.balanceOf([addresses[0], tokenId]);

  return Number(balance);
};
