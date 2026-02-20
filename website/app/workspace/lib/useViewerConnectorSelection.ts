"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  parseConnectorSelection,
  resolvePreferredConnectorSelection,
  serializeConnectorSelection,
  type ConnectorSelection,
  type ViewerConnectorOption,
} from "./connectorSelection";

const CONNECTOR_SELECTION_STORAGE_KEY = "workspace.selected_connector";

const listViewerConnectorOptionsRef = makeFunctionReference<
  "query",
  Record<string, never>,
  ViewerConnectorOption[]
>("signals:listViewerConnectorOptions");

type UseViewerConnectorSelectionResult = {
  connectorOptions: ViewerConnectorOption[] | undefined;
  selectionValue: string;
  tenantKey: string;
  connectorId: string;
  setSelection: (selection: ConnectorSelection) => void;
  setSelectionByValue: (value: string) => void;
};

export function useViewerConnectorSelection(enabled: boolean): UseViewerConnectorSelectionResult {
  const connectorOptions = useQuery(listViewerConnectorOptionsRef, enabled ? {} : "skip");
  const [selection, setSelectionState] = useState<ConnectorSelection | null>(null);
  const [hydratedStorage, setHydratedStorage] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSelectionState(null);
      setHydratedStorage(false);
      return;
    }

    const stored = parseConnectorSelection(
      window.localStorage.getItem(CONNECTOR_SELECTION_STORAGE_KEY),
    );
    setSelectionState(stored);
    setHydratedStorage(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hydratedStorage || !connectorOptions) return;
    const preferred = resolvePreferredConnectorSelection({
      options: connectorOptions,
      currentSelection: selection,
    });
    if (
      preferred?.tenantKey === selection?.tenantKey &&
      preferred?.connectorId === selection?.connectorId
    ) {
      return;
    }

    setSelectionState(preferred);
    if (preferred) {
      console.info(
        `[workspace] selected connector tenant=${preferred.tenantKey} connector=${preferred.connectorId}`,
      );
    } else {
      console.info("[workspace] no visible connector options available");
    }
  }, [
    connectorOptions,
    enabled,
    hydratedStorage,
    selection?.connectorId,
    selection?.tenantKey,
  ]);

  useEffect(() => {
    if (!enabled || !hydratedStorage) return;
    const serialized = selection ? serializeConnectorSelection(selection) : "";
    if (serialized) {
      window.localStorage.setItem(CONNECTOR_SELECTION_STORAGE_KEY, serialized);
    } else {
      window.localStorage.removeItem(CONNECTOR_SELECTION_STORAGE_KEY);
    }
  }, [enabled, hydratedStorage, selection]);

  const setSelection = useCallback((nextSelection: ConnectorSelection) => {
    const tenantKey = nextSelection.tenantKey.trim();
    const connectorId = nextSelection.connectorId.trim();
    if (!tenantKey || !connectorId) {
      setSelectionState(null);
      return;
    }

    setSelectionState({
      tenantKey,
      connectorId,
    });
  }, []);

  const setSelectionByValue = useCallback((value: string) => {
    setSelectionState(parseConnectorSelection(value));
  }, []);

  return useMemo(
    () => ({
      connectorOptions,
      selectionValue: selection ? serializeConnectorSelection(selection) : "",
      tenantKey: selection?.tenantKey ?? "",
      connectorId: selection?.connectorId ?? "",
      setSelection,
      setSelectionByValue,
    }),
    [connectorOptions, selection, setSelection, setSelectionByValue],
  );
}
