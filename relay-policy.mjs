import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
export function isPublicAddress(address) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export async function resolvePublic(hostname) {
  const addresses = await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((result) => !isPublicAddress(result.address))
  )
    throw new Error("Private destinations are unavailable.");
  return (
    addresses.find((result) => result.family === 4)?.address ||
    addresses[0].address
  );
}
