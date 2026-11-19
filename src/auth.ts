import { err } from "./error";

const SRC = "https://accounts.google.com/gsi/client";
let loading: Promise<void> | undefined;

const loadGis = () =>
  (loading ??= new Promise<void>((ok, fail) => {
    if (window.google?.accounts?.oauth2) return ok();
    const s = document.createElement("script");
    s.src = SRC;
    s.onload = () => ok();
    s.onerror = () => {
      loading = undefined;
      fail(err("network", "Failed to load Google Identity Services"));
    };
    document.head.append(s);
  }));

export function createAuth(clientId: string, scope: string) {
  let token = "";
  let exp = 0;
  const subs = new Set<(s: boolean) => void>();
  const isSignedIn = () => !!token && Date.now() < exp - 1e4;
  const emit = () => subs.forEach((f) => f(isSignedIn()));

  return {
    isSignedIn,
    /** Valid token or throws not_authenticated. Never opens a popup. */
    token() {
      if (!isSignedIn()) throw err("not_authenticated", "Not signed in or token expired");
      return token;
    },
    /** Opens the consent popup (call from a user gesture). */
    async signIn() {
      await loadGis();
      await new Promise<void>((ok, fail) =>
        google.accounts.oauth2
          .initTokenClient({
            client_id: clientId,
            scope,
            callback: (r) => {
              if (!r.access_token) return fail(err("auth_failed", r.error_description || r.error || "Sign-in failed"));
              token = r.access_token;
              exp = Date.now() + +r.expires_in * 1e3;
              emit();
              ok();
            },
            error_callback: (e) => fail(err("auth_failed", e.message || e.type)),
          })
          .requestAccessToken(),
      );
    },
    signOut() {
      if (token) google.accounts.oauth2.revoke(token, () => {});
      token = "";
      emit();
    },
    onAuthChange(f: (s: boolean) => void) {
      subs.add(f);
      return () => void subs.delete(f);
    },
  };
}
