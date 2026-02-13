import { Account, Client, Databases, Realtime } from "appwrite";

export type AppwritePublicConfig = {
  endpoint: string;
  projectId: string;
};

export function createBrowserAppwriteClient(config: AppwritePublicConfig) {
  const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    realtime: new Realtime(client)
  };
}
