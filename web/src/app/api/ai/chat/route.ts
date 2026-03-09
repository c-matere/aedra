import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { aiChat } from "@/lib/backend-api";
import { AUTH_SESSION_COOKIE } from "@/lib/rbac";

export async function POST(request: Request) {
    try {
        const sessionCookie = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;

        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized: No session found." }, { status: 401 });
        }

        const body = await request.json();
        const { history, message } = body;

        const result = await aiChat(sessionCookie, { history, message });

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: "Unable to process chat request." }, { status: 500 });
    }
}
