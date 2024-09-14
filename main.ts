import { POST_WS_SCHEMA, AUTH_RESPONSE_SCHEMA } from "./schemas.ts";

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

  let token: string | undefined = undefined;

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

  const getHandlerOptions = (cmd: string) =>
    ({
      socket,
      cmd,
      meower,
      token,
      setToken: (newToken) => {
        token = newToken;
      },
    }) satisfies HandlerOptions;

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
            command.handler(getHandlerOptions(message));
          }
        });
      });
      if (!found) {
        socket.send(`Error: Command "${message.slice(1)}" not found!`);
      }
      return;
    }
    post(getHandlerOptions(message));
  });

  return response;
});

const COMMANDS: Command[] = [
  {
    aliases: ["help", "?"],
    handler: ({ socket }) => {
      const stringifiedCommands = COMMANDS.map(
        (command) =>
          `* /${command.aliases[0]} (Aliases: ${
            command.aliases.slice(1).join(", ") || "<None>"
          })`
      ).join("\n");
      socket.send("Commands available:\n" + stringifiedCommands);
    },
  },
  {
    aliases: ["login"],
    handler: async ({ socket, cmd, setToken }) => {
      const [username, ...passwordChunks] = cmd.split(" ").slice(1);
      const password = passwordChunks.join(" ");
      const response = AUTH_RESPONSE_SCHEMA.parse(
        await (
          await fetch("https://api.meower.org/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          })
        ).json()
      );
      if (response.error) {
        if (response.type === "Unauthorized") {
          socket.send(`Account "${username}" not found or password incorrect.`);
        } else {
          socket.send(`An unknown error occured: ${response.type}`);
        }
        return;
      }
      setToken(response.token);
      socket.send(`You logged in as ${username}!`);
    },
  },
];

const post = async ({ socket, cmd, token }: HandlerOptions) => {
  if (!token) {
    socket.send(
      "This server requires you to log in, use /login <username> <password> to log in."
    );
    return;
  }
  const response = await fetch("https://api.meower.org/home", {
    method: "POST",
    headers: { "Content-Type": "application/json", Token: token },
    body: JSON.stringify({ content: cmd }),
  });
  if (!response.ok) {
    socket.send(`The meower gods do not like you ${await response.text()}`);
  }
};

type Command = {
  aliases: string[];
  handler: (handlerOptions: HandlerOptions) => void;
};

type HandlerOptions = {
  socket: WebSocket;
  meower: WebSocket;
  cmd: string;
  token?: string;
  setToken: (token: string) => void;
};
