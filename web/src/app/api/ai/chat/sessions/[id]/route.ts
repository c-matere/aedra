import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getChatSession, deleteChatSession } from "@/lib/backend-api";
import { AUTH_SESSION_COOKIE } from "@/lib/rbac";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sessionCookie = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;

        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized: No session found." }, { status: 401 });
        }

        const id = (await params).id;
        const result = await getChatSession(sessionCookie, id);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: "Unable to get session." }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sessionCookie = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;

        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized: No session found." }, { status: 401 });
        }

        const id = (await params).id;
        const result = await deleteChatSession(sessionCookie, id);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: "Unable to delete session." }, { status: 500 });
    }
}
