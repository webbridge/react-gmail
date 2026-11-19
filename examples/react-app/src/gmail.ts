import { DEFAULT_SCOPE, createAuth, createGmailClient } from "react-gmail";

// Clients live in their own module so hot reload of App.tsx doesn't recreate them (tokens are in memory).
export const clientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

// One Gmail client and one auth-only instance for the whole app.
export const gmail = createGmailClient({ clientId });
export const auth = createAuth(clientId, DEFAULT_SCOPE);
