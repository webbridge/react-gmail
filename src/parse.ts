import type { Message, MessagePart, ParsedMessage } from "./types";

/** base64url -> UTF-8 string (atob alone breaks on non-ASCII). */
export const decodeBase64Url = (d: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(d.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

export const getHeader = (m: Message, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() == name.toLowerCase())?.value;

export function parseMessage(m: Message): ParsedMessage {
  const out: ParsedMessage = {
    id: m.id,
    threadId: m.threadId,
    snippet: m.snippet || "",
    from: getHeader(m, "from"),
    to: getHeader(m, "to"),
    subject: getHeader(m, "subject"),
    date: getHeader(m, "date"),
    text: "",
    html: "",
    attachments: [],
  };
  const walk = ({ mimeType: t = "", filename, body, parts }: MessagePart) => {
    if (filename && body?.attachmentId) out.attachments.push({ filename, mimeType: t, size: body.size || 0, attachmentId: body.attachmentId });
    else if (body?.data && (t == "text/plain" || t == "text/html")) {
      const k = t == "text/html" ? "html" : "text";
      out[k] ||= decodeBase64Url(body.data);
    }
    parts?.map(walk);
  };
  m.payload && walk(m.payload);
  return out;
}
