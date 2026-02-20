/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as connectors from "../connectors.js";
import type * as connectorsAuth from "../connectorsAuth.js";
import type * as connectorsInternal from "../connectorsInternal.js";
import type * as crons from "../crons.js";
import type * as discord from "../discord.js";
import type * as discordRoleConfig from "../discordRoleConfig.js";
import type * as discovery from "../discovery.js";
import type * as http from "../http.js";
import type * as httpConnectors from "../httpConnectors.js";
import type * as httpHelpers from "../httpHelpers.js";
import type * as httpIngest from "../httpIngest.js";
import type * as httpPayments from "../httpPayments.js";
import type * as ingest from "../ingest.js";
import type * as ingestAttachmentMerge from "../ingestAttachmentMerge.js";
import type * as ingestContentMerge from "../ingestContentMerge.js";
import type * as ingestUtils from "../ingestUtils.js";
import type * as mirror from "../mirror.js";
import type * as mirrorQueue from "../mirrorQueue.js";
import type * as payments from "../payments.js";
import type * as paymentsUtils from "../paymentsUtils.js";
import type * as roleSync from "../roleSync.js";
import type * as roleSyncQueue from "../roleSyncQueue.js";
import type * as sellAccessPolicies from "../sellAccessPolicies.js";
import type * as sellProducts from "../sellProducts.js";
import type * as shopCatalog from "../shopCatalog.js";
import type * as shopCatalogUtils from "../shopCatalogUtils.js";
import type * as signals from "../signals.js";
import type * as subscriptionAccess from "../subscriptionAccess.js";
import type * as tierVisibility from "../tierVisibility.js";
import type * as users from "../users.js";
import type * as workerQueueWake from "../workerQueueWake.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  connectors: typeof connectors;
  connectorsAuth: typeof connectorsAuth;
  connectorsInternal: typeof connectorsInternal;
  crons: typeof crons;
  discord: typeof discord;
  discordRoleConfig: typeof discordRoleConfig;
  discovery: typeof discovery;
  http: typeof http;
  httpConnectors: typeof httpConnectors;
  httpHelpers: typeof httpHelpers;
  httpIngest: typeof httpIngest;
  httpPayments: typeof httpPayments;
  ingest: typeof ingest;
  ingestAttachmentMerge: typeof ingestAttachmentMerge;
  ingestContentMerge: typeof ingestContentMerge;
  ingestUtils: typeof ingestUtils;
  mirror: typeof mirror;
  mirrorQueue: typeof mirrorQueue;
  payments: typeof payments;
  paymentsUtils: typeof paymentsUtils;
  roleSync: typeof roleSync;
  roleSyncQueue: typeof roleSyncQueue;
  sellAccessPolicies: typeof sellAccessPolicies;
  sellProducts: typeof sellProducts;
  shopCatalog: typeof shopCatalog;
  shopCatalogUtils: typeof shopCatalogUtils;
  signals: typeof signals;
  subscriptionAccess: typeof subscriptionAccess;
  tierVisibility: typeof tierVisibility;
  users: typeof users;
  workerQueueWake: typeof workerQueueWake;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
