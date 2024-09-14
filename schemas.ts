import { z } from "zod";

export const POST_SCHEMA = z.object({
  u: z.string(),
  p: z.string(),
});

export const POST_WS_SCHEMA = z.object({
  cmd: z.literal("post"),
  val: POST_SCHEMA,
});
