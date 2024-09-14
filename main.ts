Deno.serve({}, (req) => {
  if (req.headers.get("upgrade") != "websocket") {
    return new Response(null, {
      status: 307,
      headers: { Location: "https://github.com/mybearworld/wschat-meower" },
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.addEventListener("message", (ev) => {
    const data = ev.data;
    if (typeof data !== "string") {
      return;
    }
    socket.send(data);
  });

  return response;
});
