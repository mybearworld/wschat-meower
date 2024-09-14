import { z } from "zod";

export const POST_SCHEMA = z.object({
  u: z.string(),
  p: z.string(),
  post_origin: z.string(),
});

export const POST_WS_SCHEMA = z.object({
  cmd: z.literal("post"),
  val: POST_SCHEMA,
});

export const AUTH_RESPONSE_SCHEMA = z
  .object({
    token: z.string(),
    error: z.literal(false),
  })
  .or(
    z.object({
      type: z.string(),
      error: z.literal(true),
    })
  );

export const CHAT_SCHEMA = z.object({
  _id: z.string(),
  nickname: z.string().nullable(),
  members: z.string().array(),
  last_active: z.number(),
});

export const CHAT_RESPONSE_SCHEMA = CHAT_SCHEMA.and(
  z.object({
    error: z.literal(false),
  })
).or(
  z.object({
    type: z.string(),
    error: z.literal(true),
  })
);

export const CHATS_RESPONSE_SCHEMA = z
  .object({
    autoget: CHAT_SCHEMA.array(),
    error: z.literal(false),
  })
  .or(
    z.object({
      type: z.string(),
      error: z.literal(true),
    })
  );

export const USER_SCHEMA = z.object({
  _id: z.string(),
  uuid: z.string(),
});

export const USER_RESPONSE_SCHEMA = USER_SCHEMA.and(
  z.object({
    error: z.literal(false),
  })
).or(
  z.object({
    type: z.string(),
    error: z.literal(true),
  })
);

export const ULIST_SCHEMA = z.object({
  autoget: USER_SCHEMA.array(),
});
