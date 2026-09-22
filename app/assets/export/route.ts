import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";

import {
  applyXlsxTableColumnFonts,
  scaleXlsxColumnWidth,
  XLSX_LAYOUT,
  xlsxTableFont,
} from "@/src/lib/xlsx-typography";
import { getAssetRegisterExportRows } from "@/src/modules/assets/data/get-assets";
import { requireAssetsViewAccess } from "@/src/modules/assets/data/require-assets-access";
import {
  labelAssetEnum,
  parseAssetStatus,
  parseAssetType,
} from "@/src/modules/assets/lib/asset-enums";
import { sanitizeReportFileName } from "@/src/modules/reports/lib/export-xlsx";

export const dynamic = "force-dynamic";

function parseWarrantyFilter(value: string | null): {
  warrantyWithinDays: number | null;
  warrantyExpiredOnly: boolean;
} {
  if (value === "expired") {
    return { warrantyWithinDays: null, warrantyExpiredOnly: true };
  }
  if (value === "30" || value === "60" || value === "90") {
    return {
      warrantyWithinDays: Number(value),
      warrantyExpiredOnly: false,
    };
  }
  return { warrantyWithinDays: null, warrantyExpiredOnly: false };
}

function employeeName(employee: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
} | null): string {
  if (!employee) return "";
  return [employee.preferredName ?? employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(" ");
}

const COLUMNS: Array<{ header: string; key: string; width: number }> = [
  { header: "Asset number", key: "assetNumber", width: 16 },
  { header: "Tag", key: "assetTag", width: 14 },
  { header: "Category", key: "category", width: 18 },
  { header: "Type", key: "assetType", width: 14 },
  { header: "Manufacturer", key: "manufacturer", width: 16 },
  { header: "Model", key: "modelName", width: 18 },
  { header: "Serial / service tag", key: "serialNumber", width: 22 },
  { header: "Device name", key: "computerName", width: 18 },
  { header: "Status", key: "status", width: 12 },
  { header: "Condition", key: "condition", width: 12 },
  { header: "Assignee #", key: "assigneeNumber", width: 12 },
  { header: "Assignee", key: "assigneeName", width: 22 },
  { header: "Location", key: "location", width: 18 },
  { header: "Warranty ends", key: "warrantyEndsOn", width: 14 },
  { header: "Purchase date", key: "purchaseDate", width: 14 },
];

export async function GET(request: NextRequest) {
  await requireAssetsViewAccess();

  const { searchParams } = request.nextUrl;
  const warranty = parseWarrantyFilter(searchParams.get("warranty"));

  const rows = await getAssetRegisterExportRows({
    query: searchParams.get("query") ?? undefined,
    status: parseAssetStatus(searchParams.get("status") ?? undefined),
    assetType: parseAssetType(searchParams.get("assetType") ?? undefined),
    warrantyWithinDays: warranty.warrantyWithinDays,
    warrantyExpiredOnly: warranty.warrantyExpiredOnly,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "q-nxus";
  const sheet = workbook.addWorksheet("Asset register", {
    properties: { defaultRowHeight: XLSX_LAYOUT.defaultRowHeight },
    views: [{ zoomScale: XLSX_LAYOUT.viewZoom }],
  });

  sheet.columns = COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: scaleXlsxColumnWidth(column.width),
  }));

  if (rows.length > 0) {
    sheet.addRows(
      rows.map((row) => ({
        assetNumber: row.assetNumber,
        assetTag: row.assetTag ?? "",
        category: labelAssetEnum(row.category),
        assetType: labelAssetEnum(row.assetType),
        manufacturer: row.manufacturer ?? "",
        modelName: row.modelName ?? "",
        serialNumber: row.serialNumber ?? "",
        computerName: row.computerName ?? "",
        status: labelAssetEnum(row.status),
        condition: labelAssetEnum(row.condition),
        assigneeNumber:
          row.openAssignment?.employee?.employeeNumber ??
          row.assignedEmployee?.employeeNumber ??
          "",
        assigneeName: row.openAssignment?.employee
          ? employeeName(row.openAssignment.employee)
          : row.openAssignment?.location
            ? row.openAssignment.location.name
            : row.assignedEmployee
              ? employeeName(row.assignedEmployee)
              : "",
        location: row.location?.name ?? "",
        warrantyEndsOn: row.warrantyEndsOn ?? "",
        purchaseDate: row.purchaseDate ?? "",
      })),
    );
  }

  applyXlsxTableColumnFonts(sheet, COLUMNS.length);

  const headerRow = sheet.getRow(1);
  headerRow.height = XLSX_LAYOUT.headerRowHeight;
  headerRow.font = xlsxTableFont({ bold: true });

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const fileName = sanitizeReportFileName(
    `asset-register-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
