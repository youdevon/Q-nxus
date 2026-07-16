import { prisma } from "@/lib/prisma";

export type OrganizationHolidayRecord = {
  id: string;
  holidayDate: string;
  name: string;
  isRecurring: boolean;
  isActive: boolean;
};

export async function getOrganizationHolidays(): Promise<
  OrganizationHolidayRecord[]
> {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!organization) {
    return [];
  }

  const holidays = await prisma.organizationHoliday.findMany({
    where: {
      organizationId: organization.id,
      isActive: true,
    },
    orderBy: [{ holidayDate: "asc" }, { name: "asc" }],
    select: {
      id: true,
      holidayDate: true,
      name: true,
      isRecurring: true,
      isActive: true,
    },
  });

  return holidays.map((holiday) => ({
    id: holiday.id,
    holidayDate: holiday.holidayDate.toISOString().slice(0, 10),
    name: holiday.name,
    isRecurring: holiday.isRecurring,
    isActive: holiday.isActive,
  }));
}

/** ISO dates for leave day counting within an inclusive range. */
export async function getOrganizationHolidayDatesInRange({
  organizationId,
  startDate,
  endDate,
}: {
  organizationId: string;
  startDate: Date;
  endDate: Date;
}): Promise<string[]> {
  const holidays = await prisma.organizationHoliday.findMany({
    where: {
      organizationId,
      isActive: true,
      holidayDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      holidayDate: true,
      isRecurring: true,
    },
  });

  // Recurring holidays also match by month-day across years in range.
  const recurring = await prisma.organizationHoliday.findMany({
    where: {
      organizationId,
      isActive: true,
      isRecurring: true,
    },
    select: {
      holidayDate: true,
    },
  });

  const dates = new Set(
    holidays.map((item) => item.holidayDate.toISOString().slice(0, 10)),
  );

  const cursor = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ),
  );

  while (cursor <= end) {
    const month = cursor.getUTCMonth();
    const day = cursor.getUTCDate();

    for (const holiday of recurring) {
      if (
        holiday.holidayDate.getUTCMonth() === month &&
        holiday.holidayDate.getUTCDate() === day
      ) {
        dates.add(cursor.toISOString().slice(0, 10));
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return [...dates];
}
