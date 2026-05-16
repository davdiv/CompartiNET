import { Socket } from "node:dgram";
import { createNetnsWorker } from "./netnsWorker/create";

const MAGIC_PACKET_HEADER_LENGTH = 6;
const MAC_ADDRESS_REPETITIONS = 16;
const MAC_ADDRESS_LENGTH = 6;
const WOL_PORT = 9;

function parseMacAddress(mac: string): Uint8Array {
  const bytes = mac.split(/[:-]/).map((b) => parseInt(b, 16));

  if (bytes.length !== MAC_ADDRESS_LENGTH || bytes.some((b) => isNaN(b) || b < 0x00 || b > 0xff)) {
    throw new Error(`Invalid MAC address: "${mac}"`);
  }

  return new Uint8Array(bytes);
}

function buildMagicPacket(macBytes: Uint8Array): Uint8Array {
  const packet = new Uint8Array(MAGIC_PACKET_HEADER_LENGTH + MAC_ADDRESS_REPETITIONS * MAC_ADDRESS_LENGTH);
  packet.fill(0xff, 0, MAGIC_PACKET_HEADER_LENGTH);

  for (let i = 0; i < MAC_ADDRESS_REPETITIONS; i++) {
    packet.set(macBytes, MAGIC_PACKET_HEADER_LENGTH + i * MAC_ADDRESS_LENGTH);
  }

  return packet;
}

export const wakeOnLan = async (netns: string, macAddress: string, broadcastAddress: string = "255.255.255.255"): Promise<void> => {
  const macBytes = parseMacAddress(macAddress);
  const packet = buildMagicPacket(macBytes);

  using worker = await createNetnsWorker(netns);
  const socket = await worker.call<Socket>({ type: "create-udp-socket", host: "0.0.0.0", port: 0, options: { type: "udp4" } });
  try {
    socket.setBroadcast(true);
    await new Promise<void>((resolve, reject) => socket.send(packet, WOL_PORT, broadcastAddress, (error) => (error ? reject(error) : resolve())));
  } finally {
    socket.close();
  }
};
