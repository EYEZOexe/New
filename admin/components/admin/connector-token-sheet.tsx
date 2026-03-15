"use client";

import { useEffect, useState } from "react";
import { makeFunctionReference } from "convex/server";
import { useMutation } from "convex/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type ConnectorTokenSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantKey?: string;
  connectorId?: string;
};

const rotateTokenRef = makeFunctionReference<
  "mutation",
  { tenantKey: string; connectorId: string },
  { token: string }
>("connectors:rotateConnectorToken");

export function ConnectorTokenSheet({
  open,
  onOpenChange,
  tenantKey,
  connectorId,
}: ConnectorTokenSheetProps) {
  const [localTenantKey, setLocalTenantKey] = useState(tenantKey ?? "");
  const [localConnectorId, setLocalConnectorId] = useState(connectorId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultToken, setResultToken] = useState<string | null>(null);

  const rotateToken = useMutation(rotateTokenRef);

  useEffect(() => {
    if (!open) {
      setLocalTenantKey(tenantKey ?? "");
      setLocalConnectorId(connectorId ?? "");
      setIsSubmitting(false);
      setError(null);
      setResultToken(null);
    }
  }, [open, tenantKey, connectorId]);

  async function handleSubmit() {
    const tk = tenantKey ?? localTenantKey;
    const cid = connectorId ?? localConnectorId;

    if (!tk.trim() || !cid.trim()) {
      setError("Tenant key and connector ID are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResultToken(null);

    try {
      const result = await rotateToken({ tenantKey: tk.trim(), connectorId: cid.trim() });
      setResultToken(result.token);
      console.info(
        `[admin/connector-token-sheet] token rotated tenant=${tk} connector=${cid}`,
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to rotate token.";
      setError(text);
      console.error(
        `[admin/connector-token-sheet] rotate failed tenant=${tk} connector=${cid} error=${text}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(resultToken!);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Create / Rotate Token</SheetTitle>
          <SheetDescription>
            Enter a tenant key and connector ID to create or rotate the connector token.
          </SheetDescription>
        </SheetHeader>

        <div className="p-6">
          <div className="space-y-4">
            <label className="admin-label">
              Tenant
              <input
                type="text"
                className="admin-input"
                value={tenantKey ?? localTenantKey}
                readOnly={tenantKey !== undefined}
                onChange={
                  tenantKey !== undefined
                    ? undefined
                    : (e) => setLocalTenantKey(e.target.value)
                }
                placeholder="e.g. my-tenant"
              />
            </label>

            <label className="admin-label">
              Connector ID
              <input
                type="text"
                className="admin-input"
                value={connectorId ?? localConnectorId}
                readOnly={connectorId !== undefined}
                onChange={
                  connectorId !== undefined
                    ? undefined
                    : (e) => setLocalConnectorId(e.target.value)
                }
                placeholder="e.g. connector-abc"
              />
            </label>

            {error ? (
              <p className="text-sm text-rose-400">{error}</p>
            ) : null}

            {resultToken ? (
              <div className="space-y-3">
                <label className="admin-label">
                  Token
                  <code className="admin-input block break-all font-mono text-xs">
                    {resultToken}
                  </code>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => void handleCopy()}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    className="admin-btn-primary"
                    onClick={() => onOpenChange(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="admin-btn-primary"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Rotating\u2026" : "Create / Rotate"}
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
