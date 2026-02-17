"use client";

import { useDashboardController } from "@/app/dashboard/useDashboardController";

export function useOverviewController() {
  return useDashboardController();
}

export type OverviewControllerState = ReturnType<typeof useOverviewController>;

