export interface GmailConfig {
  /** OAuth 2.0 Web client ID from Google Cloud Console. */
  clientId: string;
  /** Defaults to gmail.readonly. */
  scopes?: string[];
}

export interface Header {
  name: string;
  value: string;
}

export interface MessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Header[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: MessagePart[];
}

export interface Message {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: MessagePart;
}

export interface Thread {
  id: string;
  snippet?: string;
  historyId?: string;
  messages?: Message[];
}

export interface Profile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface ListParams {
  /** Gmail search query, e.g. "is:unread from:foo". */
  q?: string;
  maxResults?: number;
  labelIds?: string[];
  pageToken?: string;
}

export interface ListResult<T> {
  items: T[];
  nextPageToken?: string;
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  snippet: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  text: string;
  html: string;
  attachments: { filename: string; mimeType: string; size: number; attachmentId?: string }[];
}

export type GmailErrorCode = "not_authenticated" | "auth_failed" | "api_error" | "network";

export interface GmailError extends Error {
  code: GmailErrorCode;
  status?: number;
}
