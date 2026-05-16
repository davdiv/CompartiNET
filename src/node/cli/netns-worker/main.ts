import { createServer } from "node:net";
import { NetnsWorkerRequest, NetnsWorkerResponse, RequestId } from "../../netnsWorker/types";
import { createSocket } from "node:dgram";
import { exec } from "../../spawnUtils";

if (process.connected) {
  const sendResponse = <T>(response: NetnsWorkerResponse<T> & RequestId, handler?: any) => {
    process.send!(response, handler);
  };
  sendResponse({ requestId: 0, success: true, result: true });
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.on("message", async ({ requestId, ...params }: NetnsWorkerRequest & RequestId) => {
    try {
      switch (params.type) {
        case "create-tcp-server": {
          const server = createServer();
          server.listen(params.port, params.host);
          await new Promise((resolve, reject) => server.on("listening", resolve).on("error", reject));
          sendResponse({ requestId, success: true, result: true }, server);
          server.close();
          break;
        }
        case "create-udp-socket": {
          const socket = createSocket(params.options);
          socket.bind(params.port, params.host);
          await new Promise((resolve, reject) => socket.on("listening", resolve).on("error", reject));
          sendResponse({ requestId, success: true, result: true }, socket);
          socket.close();
          break;
        }
        case "exec": {
          sendResponse({ requestId, success: true, result: await exec(params.args) });
          break;
        }
        default:
          throw new Error("Unknown message type");
      }
    } catch (error: any) {
      sendResponse({
        requestId,
        success: false,
        error: {
          code: error.code,
          message: error.message ?? `${error}`,
        },
      });
    }
  });
  process.on("disconnect", () => {
    process.exit(0);
  });
}
