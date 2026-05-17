export const MAC_ADDRESS_LENGTH = 6;

/** Parse a MAC address string (`aa:bb:cc:dd:ee:ff` or `aa-bb-cc-dd-ee-ff`) into a 6-byte Uint8Array. */
export const parseMacAddress = (mac: string): Uint8Array => {
  const bytes = mac.split(/[:-]/).map((b) => parseInt(b, 16));

  if (bytes.length !== MAC_ADDRESS_LENGTH || bytes.some((b) => isNaN(b) || b < 0x00 || b > 0xff)) {
    throw new Error(`Invalid MAC address: "${mac}"`);
  }

  return new Uint8Array(bytes);
};

/** Format `length` bytes starting at `offset` as a colon-separated lowercase hex MAC address. */
export const formatMacAddress = (bytes: Uint8Array | Buffer, offset: number = 0, length: number = MAC_ADDRESS_LENGTH): string => {
  const parts: string[] = [];
  for (let i = 0; i < length; i++) {
    parts.push(bytes[offset + i].toString(16).padStart(2, "0"));
  }
  return parts.join(":");
};
