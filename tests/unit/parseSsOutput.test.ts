import { describe, it, expect } from "vitest";
import { parseSsOutput } from "../../src/common/model/parseSsOutput";

describe("parseSsOutput", () => {
  it("parses IPv4 TCP listening socket", () => {
    const result = parseSsOutput("tcp LISTEN 0 511 127.0.0.1:45197 0.0.0.0:*");
    expect(result).toEqual([{ protocol: "tcp4", host: "127.0.0.1", port: 45197 }]);
  });

  it("parses IPv6 TCP listening socket", () => {
    const result = parseSsOutput("tcp LISTEN 0 0 [::]:80 [::]:*");
    expect(result).toEqual([{ protocol: "tcp6", host: "::", port: 80 }]);
  });

  it("parses IPv6 UDP listening socket", () => {
    const result = parseSsOutput("udp UNCONN 0 0 [::1]:5353 [::]:*");
    expect(result).toEqual([{ protocol: "udp6", host: "::1", port: 5353 }]);
  });

  it("parses IPv4 UDP listening socket", () => {
    const result = parseSsOutput("udp UNCONN 0 0 0.0.0.0:68 0.0.0.0:*");
    expect(result).toEqual([{ protocol: "udp4", host: "0.0.0.0", port: 68 }]);
  });

  it("handles IPv6 link-local address with zone ID", () => {
    const result = parseSsOutput("udp UNCONN 0 0 [fe80::d555:1de7:9c4d:2dc1]%enp0s31f6:546 [::]:*");
    expect(result).toEqual([{ protocol: "udp6", host: "fe80::d555:1de7:9c4d:2dc1", zone: "enp0s31f6", port: 546 }]);
  });

  it("handles IPv6 address with zone inside brackets", () => {
    const result = parseSsOutput("tcp LISTEN 0 0 [fe80::1%eth0]:9999 [::]:*");
    expect(result).toEqual([{ protocol: "tcp6", host: "fe80::1", zone: "eth0", port: 9999 }]);
  });

  it("parses IPv6 address without zone (no trailing %suffix)", () => {
    const result = parseSsOutput("tcp LISTEN 0 0 [fe80::1]:5353 [::]:*");
    expect(result).toEqual([{ protocol: "tcp6", host: "fe80::1", port: 5353 }]);
    expect(result[0]).not.toHaveProperty("zone");
  });

  it("parses multiple sockets from multiple lines", () => {
    const output = ["tcp LISTEN 0 511 127.0.0.1:45197 0.0.0.0:*", "tcp LISTEN 0 0 [::]:80 [::]:*", "udp UNCONN 0 0 0.0.0.0:68 0.0.0.0:*"].join("\n");
    const result = parseSsOutput(output);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ protocol: "tcp4", host: "127.0.0.1", port: 45197 });
    expect(result[1]).toEqual({ protocol: "tcp6", host: "::", port: 80 });
    expect(result[2]).toEqual({ protocol: "udp4", host: "0.0.0.0", port: 68 });
  });

  it("returns empty array for empty input", () => {
    expect(parseSsOutput("")).toEqual([]);
  });

  it("skips invalid lines", () => {
    const result = parseSsOutput("garbage line without enough fields");
    expect(result).toEqual([]);
  });

  it("skips unknown protocol types", () => {
    const result = parseSsOutput("raw LISTEN 0 0 0.0.0.0:53 0.0.0.0:*");
    expect(result).toEqual([]);
  });
});
