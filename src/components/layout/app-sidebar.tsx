"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { appConfig } from "@/src/config/app.config"
import { navigationConfig } from "@/src/config/navigation.config"
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
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="data-[slot=sidebar-menu-button]:p-2"
              tooltip={appConfig.displayName}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold tracking-wide text-sidebar-primary-foreground">
                {appConfig.shortName}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                <span className="truncate font-semibold">
                  {appConfig.displayName}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {appConfig.organizationName}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navigationConfig.map((section, index) => (
          <div key={section.id}>
            {index > 0 && <SidebarSeparator className="mx-0" />}
            <SidebarGroup>
              {section.showLabel && (
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const isActive =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    const Icon = item.icon

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
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
