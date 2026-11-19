# react-gmail demo

A small React app that exercises every feature of [react-gmail](../..). It has five tabs:

- **Inbox**: lists unread messages, opens one, and renders its parsed body.
- **Threads**: lists threads and opens one to show its messages.
- **Profile**: shows `getProfile()`.
- **Raw API**: calls `gmail.get(path)` for any read-only endpoint.
- **Auth only**: uses a separate `createAuth` instance (its own sign-in, independent of the header) to show the sign-in state and access token that you'd use for other Google APIs.

## Setup

1. Build the library once. The demo installs it from the repo root (`file:../..`), so it reads `dist/`:

   ```bash
   cd ../..
   npm run build
   ```

2. Create a Google OAuth client ID. Follow [Google Cloud setup](../../README.md#google-cloud-setup) in the root README. Add `http://localhost:5173` to the authorised JavaScript origins.

3. Put the client ID in `.env.local`:

   ```bash
   cp .env.local.example .env.local
   # then set VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
   ```

   Without this variable the app still loads, but it shows a notice asking you to set it and disables sign-in.

4. Install and start:

   ```bash
   npm install
   npm run dev
   ```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server on `http://localhost:5173`. |
| `npm run build` | Type-checks and builds to `dist/`. |
| `npm run preview` | Serves the production build locally. |
| `npm run lint` | Runs oxlint. |

## Notes

- The app is in Google's *Testing* mode, so only accounts listed as test users can sign in. See the [root README](../../README.md#google-cloud-setup).
- Tokens live in memory only. Reloading the page means signing in again.
- The demo requests the read-only scope. Change it in `src/gmail.ts` if you need more.
