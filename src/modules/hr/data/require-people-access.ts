import { notFound, redirect } from "next/navigation";

import {
  getUserCapabilities,
  type UserCapabilities,
} from "@/src/modules/auth/data/get-user-capabilities";
import { resolveEmployeeSupervisor } from "@/src/modules/hr/data/resolve-employee-supervisor";

export async function requireAuthenticatedCapabilities(): Promise<UserCapabilities> {
  const capabilities = await getUserCapabilities();

  if (!capabilities) {
    redirect("/login");
  }

  return capabilities;
}

export async function requirePeopleDirectoryAccess(): Promise<UserCapabilities> {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.canAny("people.directory.view", "people.manage")) {
    if (capabilities.employeeId) {
      redirect("/me");
    }

    redirect("/");
  }

  return capabilities;
}

export async function requirePeopleManageAccess(): Promise<UserCapabilities> {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.can("people.manage")) {
    notFound();
  }

  return capabilities;
}

/** Create / amend / renew / close / mark-collected contract routes. */
export async function requireContractManageAccess(): Promise<UserCapabilities> {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.canAny("people.manage", "contracts.manage")) {
    notFound();
  }

  return capabilities;
}

export async function requireLeaveBalancesAccess(): Promise<UserCapabilities> {
  const capabilities = await requireAuthenticatedCapabilities();

  // leave.approve: reporting officers following forfeiture / leave alerts
  if (
    !capabilities.canAny("leave.manage", "people.manage", "leave.approve")
  ) {
    notFound();
  }

  return capabilities;
}

/** Leave type / entitlement configuration. */
export async function requireLeaveManageAccess(): Promise<UserCapabilities> {
  const capabilities = await requireAuthenticatedCapabilities();

  if (!capabilities.can("leave.manage")) {
    notFound();
  }

  return capabilities;
}

/** Contract monitoring dashboard and org-wide contract lists. */
export async function requireContractViewAccess(): Promise<UserCapabilities> {
  const capabilities = await requireAuthenticatedCapabilities();

  if (
    !capabilities.canAny("contracts.view", "contracts.manage", "people.manage")
  ) {
    notFound();
  }

  return capabilities;
}

/** Create / edit org structure (departments, positions). */
export async function requireStructureManageAccess(): Promise<UserCapabilities> {
  return requirePeopleManageAccess();
}

export type EmployeeProfileAccess = {
  capabilities: UserCapabilities;
  isOwnProfile: boolean;
  canManage: boolean;
  showPeopleNav: boolean;
};

export type EmployeeContractAccess = {
  capabilities: UserCapabilities;
  isOwnProfile: boolean;
  canManage: boolean;
  showPeopleNav: boolean;
  /** Own contracts via profile.view_own without people.manage. */
  isSelfService: boolean;
};

export async function resolveEmployeeProfileAccess(
  employeeId: string,
): Promise<EmployeeProfileAccess> {
  const capabilities = await requireAuthenticatedCapabilities();
  const isOwnProfile = capabilities.employeeId === employeeId;
  const showPeopleNav = capabilities.canAny(
    "people.directory.view",
    "people.manage",
  );

  if (!isOwnProfile && !showPeopleNav) {
    notFound();
  }

  if (isOwnProfile && !showPeopleNav) {
    if (!capabilities.can("people.profile.view_own")) {
      notFound();
    }

    redirect("/me");
  }

  return {
    capabilities,
    isOwnProfile,
    canManage: capabilities.can("people.manage"),
    showPeopleNav,
  };
}

/**
 * Contract list/detail reads: HR manage, contracts.manage, or own
 * employee with profile.view_own. Create/amend/renew/close routes use
 * requireContractManageAccess().
 */
export async function resolveEmployeeContractAccess(
  employeeId: string,
): Promise<EmployeeContractAccess> {
  const capabilities = await requireAuthenticatedCapabilities();
  const isOwnProfile = capabilities.employeeId === employeeId;
  const canManage = capabilities.can("people.manage");
  const showPeopleNav = capabilities.canAny(
    "people.directory.view",
    "people.manage",
  );

  if (canManage) {
    return {
      capabilities,
      isOwnProfile,
      canManage: true,
      showPeopleNav,
      isSelfService: false,
    };
  }

  if (capabilities.can("contracts.manage")) {
    return {
      capabilities,
      isOwnProfile,
      canManage: true,
      showPeopleNav: showPeopleNav || capabilities.can("contracts.view"),
      isSelfService: false,
    };
  }

  if (isOwnProfile && capabilities.can("people.profile.view_own")) {
    return {
      capabilities,
      isOwnProfile: true,
      canManage: false,
      showPeopleNav: false,
      isSelfService: true,
    };
  }

  notFound();
}

export type EmployeeCorrespondenceAccess = {
  capabilities: UserCapabilities;
  isOwnProfile: boolean;
  canManage: boolean;
  showPeopleNav: boolean;
  isSelfService: boolean;
  /** Read-only supervisor access to managerVisible issued items. */
  isManagerView: boolean;
};

/**
 * Employee file / correspondence: HR via people.manage, own
 * employee with people.profile.view_own, or reporting officer for
 * managerVisible issued items (read-only).
 */
export async function resolveEmployeeCorrespondenceAccess(
  employeeId: string,
): Promise<EmployeeCorrespondenceAccess> {
  const capabilities = await requireAuthenticatedCapabilities();
  const isOwnProfile = capabilities.employeeId === employeeId;
  const canManage = capabilities.can("people.manage");
  const showPeopleNav = capabilities.canAny(
    "people.directory.view",
    "people.manage",
  );

  if (canManage) {
    return {
      capabilities,
      isOwnProfile,
      canManage: true,
      showPeopleNav,
      isSelfService: false,
      isManagerView: false,
    };
  }

  if (isOwnProfile && capabilities.can("people.profile.view_own")) {
    return {
      capabilities,
      isOwnProfile: true,
      canManage: false,
      showPeopleNav: false,
      isSelfService: true,
      isManagerView: false,
    };
  }

  if (capabilities.employeeId) {
    const supervisor = await resolveEmployeeSupervisor(employeeId);

    if (
      supervisor?.supervisorEmployeeId === capabilities.employeeId &&
      capabilities.can("people.profile.view_own")
    ) {
      return {
        capabilities,
        isOwnProfile: false,
        canManage: false,
        showPeopleNav,
        isSelfService: false,
        isManagerView: true,
      };
    }
  }

  notFound();
}
