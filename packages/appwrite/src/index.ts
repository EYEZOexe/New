import { Account, Client, Databases, Realtime, Teams } from "appwrite";

export type AppwritePublicConfig = {
  endpoint: string;
  projectId: string;
};

/**
 * Browser-safe Appwrite client.
 *
 * Note: This relies on Appwrite's own session cookies (set on the Appwrite
 * endpoint domain). For SSR auth in Next.js, we typically use a custom cookie
 * and the `node-appwrite` SDK on the server.
 */
export function createBrowserAppwriteClient(config: AppwritePublicConfig) {
  const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    realtime: new Realtime(client),
    teams: new Teams(client)
  };
}

export type BrowserAppwriteClient = ReturnType<typeof createBrowserAppwriteClient>;
