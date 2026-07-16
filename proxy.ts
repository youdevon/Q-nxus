import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  parseSessionTokenEdge,
  SESSION_COOKIE_NAME,
} from "@/src/modules/auth/lib/session"

const PUBLIC_PATHS = ["/login"]
const PASSWORD_CHANGE_PATH = "/account/change-password"

function matchesPath(pathname: string, paths: string[]) {
  return paths.some(
    (path) =>
      pathname === path || pathname.startsWith(`${path}/`),
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = matchesPath(pathname, PUBLIC_PATHS)
  const isPasswordChange =
    pathname === PASSWORD_CHANGE_PATH ||
    pathname.startsWith(`${PASSWORD_CHANGE_PATH}/`)

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const secret = process.env.AUTH_SECRET ?? ""
  const session = await parseSessionTokenEdge(token, secret)

  if (!session && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    )
    return NextResponse.redirect(loginUrl)
  }

  if (session && pathname === "/login") {
    const destination = request.nextUrl.clone()
    destination.search = ""
    destination.pathname = session.mustChangePassword
      ? PASSWORD_CHANGE_PATH
      : "/"
    return NextResponse.redirect(destination)
  }

  if (
    session?.mustChangePassword &&
    !isPasswordChange &&
    !isPublic
  ) {
    const changeUrl = request.nextUrl.clone()
    changeUrl.pathname = PASSWORD_CHANGE_PATH
    changeUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    )
    return NextResponse.redirect(changeUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
