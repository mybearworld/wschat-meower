import { z } from "zod";

export const POST_SCHEMA = z.object({
  u: z.string(),
  p: z.string(),
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
