"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { filterNavigationForCapabilities } from "@/src/config/navigation.config";
import { useApplicationChrome } from "@/src/core/providers/application-chrome-provider";
import { useAuth } from "@/src/modules/auth/context/auth-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();
  const { canAny } = useAuth();
  const chrome = useApplicationChrome();
  const sections = filterNavigationForCapabilities(canAny);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="data-[slot=sidebar-menu-button]:p-2"
              tooltip={chrome.organizationName}
            >
              <span className="truncate font-semibold">
                {chrome.shortName}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section, index) => (
          <div key={section.id}>
            {index > 0 && <SidebarSeparator className="mx-0" />}
            <SidebarGroup>
              {section.showLabel && (
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const activePrefix = item.matchPrefix ?? item.href;
                    const isActive =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(activePrefix);
                    const Icon = item.icon;

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={isActive}
                          tooltip={item.title}
                        >
                          <Icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
