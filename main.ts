import { POST_WS_SCHEMA } from "./schemas.ts";

Deno.serve({}, (req) => {
  if (req.headers.get("upgrade") != "websocket") {
    return new Response(null, {
      status: 307,
      headers: { Location: "https://github.com/mybearworld/wschat-meower" },
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  const meowerSocket = new WebSocket("https://server.meower.org?v=1");
  meowerSocket.addEventListener("message", (ev) => {
    const data = ev.data;
    if (typeof data !== "string") {
      return;
    }
    console.log(data);
    const packet = POST_WS_SCHEMA.safeParse(JSON.parse(data));
    if (!packet.success) {
      return;
    }
    socket.send(`${packet.data.val.u}: ${packet.data.val.p}`);
  });

  socket.addEventListener("message", (ev) => {
    const data = ev.data;
    if (typeof data !== "string") {
      return;
    }
    socket.send(data);
  });

  return response;
});
