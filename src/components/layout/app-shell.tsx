"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader } from "@/src/components/layout/app-header";
import { AppSidebar } from "@/src/components/layout/app-sidebar";
import { PageTransition } from "@/src/components/layout/page-transition";
import { UI_SURFACE } from "@/src/config/ui-typography";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-x-clip",
              UI_SURFACE.contentCanvas,
            )}
          >
            <PageTransition>{children}</PageTransition>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
