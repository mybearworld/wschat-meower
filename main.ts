import { POST_WS_SCHEMA } from "./schemas.ts";

Deno.serve({}, (req) => {
  if (req.headers.get("upgrade") != "websocket") {
    return new Response(null, {
      status: 307,
      headers: { Location: "https://github.com/mybearworld/wschat-meower" },
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.addEventListener("open", () => {
    socket.send("Welcome to Meower server");
    socket.send("Run /help to see a list of commands");
  });

  const meower = new WebSocket("https://server.meower.org?v=1");
  meower.addEventListener("message", (ev) => {
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
    const message = ev.data;
    if (typeof message !== "string") {
      return;
    }
    if (message.startsWith("/")) {
      let found = false;
      COMMANDS.forEach((command) => {
        command.aliases.forEach((alias) => {
          if (message.startsWith(`/${alias} `) || message === `/${alias}`) {
            found = true;
            command.handler(socket, message, meower);
          }
        });
      });
      if (!found) {
        socket.send(`Error: Command "${message.slice(1)}" not found!`);
      }
      return;
    }
    socket.send(
      "This server requires you to log in, use /login <username> <password> to log in."
    );
  });

  return response;
});

const COMMANDS: {
  aliases: string[];
  handler: (socket: WebSocket, cmd: string, meower: WebSocket) => void;
}[] = [
  {
    aliases: ["help", "?"],
    handler: (ws) => {
      const stringifiedCommands = COMMANDS.map(
        (command) =>
          `* /${command.aliases[0]} (Aliases: ${
            command.aliases.slice(1).join(", ") || "<None>"
          })`
      ).join("\n");
      ws.send("Commands available:\n" + stringifiedCommands);
    },
  },
];
