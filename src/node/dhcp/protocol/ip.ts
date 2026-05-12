export const bytesToIp = (buffer: Buffer, offset: number): string => `${buffer[offset]}.${buffer[offset + 1]}.${buffer[offset + 2]}.${buffer[offset + 3]}`;

export const ipToBytes = (buffer: Buffer, offset: number, ip: string): void => {
  const parts = ip.split(".");
  for (let i = 0; i < 4; i++) {
    buffer[offset + i] = parseInt(parts[i], 10);
  }
};
