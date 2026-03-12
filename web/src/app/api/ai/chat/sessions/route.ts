import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { listChatSessions } from "@/lib/backend-api";
import { AUTH_SESSION_COOKIE } from "@/lib/rbac";

export async function POST() {
    try {
        const sessionCookie = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;

        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized: No session found." }, { status: 401 });
        }

        const result = await listChatSessions(sessionCookie);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: "Unable to list sessions." }, { status: 500 });
    }
}
