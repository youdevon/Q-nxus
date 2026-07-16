import { redirect } from "next/navigation"

import { getCurrentUser } from "@/src/modules/auth/data/get-current-user"

export const metadata = {
  title: "My Profile",
}

export const dynamic = "force-dynamic"

export default async function MyProfilePage() {
  const user = await getCurrentUser()

  if (!user?.employeeId) {
    redirect("/")
  }

  redirect(`/people/employees/${user.employeeId}`)
}
