import { createHash } from "crypto";

export const hashString = (value: string) =>
  createHash("sha256").update(value).digest("hex");
