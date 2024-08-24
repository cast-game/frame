import {
  createPublicClient,
  http,
  getContract,
  keccak256,
  encodePacked,
  zeroAddress,
} from "viem";
import { gameAbi } from "./abis.js";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "dotenv";
import { chain, gameAddress } from "./constants.js";
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

export const generateSignature = async (
  castHash: string,
  castCreator: string,
  senderFid: bigint,
  amount: bigint,
  price: bigint,
  referrer: string = zeroAddress
) => {
  const nonce = await gameContract.read.nonce([castHash]);
  const hash = keccak256(
    encodePacked(
      ["string", "address", "uint256", "uint256", "uint256", "address", "uint256"],
      [
        castHash,
        castCreator as `0x${string}`,
        senderFid,
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