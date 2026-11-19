# react-gmail

Tiny, typed Gmail API client for the browser, built on [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/overview). Works with React or any other framework.

- **Zero dependencies.** Your bundle only gets what you import:

  | Import | Size (min + gzip) |
  |---|---|
  | `createGmailClient` (sign-in + Gmail API) | ~0.99 kB |
  | `createAuth` (sign-in only) | ~0.55 kB |
  | `parseMessage` (message parsing only) | ~0.39 kB |
  | everything | ~1.48 kB |

- **Modern Google sign-in.** Uses Google Identity Services, which replaced the shut-down `gapi.auth2`.
- **Fully typed.** TypeScript types for messages, threads, profile and errors.
- **Safe defaults.** Read-only scope, token kept in memory only, revoked on sign-out.

> **Upgrading from 1.x?** 1.x is broken because Google shut down `gapi.auth2`. See [Migrating from 1.x](#migrating-from-1x).

## Install

```bash
npm install react-gmail
```

The package is ESM-only and runs in the browser. Any modern bundler (Vite, webpack, Next.js, …) works.

## Google Cloud setup

1. In [Google Cloud Console](https://console.cloud.google.com), create or pick a project.
2. **APIs & Services → Library**: enable **Gmail API**.
3. **OAuth consent screen**: set it up. While it is in *Testing*, add your Google accounts under **Test users**.
4. **Credentials → Create credentials → OAuth client ID → Web application.** Add your app's origin (e.g. `http://localhost:5173`) to **Authorized JavaScript origins**. Copy the **Client ID**.

You don't need an API key. The client ID isn't a secret and is safe to ship in front-end code.

> `gmail.readonly` is a [restricted scope](https://developers.google.com/gmail/api/auth/scopes). In *Testing* mode only your listed test users (up to 100) can sign in. Opening it to everyone requires Google's app verification, including a security assessment.

## Quick start

```ts
import { createGmailClient, parseMessage } from "react-gmail";

const gmail = createGmailClient({ clientId: "YOUR_CLIENT_ID.apps.googleusercontent.com" });

// Must be called from a user action (click), because it opens Google's popup.
button.onclick = async () => {
  await gmail.signIn();

  const profile = await gmail.getProfile();
  const { items } = await gmail.listMessages({ q: "is:unread", maxResults: 5 });
  const messages = await Promise.all(items.map((m) => gmail.getMessage(m.id)));

  console.log(profile.emailAddress, messages.map(parseMessage));
};
```

### React

Create one client outside your components. Read the sign-in state with `useSyncExternalStore`, so you don't need a provider or context:

```tsx
import { useState, useSyncExternalStore } from "react";
import { createGmailClient, parseMessage, type ParsedMessage } from "react-gmail";

const gmail = createGmailClient({ clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID });

export function Inbox() {
  const signedIn = useSyncExternalStore(gmail.onAuthChange, gmail.isSignedIn);
  const [messages, setMessages] = useState<ParsedMessage[]>([]);

  const load = async () => {
    const { items } = await gmail.listMessages({ q: "is:unread", maxResults: 10 });
    const full = await Promise.all(items.map((m) => gmail.getMessage(m.id)));
    setMessages(full.map(parseMessage));
  };

  if (!signedIn) return <button onClick={() => gmail.signIn()}>Sign in with Google</button>;

  return (
    <>
      <button onClick={load}>Load unread</button>
      <button onClick={() => gmail.signOut()}>Sign out</button>
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            <b>{m.subject}</b> from {m.from}: {m.snippet}
          </li>
        ))}
      </ul>
    </>
  );
}
```

A demo that uses every feature is in [`examples/react-app`](examples/react-app).

## API

### `createGmailClient({ clientId, scopes? })`

`scopes` defaults to `[DEFAULT_SCOPE]` (`https://www.googleapis.com/auth/gmail.readonly`). Returns:

**Auth**

| Method | Description |
|---|---|
| `signIn(): Promise<void>` | Opens Google's consent popup. Call it from a click handler. |
| `signOut(): void` | Clears and revokes the token. |
| `isSignedIn(): boolean` | `false` before sign-in and after the token expires (~1 hour). |
| `onAuthChange(cb): () => void` | Calls `cb(signedIn)` on sign-in and sign-out. Returns an unsubscribe function. |

**Gmail API** (all calls go to `users/me`)

| Method | Returns |
|---|---|
| `getProfile()` | `{ emailAddress, messagesTotal, threadsTotal, historyId }` |
| `listMessages({ q?, maxResults?, labelIds?, pageToken? })` | `{ items: { id, threadId }[], nextPageToken? }` |
| `getMessage(id, format?)` | Raw `Message`. `format` is `"full"` (default), `"metadata"` or `"minimal"`. |
| `listThreads(params?)` | `{ items: Thread[], nextPageToken? }` |
| `getThread(id)` | `Thread` with its `messages` |
| `get(path, query?)` | Any other read endpoint, e.g. `get("labels")` or `get("history", { startHistoryId })` |

`maxResults` defaults to 10. `q` uses [Gmail search syntax](https://support.google.com/mail/answer/7190) (`is:unread from:alice has:attachment`). To get the next page, pass `nextPageToken` back as `pageToken`.

### `parseMessage(message)`

Turns a raw `Message` from `getMessage` (with format `"full"`) into:

```ts
{
  id, threadId, snippet,
  from?, to?, subject?, date?,          // headers
  text, html,                           // decoded bodies, UTF-8 safe, nested multipart supported
  attachments: { filename, mimeType, size, attachmentId? }[]
}
```

Also exported: `getHeader(message, name)` (header lookup, case-insensitive) and `decodeBase64Url(data)` (Gmail's base64url to a UTF-8 string).

### `createAuth(clientId, scope)`

Sign-in only, for calling other Google APIs yourself. It has the same auth methods as the client, plus `token()`, which returns the access token or throws `not_authenticated`.

```ts
const auth = createAuth(CLIENT_ID, "https://www.googleapis.com/auth/calendar.readonly");
await auth.signIn();
await fetch(url, { headers: { Authorization: `Bearer ${auth.token()}` } });
```

### Errors

Every failure is an `Error` with a `code`, and a `status` for HTTP errors:

| `code` | When |
|---|---|
| `not_authenticated` | Not signed in, the token expired, or Google rejected it (401). Call `signIn()` again. |
| `auth_failed` | The user closed the popup or denied access. |
| `api_error` | Gmail returned an error. Check `status` and `message`. |
| `network` | Offline, or Google's sign-in script was blocked (ad blocker, CSP). |

```ts
try {
  await gmail.getProfile();
} catch (e) {
  if ((e as GmailError).code === "not_authenticated") showSignInButton();
}
```

## Security

- **Email HTML is untrusted.** Never put `parseMessage().html` into `innerHTML` or `dangerouslySetInnerHTML`. Render it in a sandboxed iframe (`<iframe sandbox="" srcDoc={html} />`) or clean it first with a sanitizer such as [DOMPurify](https://github.com/cure53/DOMPurify). Treat `from`, `subject` and attachment filenames as untrusted too, if you render them outside React.
- **Tokens stay in memory.** They are never written to `localStorage` or cookies and are only sent to `gmail.googleapis.com`. A page reload means signing in again.
- **Request only the scopes you need.** The default is read-only.
- **Content Security Policy.** If your app uses a CSP, allow Google's sign-in script and the Gmail API. Check [Google's CSP guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#content_security_policy) for the current list.
  ```
  script-src https://accounts.google.com/gsi/client;
  frame-src  https://accounts.google.com/gsi/;
  connect-src https://accounts.google.com/gsi/ https://oauth2.googleapis.com https://gmail.googleapis.com;
  ```

## Migrating from 1.x

2.0 is a rewrite with a new API. 1.x relied on `gapi.auth2`, which Google shut down, so it can no longer sign in.

| 1.x | 2.x |
|---|---|
| `gmail.config.json` in your app root | `createGmailClient({ clientId })` |
| `import gmailApi from "react-gmail"` (singleton) | `const gmail = createGmailClient(...)` |
| `handleSignIn()` / `handleSignOut()` | `signIn()` / `signOut()` |
| `listenSign(cb)`, `gmailApi.signIn` | `onAuthChange(cb)`, `isSignedIn()` |
| `getProfile()` | `getProfile()` (returns the data directly, not `{ result }`) |
| `getMessageIds(unread, max)` | `listMessages({ q: "is:unread", maxResults })` |
| `getMessagesByIds(ids)` / `getMessages(...)` | `Promise.all(ids.map(gmail.getMessage))` |
| `getThreadsList(...)` / `getThreads(id)` | `listThreads(...)` / `getThread(id)` |
| `getArrayOfIds(res)` | `items.map((m) => m.id)` |
| `normalizeData`, `getBody`, `getMetaFromHeaders` | `parseMessage(message)` |

Also changed:
- Responses are returned directly instead of wrapped in `{ result }`.
- Errors are typed with a `code` instead of showing a built-in notification popup.

## License

MIT
