"use client"

import {
  createContext,
  useContext,
  type ReactNode,
} from "react"

import type { CurrentUser } from "@/src/modules/auth/data/get-current-user"

export type AuthCapabilities = {
  permissions: string[]
  roleCodes: string[]
  employeeId: string | null
  isSystemAdmin: boolean
  isHrAdmin: boolean
  isEmployeeOnly: boolean
}

type AuthContextValue = {
  user: CurrentUser | null
  capabilities: AuthCapabilities | null
  can: (permission: string) => boolean
  canAny: (...permissions: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  capabilities: null,
  can: () => false,
  canAny: () => false,
})

export function AuthProvider({
  children,
  user,
  capabilities,
}: {
  children: ReactNode
  user: CurrentUser | null
  capabilities: AuthCapabilities | null
}) {
  const isSystemAdmin = capabilities?.isSystemAdmin ?? false
  const permissionSet = new Set(capabilities?.permissions ?? [])

  function can(permission: string) {
    return isSystemAdmin || permissionSet.has(permission)
  }

  function canAny(...permissions: string[]) {
    return (
      isSystemAdmin ||
      permissions.some((permission) =>
        permissionSet.has(permission),
      )
    )
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        capabilities,
        can,
        canAny,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
