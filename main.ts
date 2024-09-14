import { z } from "zod";
import {
  POST_WS_SCHEMA,
  AUTH_RESPONSE_SCHEMA,
  CHATS_RESPONSE_SCHEMA,
  CHAT_SCHEMA,
} from "./schemas.ts";

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
    socket.send(`:json.channels>["home","livechat"]`);
  });

  let username: string | undefined = undefined;
  let token: string | undefined = undefined;
  let channel = "home";
  let channels: Record<string, string> = { home: "home", livechat: "livechat" };

  let meower = new WebSocket("https://server.meower.org?v=1");
  const setUpMeower = () => {
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
      if (packet.data.val.post_origin !== channel) {
        return;
      }
      socket.send(`${packet.data.val.u}: ${packet.data.val.p}`);
    });
  };
  setUpMeower();

  const getHandlerOptions = (cmd: string) =>
    ({
      socket,
      cmd,
      meower,
      setMeowerURL: (url) => {
        meower.close();
        meower = new WebSocket(url);
        setUpMeower();
      },
      username,
      setUsername: (newUsername) => {
        username = newUsername;
      },
      token,
      setToken: (newToken) => {
        token = newToken;
      },
      channel,
      setChannel: (newChannel) => {
        channel = newChannel;
      },
      channels,
      setChannels: (newChannels) => {
        channels = newChannels;
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
    if (message.startsWith(":jsonGet ")) {
      return;
    }
    post(getHandlerOptions(message));
  });

  return response;
});

const COMMANDS: Command[] = [
  {
    aliases: ["join"],
    handler: ({ socket, cmd, setChannel, channels }) => {
      setChannel(channels[cmd.match(/^\/join #(.*)$/)?.[1] ?? "home"]);
      socket.send("This message needs to be sent so wschat can clear the chat");
    },
  },
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
    handler: async ({
      socket,
      setMeowerURL,
      cmd,
      setUsername,
      setToken,
      channels,
      setChannels,
    }) => {
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
      setUsername(username);
      setToken(response.token);
      setMeowerURL(`https://server.meower.org?v=1&token=${response.token}`);
      socket.send(`You logged in as ${username}!`);
      const chatsResponse = CHATS_RESPONSE_SCHEMA.parse(
        await (
          await fetch("https://api.meower.org/chats", {
            headers: { Token: response.token },
          })
        ).json()
      );
      if (chatsResponse.error) {
        return;
      }
      const getChatNickname = (chat: z.infer<typeof CHAT_SCHEMA>) =>
        chat.nickname
          ?.toLowerCase()
          ?.replace(/[^a-z0-9]/g, "-")
          ?.replace(/-+/g, "-")
          ?.slice(0, 7)
          ?.replace(/^-|-$/g, "") ??
        "@" +
          (chat.members.find((user) => user !== username)?.slice(0, 6) ??
            "unknown");
      const newChannels = chatsResponse.autoget
        .toSorted((a, b) => b.last_active - a.last_active)
        .reduce((currentChannels, chat) => {
          const nickname = getChatNickname(chat);
          let chosenNickname = nickname;
          let i = 2;
          while (chosenNickname in currentChannels) {
            chosenNickname = `${nickname}-${i}`;
            i++;
          }
          return { ...currentChannels, [chosenNickname]: chat._id };
        }, {});
      setChannels({ ...channels, ...newChannels });
      socket.send(`:json.channels>${JSON.stringify(Object.keys(newChannels))}`);
    },
  },
];

const post = async ({ socket, cmd, token, channel }: HandlerOptions) => {
  if (!token) {
    socket.send(
      "This server requires you to log in, use /login <username> <password> to log in."
    );
    return;
  }
  const response = await fetch(
    `https://api.meower.org/${channel === "home" ? "home" : `posts/${channel}`}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Token: token },
      body: JSON.stringify({ content: cmd }),
    }
  );
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
  setMeowerURL: (url: string) => void;
  cmd: string;
  username?: string;
  setUsername: (username: string) => void;
  token?: string;
  setToken: (token: string) => void;
  channel: string;
  setChannel: (channel: string) => void;
  channels: Record<string, string>;
  setChannels: (channels: Record<string, string>) => void;
};
