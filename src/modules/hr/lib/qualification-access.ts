/**
 * Pure access helpers for qualification document downloads.
 * HR manage can always download; owning employees only when employeeVisible.
 */

export function canDownloadQualificationDocument(input: {
  canManage: boolean;
  canViewOwnProfile: boolean;
  viewerEmployeeId: string | null | undefined;
  documentEmployeeId: string;
  employeeVisible: boolean;
}): boolean {
  if (input.canManage) {
    return true;
  }

  return (
    input.canViewOwnProfile &&
    input.viewerEmployeeId === input.documentEmployeeId &&
    input.employeeVisible
  );
}
