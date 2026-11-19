import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuth, createGmailClient } from "../src";

type TokenResponse = { access_token?: string; expires_in?: string; error?: string };
const revoke = vi.fn();

/** Mocks Google Identity Services; `respond` decides what the popup returns. */
function mockGoogle(respond: (cfg: any) => void = (cfg) => cfg.callback({ access_token: "tok", expires_in: "3600" })) {
  vi.stubGlobal("google", {
    accounts: { oauth2: { initTokenClient: (cfg: any) => ({ requestAccessToken: () => respond(cfg) }), revoke } },
  });
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, statusText: "ERR" }));

async function signedInClient(fetchImpl: any = () => json({})) {
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  mockGoogle();
  const c = createGmailClient({ clientId: "cid" });
  await c.signIn();
  return { c, fetch: fetch as unknown as ReturnType<typeof vi.fn> };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  revoke.mockClear();
});

describe("sign-in", () => {
  it("rejects API calls before sign in, without opening a popup", async () => {
    const c = createGmailClient({ clientId: "cid" });
    await expect(c.getProfile()).rejects.toMatchObject({ code: "not_authenticated" });
  });

  it("user closes the popup -> auth_failed", async () => {
    mockGoogle((cfg) => cfg.error_callback({ type: "popup_closed" }));
    const c = createGmailClient({ clientId: "cid" });
    await expect(c.signIn()).rejects.toMatchObject({ code: "auth_failed", message: "popup_closed" });
    expect(c.isSignedIn()).toBe(false);
  });

  it("user denies consent -> auth_failed", async () => {
    mockGoogle((cfg) => cfg.callback({ error: "access_denied" } as TokenResponse));
    await expect(createGmailClient({ clientId: "cid" }).signIn()).rejects.toMatchObject({
      code: "auth_failed",
      message: "access_denied",
    });
  });

  it("token expiry signs the user out (Google tokens last ~1h)", async () => {
    vi.useFakeTimers();
    const { c } = await signedInClient();
    expect(c.isSignedIn()).toBe(true);
    vi.advanceTimersByTime(3600_000);
    expect(c.isSignedIn()).toBe(false);
    await expect(c.getProfile()).rejects.toMatchObject({ code: "not_authenticated" });
  });

  it("signOut revokes the token and notifies subscribers; unsubscribe stops notifications", async () => {
    const { c } = await signedInClient();
    const cb = vi.fn();
    const off = c.onAuthChange(cb);
    c.signOut();
    expect(revoke).toHaveBeenCalledWith("tok", expect.any(Function));
    expect(cb).toHaveBeenLastCalledWith(false);
    expect(c.isSignedIn()).toBe(false);
    off();
    await c.signIn();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("createAuth exposes the token for custom API calls", async () => {
    mockGoogle();
    const auth = createAuth("cid", "scope");
    expect(() => auth.token()).toThrow(expect.objectContaining({ code: "not_authenticated" }));
    await auth.signIn();
    expect(auth.token()).toBe("tok");
  });
});

describe("requests", () => {
  it("sends bearer token and query; empty inbox gives []", async () => {
    const { c, fetch } = await signedInClient();
    const r = await c.listMessages({ q: "is:unread", maxResults: 5, labelIds: ["INBOX", "UNREAD"] });
    expect(r.items).toEqual([]);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=is%3Aunread&labelIds=INBOX&labelIds=UNREAD",
    );
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("returns list items and the next page token", async () => {
    const { c } = await signedInClient(() => json({ threads: [{ id: "t1" }], nextPageToken: "p2" }));
    expect(await c.listThreads()).toEqual({ items: [{ id: "t1" }], nextPageToken: "p2" });
  });

  it("encodes ids so they cannot change the request path", async () => {
    const { c, fetch } = await signedInClient(() => json({ id: "x" }));
    await c.getMessage("../labels?format=raw");
    await c.getThread("a/b");
    expect(fetch.mock.calls[0]![0]).toContain("/me/messages/..%2Flabels%3Fformat%3Draw?format=full");
    expect(fetch.mock.calls[1]![0]).toContain("/me/threads/a%2Fb?");
  });

  it("maps API errors", async () => {
    const { c } = await signedInClient(() => json({ error: { message: "nope" } }, 403));
    const e = await c.getThread("1").catch((e) => e);
    expect(e).toBeInstanceOf(Error);
    expect(e).toMatchObject({ code: "api_error", status: 403, message: "nope" });
  });

  it("revoked/expired token on Google's side (401) -> not_authenticated", async () => {
    const { c } = await signedInClient(() => json({ error: { message: "Invalid Credentials" } }, 401));
    await expect(c.getProfile()).rejects.toMatchObject({ code: "not_authenticated", status: 401 });
  });

  it("offline -> network error", async () => {
    const { c } = await signedInClient(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(c.getProfile()).rejects.toMatchObject({ code: "network", message: "Failed to fetch" });
  });
});
