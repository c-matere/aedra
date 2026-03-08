import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend-api";
import { AUTH_ROLE_COOKIE, AUTH_SESSION_COOKIE, isUserRole } from "@/lib/rbac";

interface LoginResponse {
  accessToken?: string;
  user?: {
    role?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };

    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const response = await fetch(`${backendBaseUrl()}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as LoginResponse & { message?: string };

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.message ?? "Invalid email or password." },
        { status: response.status },
      );
    }

    const accessToken = payload.accessToken;
    const role = payload.user?.role;

    if (!accessToken || !isUserRole(role)) {
      return NextResponse.json({ error: "Invalid auth response from API." }, { status: 502 });
    }

    const nextResponse = NextResponse.json({ ok: true });

    nextResponse.cookies.set(AUTH_SESSION_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    nextResponse.cookies.set(AUTH_ROLE_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return nextResponse;
  } catch {
    return NextResponse.json({ error: "Unable to process login request." }, { status: 500 });
  }
}
