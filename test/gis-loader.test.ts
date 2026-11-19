// Separate file: the Google script loader caches its state per module instance.
import { expect, it, vi } from "vitest";
import { createGmailClient } from "../src";

const gisScripts = () => document.head.querySelectorAll<HTMLScriptElement>('script[src*="accounts.google.com/gsi"]');

it("blocked Google script (ad blocker, CSP, offline) -> network error, and a retry loads it", async () => {
  const c = createGmailClient({ clientId: "cid" });

  const first = c.signIn();
  expect(gisScripts()).toHaveLength(1);
  gisScripts()[0]!.onerror!(new Event("error"));
  await expect(first).rejects.toMatchObject({ code: "network" });

  const second = c.signIn();
  expect(gisScripts()).toHaveLength(2);
  vi.stubGlobal("google", {
    accounts: {
      oauth2: {
        initTokenClient: (cfg: any) => ({
          requestAccessToken: () => cfg.callback({ access_token: "tok", expires_in: "3600" }),
        }),
      },
    },
  });
  gisScripts()[1]!.onload!(new Event("load"));
  await second;
  expect(c.isSignedIn()).toBe(true);
  vi.unstubAllGlobals();
});
