"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { makeFunctionReference } from "convex/server";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useViewerConnectorSelection } from "@/app/workspace/lib/useViewerConnectorSelection";

import type {
  CheckoutDiscordCompletePayload,
  DiscordLinkRow,
  LinkViewerDiscordResult,
  MappingRow,
  SignalState,
  SignalRow,
  UnlinkViewerDiscordResult,
  ViewerRow,
} from "./types";
import { formatRemainingMs, tierRank } from "./utils";
import {
  toUserFacingDiscordCallbackError,
  toUserFacingDiscordError,
} from "@/lib/userFacingErrors";

const viewerRef = makeFunctionReference<"query", Record<string, never>, ViewerRow | null>(
  "users:viewer",
);
const listRecentSignalsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string; limit?: number },
  SignalRow[]
>("signals:listRecent");
const listMappingsRef = makeFunctionReference<
  "query",
  { tenantKey: string; connectorId: string },
  MappingRow[]
>("connectors:listMappings");
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

export function useDashboardController() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUnlinkingDiscord, setIsUnlinkingDiscord] = useState(false);
  const [isCompletingDiscordLink, setIsCompletingDiscordLink] = useState(false);
  const [discordStatusMessage, setDiscordStatusMessage] = useState<string | null>(null);
  const [discordErrorMessage, setDiscordErrorMessage] = useState<string | null>(null);
  const [discordCallbackLinkState, setDiscordCallbackLinkState] = useState<string | null>(null);
  const [discordCallbackError, setDiscordCallbackError] = useState<string | null>(null);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const reminderLogKeyRef = useRef<string | null>(null);

  const viewer = useQuery(viewerRef, isAuthenticated ? {} : "skip");
  const viewerDiscordLink = useQuery(viewerDiscordLinkRef, isAuthenticated ? {} : "skip");
  const linkViewerDiscord = useMutation(linkViewerDiscordRef);
  const unlinkViewerDiscord = useMutation(unlinkViewerDiscordRef);
  const hasSignalAccess = viewer?.hasSignalAccess === true;
  const isDiscordLinked = viewerDiscordLink?.isLinked === true;
  const {
    connectorOptions,
    selectionValue: selectedConnectorValue,
    tenantKey,
    connectorId,
    setSelectionByValue: onConnectorSelectionChange,
  } = useViewerConnectorSelection(isAuthenticated && hasSignalAccess);
  const signals = useQuery(
    listRecentSignalsRef,
    isAuthenticated && hasSignalAccess && tenantKey && connectorId
      ? { tenantKey, connectorId, limit: 50 }
      : "skip",
  );
  const mappings = useQuery(
    listMappingsRef,
    isAuthenticated && hasSignalAccess && tenantKey && connectorId
      ? { tenantKey, connectorId }
      : "skip",
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?redirectTo=/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!signals) return;
    const attachmentRefs = signals.reduce(
      (total, signal) => total + (signal.attachments?.length ?? 0),
      0,
    );
    console.info(
      `[dashboard] realtime signals update: tenant=${tenantKey} connector=${connectorId} count=${signals.length} attachment_refs=${attachmentRefs}`,
    );
  }, [signals, tenantKey, connectorId]);

  useEffect(() => {
    if (!mappings || !viewer) return;
    const configuredVisible = mappings.filter(
      (mapping) => mapping.dashboardEnabled === true && mapping.minimumTier,
    );
    const visibleForTier = configuredVisible.filter(
      (mapping) => tierRank(viewer.tier) >= tierRank(mapping.minimumTier ?? null),
    );
    console.info(
      `[dashboard] mapping visibility tenant=${tenantKey} connector=${connectorId} tier=${viewer.tier ?? "none"} mappings_total=${mappings.length} configured_visible=${configuredVisible.length} visible_for_tier=${visibleForTier.length}`,
    );
  }, [mappings, viewer, tenantKey, connectorId]);

  useEffect(() => {
    if (!viewer) return;
    console.info(
      `[dashboard] access gate status user=${viewer.userId} subscription=${viewer.subscriptionStatus ?? "none"} tier=${viewer.tier ?? "none"} ends_at=${viewer.subscriptionEndsAt ?? 0} allowed=${viewer.hasSignalAccess}`,
    );
  }, [viewer]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDiscordCallbackLinkState(params.get("discord_link"));
    setDiscordCallbackError(params.get("discord_error"));
  }, []);

  useEffect(() => {
    if (!discordCallbackError) return;
    console.error(`[dashboard] discord oauth callback error=${discordCallbackError}`);
    setDiscordStatusMessage(null);
    setDiscordErrorMessage(toUserFacingDiscordCallbackError(discordCallbackError));
  }, [discordCallbackError]);

  useEffect(() => {
    if (discordCallbackLinkState !== "complete" || !isAuthenticated) {
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
        const payload = (await response.json().catch(() => null)) as CheckoutDiscordCompletePayload | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message ?? "OAuth completion failed");
        }

        const discordUserId =
          typeof payload.discord_user_id === "string" ? payload.discord_user_id.trim() : "";
        if (!discordUserId) {
          throw new Error("Missing Discord user id from OAuth result");
        }

        await linkViewerDiscord({
          discordUserId,
          username: typeof payload.username === "string" ? payload.username : undefined,
          linkedAt: typeof payload.linked_at === "number" ? payload.linked_at : Date.now(),
        });

        if (!cancelled) {
          setDiscordStatusMessage("Discord account linked successfully.");
          setDiscordErrorMessage(null);
          setDiscordCallbackError(null);
          setDiscordCallbackLinkState(null);
          console.info(`[dashboard] discord link completed discord_user=${discordUserId}`);
          window.history.replaceState(null, "", "/dashboard");
        }
      } catch (error) {
        const message = toUserFacingDiscordError(error);
        if (!cancelled) {
          setDiscordStatusMessage(null);
          setDiscordErrorMessage(message);
          setDiscordCallbackError(null);
          setDiscordCallbackLinkState(null);
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
  }, [discordCallbackLinkState, isAuthenticated, linkViewerDiscord]);

  const onLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
      router.replace("/");
      setIsLoggingOut(false);
    }
  }, [router, signOut]);

  const onStartDiscordLink = useCallback(() => {
    setDiscordErrorMessage(null);
    setDiscordStatusMessage(null);
    console.info("[dashboard] starting discord oauth flow");
    window.location.href = "/api/auth/discord/start?redirect=" + encodeURIComponent("/dashboard");
  }, []);

  const onUnlinkDiscord = useCallback(async () => {
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
      const message = toUserFacingDiscordError(error);
      setDiscordErrorMessage(message);
      console.error(`[dashboard] discord unlink failed: ${message}`);
    } finally {
      setIsUnlinkingDiscord(false);
    }
  }, [unlinkViewerDiscord]);

  const remainingMs = viewer?.subscriptionEndsAt ? viewer.subscriptionEndsAt - countdownNow : null;
  const hasRemainingTime = typeof remainingMs === "number" && remainingMs > 0;
  const remainingText = typeof remainingMs === "number" ? formatRemainingMs(remainingMs) : null;
  const isEndingWithinOneDay =
    viewer?.subscriptionStatus === "active" &&
    typeof remainingMs === "number" &&
    remainingMs > 0 &&
    remainingMs <= 24 * 60 * 60 * 1000;
  const renewalReminderText = isEndingWithinOneDay
    ? `Your subscription ends in ${remainingText}. Renew now to avoid access interruption.`
    : null;
  const configuredVisibleMappings = (mappings ?? []).filter(
    (mapping) => mapping.dashboardEnabled === true && mapping.minimumTier,
  );
  const visibleMappingsForTier = configuredVisibleMappings.filter(
    (mapping) => tierRank(viewer?.tier ?? null) >= tierRank(mapping.minimumTier ?? null),
  );
  const lockedMappings = Math.max(0, configuredVisibleMappings.length - visibleMappingsForTier.length);

  const signalState = useMemo<SignalState>(() => {
    if (!hasSignalAccess) return "no_access";
    if (connectorOptions === undefined) return "loading";
    if (connectorOptions.length === 0) return "no_visible_config";
    if (!selectedConnectorValue || !tenantKey || !connectorId) return "loading";
    if (!signals) return "loading";
    if (signals.length > 0) return "has_signals";
    if (configuredVisibleMappings.length === 0) return "no_visible_config";
    if (visibleMappingsForTier.length === 0) return "tier_locked";
    return "empty";
  }, [
    configuredVisibleMappings.length,
    connectorId,
    connectorOptions,
    hasSignalAccess,
    selectedConnectorValue,
    signals,
    tenantKey,
    visibleMappingsForTier.length,
  ]);

  useEffect(() => {
    if (!viewer || !viewer.subscriptionEndsAt || !isEndingWithinOneDay) return;
    const reminderKey = `${viewer.userId}:${viewer.subscriptionEndsAt}`;
    if (reminderLogKeyRef.current === reminderKey) return;
    reminderLogKeyRef.current = reminderKey;
    console.info(
      `[dashboard/notifications] renewal reminder user=${viewer.userId} tier=${viewer.tier ?? "none"} ends_at=${viewer.subscriptionEndsAt} remaining=${remainingText ?? "unknown"}`,
    );
  }, [isEndingWithinOneDay, remainingText, viewer]);

  return {
    isAuthenticated,
    isLoading,
    viewer,
    viewerDiscordLink,
    hasSignalAccess,
    isDiscordLinked,
    signals,
    connectorOptions,
    selectedConnectorValue,
    tenantKey,
    connectorId,
    onConnectorSelectionChange,
    isLoggingOut,
    onLogout,
    isUnlinkingDiscord,
    isCompletingDiscordLink,
    onStartDiscordLink,
    onUnlinkDiscord,
    discordStatusMessage,
    discordErrorMessage,
    configuredVisibleMappings,
    visibleMappingsForTier,
    lockedMappings,
    remainingText,
    hasRemainingTime,
    isEndingWithinOneDay,
    renewalReminderText,
    signalState,
  };
}

export type DashboardControllerState = ReturnType<typeof useDashboardController>;
