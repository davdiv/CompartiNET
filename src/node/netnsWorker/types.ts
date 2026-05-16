import { SocketOptions } from "node:dgram";

export interface RequestId {
  requestId: number;
}

export interface RequestCreateTCPServer {
  type: "create-tcp-server";
  host: string;
  port: number;
}

export interface RequestCreateUDPSocket {
  type: "create-udp-socket";
  options: SocketOptions;
  host: string;
  port: number;
}

export interface RequestExec {
  type: "exec";
  args: string[];
}

export type NetnsWorkerRequest = RequestCreateTCPServer | RequestCreateUDPSocket | RequestExec;

export type NetnsWorkerResponse<T> =
  | {
      success: true;
      result: T;
    }
  | {
      success: false;
      error: { message: string; code?: string };
    };
