import { describe, expect, it } from "vitest";
import { decodeBase64Url, parseMessage } from "../src";

const b64 = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_");

describe("decodeBase64Url", () => {
  it("decodes UTF-8", () => {
    expect(decodeBase64Url(b64("Привет ✓"))).toBe("Привет ✓");
  });
});

describe("parseMessage", () => {
  it("handles nested multipart with text, html and attachment", () => {
    const m = parseMessage({
      id: "1",
      threadId: "t",
      snippet: "hi",
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "subject", value: "Hello" },
          { name: "From", value: "a@b.c" },
        ],
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/plain", body: { data: b64("plain") } },
              { mimeType: "text/html", body: { data: b64("<b>html</b>") } },
            ],
          },
          { mimeType: "application/pdf", filename: "a.pdf", body: { attachmentId: "x", size: 5 } },
        ],
      },
    });
    expect(m).toMatchObject({ subject: "Hello", from: "a@b.c", text: "plain", html: "<b>html</b>" });
    expect(m.attachments).toEqual([{ filename: "a.pdf", mimeType: "application/pdf", size: 5, attachmentId: "x" }]);
  });

  it("handles single-part body and missing payload", () => {
    expect(parseMessage({ id: "1", threadId: "t", payload: { mimeType: "text/plain", body: { data: b64("x") } } }).text).toBe("x");
    expect(parseMessage({ id: "1", threadId: "t" }).text).toBe("");
  });
});
