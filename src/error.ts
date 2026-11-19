import type { GmailError, GmailErrorCode } from "./types";

export const err = (code: GmailErrorCode, message: string, status?: number): GmailError =>
  Object.assign(new Error(message), { code, status }) as GmailError;
