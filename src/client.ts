import { createAuth } from "./auth";
import { err } from "./error";
import type { GmailConfig, ListParams, ListResult, Message, Profile, Thread } from "./types";

export const DEFAULT_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
type Format = "full" | "metadata" | "minimal";

export function createGmailClient({ clientId, scopes = [DEFAULT_SCOPE] }: GmailConfig) {
  const { token, ...auth } = createAuth(clientId, scopes.join(" "));

  /** Low-level escape hatch: any Gmail v1 GET endpoint under users/me. */
  async function get<T>(path: string, query: Record<string, unknown> = {}): Promise<T> {
    const qs = new URLSearchParams();
    for (const k in query) for (const v of [query[k]].flat()) if (v != null && v !== "") qs.append(k, String(v));
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}?${qs}`, {
      headers: { Authorization: "Bearer " + token() },
    }).catch((e: Error) => {
      throw err("network", e.message);
    });
    if (!res.ok) {
      const b = await res.json().catch(() => 0);
      throw err(res.status == 401 ? "not_authenticated" : "api_error", b?.error?.message || res.statusText, res.status);
    }
    return res.json();
  }

  // Gmail's list responses use the endpoint name as the key: /messages -> { messages }, /threads -> { threads }.
  const list = <T>(path: string, p?: ListParams): Promise<ListResult<T>> =>
    get<any>(path, { maxResults: 10, ...p }).then((r) => ({ items: r[path] || [], nextPageToken: r.nextPageToken }));

  return {
    ...auth,
    get,
    getProfile: () => get<Profile>("profile"),
    listMessages: (p?: ListParams) => list<Pick<Message, "id" | "threadId">>("messages", p),
    getMessage: (id: string, format: Format = "full") => get<Message>("messages/" + encodeURIComponent(id), { format }),
    listThreads: (p?: ListParams) => list<Thread>("threads", p),
    getThread: (id: string) => get<Thread>("threads/" + encodeURIComponent(id)),
  };
}

export type GmailClient = ReturnType<typeof createGmailClient>;
