"use client";

import { createContext, useContext, type ReactNode } from "react";

import { appConfig } from "@/src/config/app.config";
import type { ApplicationChrome } from "@/src/modules/admin/data/get-application-chrome";

const ApplicationChromeContext = createContext<ApplicationChrome>({
  displayName: appConfig.displayName,
  shortName: appConfig.shortName,
  organizationName: appConfig.organizationName,
  organizationCode: appConfig.shortName,
});

export function ApplicationChromeProvider({
  children,
  chrome,
}: {
  children: ReactNode;
  chrome: ApplicationChrome;
}) {
  return (
    <ApplicationChromeContext.Provider value={chrome}>
      {children}
    </ApplicationChromeContext.Provider>
  );
}

export function useApplicationChrome(): ApplicationChrome {
  return useContext(ApplicationChromeContext);
}
