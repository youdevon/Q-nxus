"use client";

import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader } from "@/src/components/layout/app-header";
import { AppSidebar } from "@/src/components/layout/app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
