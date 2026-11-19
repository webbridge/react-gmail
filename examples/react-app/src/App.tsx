import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_SCOPE,
  getHeader,
  parseMessage,
  type GmailError,
  type Message,
  type ParsedMessage,
  type Profile,
  type Thread,
} from "react-gmail";
import { clientId, gmail, auth } from "./gmail";
import "./App.css";

type OnError = (message: string | null) => void;
type Format = "full" | "metadata" | "minimal";

/* ---------- helpers ---------- */

function formatError(e: unknown): string {
  if (e instanceof Error && "code" in e) {
    const { code, status, message } = e as GmailError;
    return `${code}${status ? " " + status : ""}: ${message}`;
  }
  return String(e);
}

/** Runs an action with a busy flag; failures go to the shared error banner. */
function useAction(onError: OnError) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => unknown) => {
      onError(null);
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        onError(formatError(e));
      } finally {
        setBusy(false);
      }
    },
    [onError],
  );
  return [busy, run] as const;
}

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(gmail.isSignedIn());
  useEffect(() => gmail.onAuthChange(setSignedIn), []);
  return signedIn;
}

const json = (v: unknown) => JSON.stringify(v, null, 2);
const shortFrom = (from?: string) => from?.replace(/<.*>/, "").trim() || from || "(unknown sender)";

/* ---------- small UI pieces ---------- */

function Empty({ children }: { children: ReactNode }) {
  return <div className="card empty">{children}</div>;
}

interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
}

const prettyLabel = (n: string) => n.replace(/^CATEGORY_/, "Category: ").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** All labels of the account: Gmail's system labels first, then your own. */
function LabelOptions({ labels }: { labels: GmailLabel[] }) {
  const byName = (a: GmailLabel, b: GmailLabel) => a.name.localeCompare(b.name);
  const system = labels.filter((l) => l.type === "system").sort(byName);
  const user = labels.filter((l) => l.type === "user").sort(byName);
  return (
    <>
      {system.length > 0 && (
        <optgroup label="Gmail">
          {system.map((l) => (
            <option key={l.id} value={l.id}>
              {prettyLabel(l.name)}
            </option>
          ))}
        </optgroup>
      )}
      {user.length > 0 && (
        <optgroup label="Your labels">
          {user.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}

function SignInPrompt() {
  return (
    <Empty>
      <div>Sign in with Google to use this tab.</div>
      <button className="btn primary" onClick={() => gmail.signIn().catch(() => {})}>
        Sign in
      </button>
    </Empty>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <pre className="code">{children}</pre>;
}

/* ---------- inbox: list + reading pane ---------- */

function Inbox({ onError }: { onError: OnError }) {
  const signedIn = useSignedIn();
  const [q, setQ] = useState("");
  const [label, setLabel] = useState("INBOX");
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [limit, setLimit] = useState("10");
  const [rows, setRows] = useState<ParsedMessage[] | null>(null);
  const [next, setNext] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, run] = useAction(onError);

  useEffect(() => {
    if (!signedIn) {
      setRows(null);
      setSelected(null);
    }
  }, [signedIn]);

  // Every label of the account (system + yours) feeds the filter dropdown.
  useEffect(() => {
    if (!signedIn) return;
    gmail
      .get<{ labels?: GmailLabel[] }>("labels")
      .then((r) => setLabels(r.labels ?? []))
      .catch((e: unknown) => onError(formatError(e)));
  }, [signedIn, onError]);

  // The list endpoint returns ids only, so fetch lightweight "metadata" for each row.
  const load = (pageToken?: string) =>
    run(async () => {
      const res = await gmail.listMessages({ q, labelIds: label ? [label] : undefined, maxResults: Number(limit), pageToken });
      const metas = await Promise.all(res.items.map((m) => gmail.getMessage(m.id, "metadata")));
      const parsed = metas.map(parseMessage);
      setRows((prev) => (pageToken && prev ? [...prev, ...parsed] : parsed));
      setNext(res.nextPageToken);
    });

  if (!signedIn) return <SignInPrompt />;

  return (
    <>
      <div className="row">
        <select value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Label">
          <option value="">All mail</option>
          {!labels.length && <option value="INBOX">Inbox</option>}
          <LabelOptions labels={labels} />
        </select>
        <input
          className="grow"
          value={q}
          placeholder="Optional search, e.g. from:alice has:attachment"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <select value={limit} onChange={(e) => setLimit(e.target.value)} aria-label="Results per page">
          {[5, 10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
        <button className="btn primary" onClick={() => load()} disabled={busy}>
          Search
          {busy && <span className="spin" />}
        </button>
      </div>

      {rows === null ? (
        <p className="hint" style={{ marginTop: 14 }}>
          Press Search to list messages: <code>listMessages</code> for ids, then <code>getMessage</code> +{" "}
          <code>parseMessage</code> for each row.
        </p>
      ) : (
        <div className="split">
          <div className="card list">
            {rows.length === 0 && <div className="empty">No messages match.</div>}
            {rows.map((m) => (
              <button
                key={m.id}
                className={"item" + (m.id === selected ? " active" : "")}
                onClick={() => setSelected(m.id)}
              >
                <small>{shortFrom(m.from)}</small>
                <b>{m.subject || "(no subject)"}</b>
                <span>{m.snippet}</span>
              </button>
            ))}
            {next && (
              <button className="btn small more" onClick={() => load(next)} disabled={busy}>
                Load more
              </button>
            )}
          </div>
          {selected ? <MessageView key={selected} id={selected} onError={onError} /> : <Empty>Select a message</Empty>}
        </div>
      )}
    </>
  );
}

function MessageView({ id, onError }: { id: string; onError: OnError }) {
  const [msg, setMsg] = useState<Message | null>(null);
  const [view, setView] = useState<"text" | "html">("text");
  const [format, setFormat] = useState<Format>("full");
  const [rawOpen, setRawOpen] = useState(false);
  const [raw, setRaw] = useState("");

  useEffect(() => {
    let live = true;
    gmail
      .getMessage(id)
      .then((m) => live && setMsg(m))
      .catch((e: unknown) => onError(formatError(e)));
    return () => {
      live = false;
    };
  }, [id, onError]);

  // Raw JSON for the chosen format, fetched only while the <details> is open.
  useEffect(() => {
    if (!rawOpen) return;
    let live = true;
    gmail
      .getMessage(id, format)
      .then((m) => live && setRaw(json(m)))
      .catch((e: unknown) => onError(formatError(e)));
    return () => {
      live = false;
    };
  }, [id, format, rawOpen, onError]);

  if (!msg)
    return (
      <Empty>
        Loading<span className="spin" />
      </Empty>
    );

  const p = parseMessage(msg);

  return (
    <div className="card msg">
      <h2>{p.subject || "(no subject)"}</h2>
      <p className="meta">
        From {p.from ?? "?"} · To {p.to ?? "?"}
        <br />
        {p.date} · Message-ID {getHeader(msg, "Message-ID") ?? "n/a"}
      </p>

      <div className="seg">
        <button className={view === "text" ? "active" : ""} onClick={() => setView("text")}>
          Text
        </button>
        <button className={view === "html" ? "active" : ""} onClick={() => setView("html")}>
          HTML
        </button>
      </div>
      {view === "text" ? (
        <pre className="body">{p.text || "(no text/plain part)"}</pre>
      ) : p.html ? (
        // Email HTML is untrusted: always render it in a sandboxed iframe.
        <iframe className="html" sandbox="" srcDoc={p.html} title="HTML body" />
      ) : (
        <p className="hint">(no text/html part)</p>
      )}

      {p.attachments.length > 0 && (
        <div className="files">
          {p.attachments.map((a, i) => (
            <span className="file" key={a.attachmentId ?? i}>
              📎 {a.filename} · {a.size} B
            </span>
          ))}
        </div>
      )}

      <details onToggle={(e) => setRawOpen(e.currentTarget.open)}>
        <summary>Raw getMessage JSON</summary>
        <div className="row" style={{ marginTop: 8 }}>
          {(["full", "metadata", "minimal"] as Format[]).map((f) => (
            <button key={f} className={"chip" + (f === format ? " active" : "")} onClick={() => setFormat(f)}>
              {f}
            </button>
          ))}
        </div>
        <Code>{raw || "Loading…"}</Code>
      </details>
    </div>
  );
}

/* ---------- threads ---------- */

function Threads({ onError }: { onError: OnError }) {
  const signedIn = useSignedIn();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [open, setOpen] = useState<Thread | null>(null);
  const [busy, run] = useAction(onError);

  useEffect(() => {
    if (!signedIn) {
      setThreads(null);
      setOpen(null);
    }
  }, [signedIn]);

  if (!signedIn) return <SignInPrompt />;

  return (
    <>
      <div className="row">
        <button
          className="btn primary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              setThreads((await gmail.listThreads({ maxResults: 10 })).items);
              setOpen(null);
            })
          }
        >
          Load threads
          {busy && <span className="spin" />}
        </button>
        <span className="hint" style={{ margin: 0 }}>
          <code>listThreads</code> then <code>getThread</code>
        </span>
      </div>

      {threads && (
        <div className="split">
          <div className="card list">
            {threads.length === 0 && <div className="empty">No threads.</div>}
            {threads.map((t) => (
              <button
                key={t.id}
                className={"item" + (t.id === open?.id ? " active" : "")}
                onClick={() => run(async () => setOpen(await gmail.getThread(t.id)))}
              >
                <b>{t.snippet || "(no snippet)"}</b>
                <small>{t.id}</small>
              </button>
            ))}
          </div>
          {open ? (
            <div className="card stack">
              <h3>{open.messages?.length ?? 0} message(s) in this thread</h3>
              {(open.messages ?? []).map((m) => {
                const p = parseMessage(m);
                return (
                  <div key={m.id}>
                    <b>{p.subject || "(no subject)"}</b>
                    <div className="meta">{shortFrom(p.from)}</div>
                    <div>{p.snippet}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>Select a thread</Empty>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- profile ---------- */

function ProfileTab({ onError }: { onError: OnError }) {
  const signedIn = useSignedIn();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, run] = useAction(onError);

  useEffect(() => {
    if (!signedIn) setProfile(null);
  }, [signedIn]);

  if (!signedIn) return <SignInPrompt />;

  return (
    <>
      <button className="btn primary" disabled={busy} onClick={() => run(async () => setProfile(await gmail.getProfile()))}>
        Load profile
        {busy && <span className="spin" />}
      </button>
      {profile && (
        <div className="stats">
          <div className="stat">
            <small>Email</small>
            <b style={{ fontSize: 16 }}>{profile.emailAddress}</b>
          </div>
          <div className="stat">
            <small>Messages</small>
            <b>{profile.messagesTotal.toLocaleString()}</b>
          </div>
          <div className="stat">
            <small>Threads</small>
            <b>{profile.threadsTotal.toLocaleString()}</b>
          </div>
          <div className="stat">
            <small>History ID</small>
            <b style={{ fontSize: 16 }}>{profile.historyId}</b>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- raw API ---------- */

function RawApi({ onError }: { onError: OnError }) {
  const signedIn = useSignedIn();
  const [path, setPath] = useState("labels");
  const [out, setOut] = useState("");
  const [busy, run] = useAction(onError);

  if (!signedIn) return <SignInPrompt />;

  const call = (p: string) => {
    setPath(p);
    return run(async () => setOut(json(await gmail.get(p))));
  };

  return (
    <div className="card">
      <h3>gmail.get(path)</h3>
      <p className="hint">Any read endpoint under gmail/v1/users/me/.</p>
      <div className="row">
        <input
          className="grow"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && call(path)}
        />
        <button className="btn primary" disabled={busy} onClick={() => call(path)}>
          Run
          {busy && <span className="spin" />}
        </button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {["labels", "profile", "drafts", "settings/vacation"].map((p) => (
          <button key={p} className={"chip" + (p === path ? " active" : "")} onClick={() => call(p)}>
            {p}
          </button>
        ))}
      </div>
      {out && <Code>{out}</Code>}
    </div>
  );
}

/* ---------- auth-only (createAuth) ---------- */

function AuthOnly({ onError }: { onError: OnError }) {
  const [signedIn, setSignedIn] = useState(auth.isSignedIn());
  const [info, setInfo] = useState("");
  useEffect(() => auth.onAuthChange(setSignedIn), []);

  const showToken = () => {
    try {
      setInfo(`Token: ${auth.token().slice(0, 12)}…`);
    } catch (e) {
      setInfo(formatError(e));
    }
  };

  return (
    <div className="card">
      <h3>createAuth: sign-in only</h3>
      <p className="hint">
        For apps that only need a Google access token to call other Google APIs themselves (Calendar, Drive, …),
        without the Gmail methods. It is an independent instance with its own sign-in, so the header's Gmail session
        doesn't apply here: sign in below to try it.
      </p>
      <p className="hint">
        createAuth status: <b>{signedIn ? "signed in" : "signed out"}</b>
      </p>
      <div className="row">
        <button
          className="btn primary"
          disabled={signedIn}
          onClick={() => {
            onError(null);
            auth.signIn().catch((e: unknown) => onError(formatError(e)));
          }}
        >
          Sign in
        </button>
        <button
          className="btn"
          disabled={!signedIn}
          onClick={() => {
            auth.signOut();
            setInfo("");
          }}
        >
          Sign out
        </button>
        <button className="btn" onClick={showToken}>
          Show token
        </button>
      </div>
      {info && <Code>{info}</Code>}
    </div>
  );
}

/* ---------- app shell ---------- */

const TABS = [
  { id: "inbox", label: "Inbox", },
  { id: "threads", label: "Threads", },
  { id: "profile", label: "Profile", },
  { id: "raw", label: "Raw API", },
  { id: "auth", label: "Auth only" },
] as const;

export default function App() {
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("inbox");
  const signedIn = useSignedIn();
  const [busy, run] = useAction(setError);

  return (
    <main className="app">
      <header className="top">
        <div className="brand" aria-label="react-gmail">
          <span className="wordmark">
            <span className="wm-react">react</span>
            <span className="wm-gmail">gmail</span>
          </span>
        </div>
        <span className={"pill" + (signedIn ? " on" : "")}>
          <span className="dot" />
          {signedIn ? "Signed in" : "Signed out"}
        </span>
        <div className="spacer" />
        {clientId &&
          (signedIn ? (
            <button className="btn" onClick={() => gmail.signOut()}>
              Sign out
            </button>
          ) : (
            <button className="btn primary" disabled={busy} onClick={() => run(() => gmail.signIn())}>
              Sign in with Google
            </button>
          ))}
      </header>
      <p className="scope">
        scope: <code>{DEFAULT_SCOPE}</code>
      </p>

      {!clientId && (
        <div className="alert info" role="note">
          <span>
            <b>No client ID.</b> Copy <code>.env.local.example</code> to <code>.env.local</code>, add your OAuth client
            ID as <code>VITE_GOOGLE_CLIENT_ID</code>, then restart the dev server.
          </span>
        </div>
      )}

      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {clientId && (
      <>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={"tab" + (t.id === tab ? " active" : "")} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "inbox" && <Inbox onError={setError} />}
      {tab === "threads" && <Threads onError={setError} />}
      {tab === "profile" && <ProfileTab onError={setError} />}
      {tab === "raw" && <RawApi onError={setError} />}
      {tab === "auth" && <AuthOnly onError={setError} />}
      </>
      )}
    </main>
  );
}
