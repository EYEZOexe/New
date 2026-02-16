"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { makeFunctionReference } from "convex/server";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SignalRow = {
  _id: string;
  createdAt: number;
  editedAt?: number;
  deletedAt?: number;
  sourceGuildId: string;
  sourceChannelId: string;
  content: string;
  attachments?: Array<{ url: string; name?: string }>;
};

type ViewerRow = {
  userId: string;
  email: string | null;
  name: string | null;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due" | null;
  hasSignalAccess: boolean;
};

type DiscordLinkRow = {
  isLinked: boolean;
  discordUserId: string | null;
  username: string | null;
  linkedAt: number | null;
};

type LinkViewerDiscordResult = {
  ok: boolean;
  isLinked: boolean;
  discordUserId: string;
  username: string | null;
  linkedAt: number;
};

type UnlinkViewerDiscordResult = {
  ok: boolean;
  unlinked: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUnlinkingDiscord, setIsUnlinkingDiscord] = useState(false);
  const [isCompletingDiscordLink, setIsCompletingDiscordLink] = useState(false);
  const [discordStatusMessage, setDiscordStatusMessage] = useState<string | null>(null);
  const [discordErrorMessage, setDiscordErrorMessage] = useState<string | null>(null);
  const [discordCallbackLinkState, setDiscordCallbackLinkState] = useState<string | null>(
    null,
  );
  const [discordCallbackError, setDiscordCallbackError] = useState<string | null>(null);
  const [tenantKey, setTenantKey] = useState("t1");
  const [connectorId, setConnectorId] = useState("conn_01");

  const viewerRef = makeFunctionReference<"query", Record<string, never>, ViewerRow | null>(
    "users:viewer",
  );
  const listRecentSignals = makeFunctionReference<
    "query",
    { tenantKey: string; connectorId: string; limit?: number },
    SignalRow[]
  >("signals:listRecent");
  const viewerDiscordLinkRef = makeFunctionReference<
    "query",
    Record<string, never>,
    DiscordLinkRow | null
  >("discord:viewerLink");
  const linkViewerDiscordRef = makeFunctionReference<
    "mutation",
    { discordUserId: string; username?: string; linkedAt?: number },
    LinkViewerDiscordResult
  >("discord:linkViewerDiscord");
  const unlinkViewerDiscordRef = makeFunctionReference<
    "mutation",
    Record<string, never>,
    UnlinkViewerDiscordResult
  >("discord:unlinkViewerDiscord");
  const viewer = useQuery(viewerRef, isAuthenticated ? {} : "skip");
  const viewerDiscordLink = useQuery(
    viewerDiscordLinkRef,
    isAuthenticated ? {} : "skip",
  );
  const linkViewerDiscord = useMutation(linkViewerDiscordRef);
  const unlinkViewerDiscord = useMutation(unlinkViewerDiscordRef);
  const hasSignalAccess = viewer?.hasSignalAccess === true;
  const isDiscordLinked = viewerDiscordLink?.isLinked === true;
  const signals = useQuery(
    listRecentSignals,
    isAuthenticated && hasSignalAccess ? { tenantKey, connectorId, limit: 50 } : "skip",
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirectTo=/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!signals) return;
    console.info(
      `[dashboard] realtime signals update: tenant=${tenantKey} connector=${connectorId} count=${signals.length}`,
    );
  }, [signals, tenantKey, connectorId]);

  useEffect(() => {
    if (!viewer) return;
    console.info(
      `[dashboard] access gate status user=${viewer.userId} subscription=${viewer.subscriptionStatus ?? "none"} allowed=${viewer.hasSignalAccess}`,
    );
  }, [viewer]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDiscordCallbackLinkState(params.get("discord_link"));
    setDiscordCallbackError(params.get("discord_error"));
  }, []);

  useEffect(() => {
    if (!discordCallbackError) return;
    console.error(
      `[dashboard] discord oauth callback error=${discordCallbackError}`,
    );
    setDiscordStatusMessage(null);
    setDiscordErrorMessage(
      `Discord linking failed (${discordCallbackError.replaceAll("_", " ")}).`,
    );
  }, [discordCallbackError]);

  useEffect(() => {
    if (
      discordCallbackLinkState !== "complete" ||
      !isAuthenticated
    ) {
      return;
    }

    let cancelled = false;
    async function completeDiscordLink() {
      setDiscordErrorMessage(null);
      setDiscordStatusMessage(null);
      setIsCompletingDiscordLink(true);

      try {
        const response = await fetch("/api/auth/discord/complete", {
          method: "POST",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              discord_user_id?: string;
              username?: string | null;
              linked_at?: number;
              message?: string;
            }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message ?? "OAuth completion failed");
        }

        const discordUserId =
          typeof payload.discord_user_id === "string"
            ? payload.discord_user_id.trim()
            : "";
        if (!discordUserId) {
          throw new Error("Missing Discord user id from OAuth result");
        }

        await linkViewerDiscord({
          discordUserId,
          username:
            typeof payload.username === "string" ? payload.username : undefined,
          linkedAt:
            typeof payload.linked_at === "number"
              ? payload.linked_at
              : Date.now(),
        });

        if (!cancelled) {
          setDiscordStatusMessage("Discord account linked successfully.");
          setDiscordErrorMessage(null);
          setDiscordCallbackError(null);
          setDiscordCallbackLinkState(null);
          setIsCompletingDiscordLink(false);
          console.info(
            `[dashboard] discord link completed discord_user=${discordUserId}`,
          );
          window.history.replaceState(null, "", "/dashboard");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Discord linking failed";
        if (!cancelled) {
          setDiscordStatusMessage(null);
          setDiscordErrorMessage(message);
          setDiscordCallbackError(null);
          setDiscordCallbackLinkState(null);
          setIsCompletingDiscordLink(false);
          console.error(`[dashboard] discord link completion failed: ${message}`);
          window.history.replaceState(null, "", "/dashboard");
        }
      } finally {
        if (!cancelled) {
          setIsCompletingDiscordLink(false);
        }
      }
    }

    void completeDiscordLink();

    return () => {
      cancelled = true;
    };
  }, [
    discordCallbackLinkState,
    isAuthenticated,
    linkViewerDiscord,
  ]);

  async function onLogout() {
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
      router.replace("/");
      setIsLoggingOut(false);
    }
  }

  function onStartDiscordLink() {
    setDiscordErrorMessage(null);
    setDiscordStatusMessage(null);
    console.info("[dashboard] starting discord oauth flow");
    window.location.href =
      "/api/auth/discord/start?redirect=" +
      encodeURIComponent("/dashboard");
  }

  async function onUnlinkDiscord() {
    setDiscordErrorMessage(null);
    setDiscordStatusMessage(null);
    setIsUnlinkingDiscord(true);

    try {
      const result = await unlinkViewerDiscord({});
      if (result.unlinked) {
        setDiscordStatusMessage("Discord account unlinked.");
        console.info("[dashboard] discord account unlinked");
      } else {
        setDiscordStatusMessage("No linked Discord account found.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to unlink Discord";
      setDiscordErrorMessage(message);
      console.error(`[dashboard] discord unlink failed: ${message}`);
    } finally {
      setIsUnlinkingDiscord(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <section className="w-full max-w-xl rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-600">Checking session...</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
      <section className="w-full max-w-xl rounded-xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-600">You are signed in.</p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm font-medium text-zinc-900 underline">
            Back to home
          </Link>
        </div>

        <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-medium text-zinc-700">Subscription status</p>
          <p className="mt-1 text-sm text-zinc-900">
            {viewer?.subscriptionStatus ?? "inactive"}
          </p>
          {!hasSignalAccess ? (
            <p className="mt-2 text-xs text-amber-700">
              Signal access is disabled until your subscription is active.
            </p>
          ) : null}
        </div>

        <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-medium text-zinc-700">Discord account</p>
          <p className="mt-1 text-sm text-zinc-900">
            {isDiscordLinked
              ? `${viewerDiscordLink?.username ?? "Linked"} (${viewerDiscordLink?.discordUserId})`
              : "Not linked"}
          </p>
          {viewerDiscordLink?.linkedAt ? (
            <p className="mt-1 text-xs text-zinc-500">
              Linked {new Date(viewerDiscordLink.linkedAt).toLocaleString()}
            </p>
          ) : null}
          {discordStatusMessage ? (
            <p className="mt-2 text-xs text-emerald-700">{discordStatusMessage}</p>
          ) : null}
          {discordErrorMessage ? (
            <p className="mt-2 text-xs text-red-700">{discordErrorMessage}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onStartDiscordLink}
              disabled={isCompletingDiscordLink || isUnlinkingDiscord}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-60"
            >
              {isCompletingDiscordLink ? "Completing link..." : "Connect Discord"}
            </button>
            <button
              type="button"
              onClick={onUnlinkDiscord}
              disabled={
                !isDiscordLinked || isUnlinkingDiscord || isCompletingDiscordLink
              }
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-60"
            >
              {isUnlinkingDiscord ? "Unlinking..." : "Unlink Discord"}
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-6">
          <h2 className="text-base font-semibold text-zinc-900">Signals</h2>

          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Tenant
              <input
                value={tenantKey}
                onChange={(e) => setTenantKey(e.target.value)}
                className="h-9 w-40 rounded-md border border-zinc-300 px-3 text-sm text-zinc-900"
                placeholder="t1"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
              Connector
              <input
                value={connectorId}
                onChange={(e) => setConnectorId(e.target.value)}
                className="h-9 w-40 rounded-md border border-zinc-300 px-3 text-sm text-zinc-900"
                placeholder="conn_01"
              />
            </label>
          </form>

          <div className="mt-4 space-y-3">
            {isAuthenticated && !hasSignalAccess && (
              <p className="text-sm text-zinc-600">
                Access is currently gated by subscription status.
              </p>
            )}
            {!signals && hasSignalAccess && (
              <p className="text-sm text-zinc-600">Loading signals...</p>
            )}
            {signals?.length === 0 && (
              <p className="text-sm text-zinc-600">No signals yet.</p>
            )}
            {signals?.map((signal) => (
              <article
                key={signal._id}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-zinc-700">
                    {new Date(signal.createdAt).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {signal.sourceGuildId} / {signal.sourceChannelId}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-900">
                  {signal.content}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  {signal.editedAt ? (
                    <span className="rounded bg-zinc-200 px-2 py-0.5">
                      Edited {new Date(signal.editedAt).toLocaleString()}
                    </span>
                  ) : null}
                  {signal.deletedAt ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">
                      Deleted {new Date(signal.deletedAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                {signal.attachments?.length ? (
                  <ul className="mt-3 space-y-1">
                    {signal.attachments.map((a, idx) => (
                      <li key={`${signal._id}-a-${idx}`} className="text-xs">
                        <a
                          className="text-zinc-900 underline"
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {a.name ?? a.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

