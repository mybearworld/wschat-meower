import { z } from "zod";
import {
  POST_WS_SCHEMA,
  AUTH_RESPONSE_SCHEMA,
  CHATS_RESPONSE_SCHEMA,
  CHAT_SCHEMA,
  USER_RESPONSE_SCHEMA,
  ULIST_SCHEMA,
  CHAT_RESPONSE_SCHEMA,
} from "./schemas.ts";

/** you might be wondering what motd means. to that i say: good question */
const MOTD = "Welcome to Meower server\nRun /help to see a list of commands";

Deno.serve({}, (req) => {
  if (req.headers.get("upgrade") != "websocket") {
    return new Response(null, {
      status: 307,
      headers: { Location: "https://github.com/mybearworld/wschat-meower" },
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.addEventListener("open", () => {
    socket.send(MOTD);
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

  const setMeowerURL = (url: string) => {
    meower.close();
    meower = new WebSocket(url);
    setUpMeower();
  };

  const COMMANDS: Command[] = [
    {
      aliases: ["join"],
      handler: (cmd) => {
        channel = channels[cmd.match(/^\/join #(.*)$/)?.[1] ?? "home"];
        socket.send(
          "This message needs to be sent so wschat can clear the chat"
        );
      },
    },
    {
      aliases: ["channels"],
      handler: () => {
        socket.send(
          "Channels:\n" +
            Object.keys(channels)
              .map((channel) => " * #" + channel)
              .join("\n")
        );
      },
    },
    {
      aliases: ["nick", "nickname", "name"],
      handler: () => {
        socket.send(
          "Sorry, Meower does not have support for nicknames. Use accounts instead."
        );
      },
    },
    {
      aliases: ["about"],
      handler: () => {
        socket.send(
          "wschat-meower\nGithub: https://github.com/mybearworld/wschat-meower"
        );
      },
    },
    {
      aliases: ["whois"],
      handler: async (cmd) => {
        const username = cmd.replace(/\/(.*?) /, "");
        const response = USER_RESPONSE_SCHEMA.parse(
          await (
            await fetch(
              `https://api.meower.org/users/${encodeURIComponent(username)}`
            )
          ).json()
        );
        if (response.error) {
          if (response.type === "notFound") {
            socket.send("User not found");
            return;
          }
          socket.send(`An unknown error occured: ${response.type}`);
          return;
        }
        socket.send(`${response._id}\nClient: <Unknown>\nID: ${response.uuid}`);
      },
    },
    {
      aliases: ["users"],
      handler: async () => {
        const response = ULIST_SCHEMA.parse(
          await (await fetch("https://api.meower.org/ulist")).json()
        );
        const chat =
          channel === "home" || channel === "livechat" || !token
            ? null
            : CHAT_RESPONSE_SCHEMA.parse(
                await (
                  await fetch(`https://api.meower.org/chats/${channel}`, {
                    headers: { Token: token },
                  })
                ).json()
              );
        if (chat?.error) {
          socket.send(`Unknown error: ${chat.type}`);
          return;
        }
        socket.send(
          `Users in ${chat ? chat.nickname : channel}:\n` +
            response.autoget
              .filter((user) => (chat ? chat.members.includes(user._id) : true))
              .map((user) => ` * ${user._id}`)
              .join("\n")
        );
      },
    },
    {
      aliases: ["help", "?"],
      handler: () => {
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
      handler: async (cmd) => {
        const [newUsername, ...passwordChunks] = cmd.split(" ").slice(1);
        const newPassword = passwordChunks.join(" ");
        const response = AUTH_RESPONSE_SCHEMA.parse(
          await (
            await fetch("https://api.meower.org/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: newUsername,
                password: newPassword,
              }),
            })
          ).json()
        );
        if (response.error) {
          if (response.type === "Unauthorized") {
            socket.send(
              `Account "${newUsername}" not found or password incorrect.`
            );
          } else {
            socket.send(`An unknown error occured: ${response.type}`);
          }
          return;
        }
        username = newUsername;
        token = response.token;
        setMeowerURL(`https://server.meower.org?v=1&token=${response.token}`);
        socket.send(`You logged in as ${newUsername}!`);
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
        channels = { ...channels, ...newChannels };
        socket.send(
          `:json.channels>${JSON.stringify(Object.keys(newChannels))}`
        );
      },
    },
    {
      aliases: ["motd"],
      handler: () => {
        socket.send(`MOTD: ${MOTD}`);
      },
    },
  ];

  socket.addEventListener("message", async (ev) => {
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
            command.handler(message);
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
        body: JSON.stringify({ content: message }),
      }
    );
    if (!response.ok) {
      socket.send(`The meower gods do not like you ${await response.text()}`);
    }
  });

  return response;
});

type Command = {
  aliases: string[];
  handler: (cmd: string) => void;
};
