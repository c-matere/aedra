import { cookies } from "next/headers";
import { AUTH_ROLE_COOKIE, AUTH_SESSION_COOKIE, isUserRole, type UserRole } from "@/lib/rbac";

export async function getRoleFromCookie(): Promise<UserRole | null> {
    const cookieStore = await cookies();
    const rawRole = cookieStore.get(AUTH_ROLE_COOKIE)?.value;

    if (!isUserRole(rawRole)) {
        return null;
    }

    return rawRole;
}

export async function getSessionTokenFromCookie(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(AUTH_SESSION_COOKIE)?.value ?? null;
}
