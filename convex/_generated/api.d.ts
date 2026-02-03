/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as agents from "../agents.js";
import type * as cleanup from "../cleanup.js";
import type * as decisions from "../decisions.js";
import type * as documents from "../documents.js";
import type * as domain from "../domain.js";
import type * as http from "../http.js";
import type * as internals from "../internals.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as subscriptions from "../subscriptions.js";
import type * as tasks from "../tasks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  agents: typeof agents;
  cleanup: typeof cleanup;
  decisions: typeof decisions;
  documents: typeof documents;
  domain: typeof domain;
  http: typeof http;
  internals: typeof internals;
  messages: typeof messages;
  notifications: typeof notifications;
  subscriptions: typeof subscriptions;
  tasks: typeof tasks;
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
