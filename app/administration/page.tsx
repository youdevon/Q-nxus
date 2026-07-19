import { redirect } from "next/navigation";

/**
 * Sidebar links directly to /administration/organization.
 * Keep this redirect for bookmarks and older links.
 */
export default function AdministrationPage() {
  redirect("/administration/organization");
}
