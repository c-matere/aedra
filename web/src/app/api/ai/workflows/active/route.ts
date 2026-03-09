import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { listActiveWorkflows } from "@/lib/backend-api";
import { AUTH_SESSION_COOKIE } from "@/lib/rbac";

export async function GET() {
    try {
        const sessionCookie = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;

        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await listActiveWorkflows(sessionCookie);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json(result.data);
    } catch (error: any) {
        return NextResponse.json({ error: "Unable to fetch workflows." }, { status: 500 });
    }
}

// Support POST as well if needed by backend-api
export async function POST() {
    return GET();
}
