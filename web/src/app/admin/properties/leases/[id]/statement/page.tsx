import { getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { redirect } from "next/navigation"
import StatementClient from "./statement-client"

export default async function TenantStatementPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const token = await getSessionTokenFromCookie()
    if (!token) {
        redirect("/login?reason=session_expired")
    }

    const { id } = await params

    return <StatementClient token={token} leaseId={id} />
}
