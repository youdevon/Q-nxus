import { redirect } from "next/navigation";

/**
 * Legacy board-create URL — unified into /people/employees/new.
 */
export default function LegacyNewBoardMemberPage() {
  redirect("/people/employees/new?category=BOARD");
}
