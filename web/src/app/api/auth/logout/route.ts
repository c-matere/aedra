import { NextResponse } from "next/server";

import { AUTH_ROLE_COOKIE, AUTH_SESSION_COOKIE } from "@/lib/rbac";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(AUTH_ROLE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
