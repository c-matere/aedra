import { listTenants, listProperties } from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { TenantsClient } from "./tenants-client"
import { redirect } from "next/navigation"

export default async function TenantsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; search?: string }>;
}) {
    const role = await getRoleFromCookie()
    const token = await getSessionTokenFromCookie()
    const sessionToken = token || ""

    const resolvedParams = await searchParams
    const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1
    const search = resolvedParams.search || ""

    const [tenantsResult, propertiesResult] = await Promise.all([
        listTenants(sessionToken, { page, search }),
        listProperties(sessionToken, { limit: 100 })
    ])

    const tenantsData = tenantsResult.data
    const tenants = tenantsData?.data ?? []
    const meta = tenantsData?.meta

    const onSearchAction = async (formData: FormData) => {
        "use server"
        const query = formData.get("search") as string
        if (query) {
            redirect(`/admin/tenants?search=${encodeURIComponent(query)}`)
        } else {
            redirect("/admin/tenants")
        }
    }

    const onPageChangeAction = async (newPage: number) => {
        "use server"
        const params = new URLSearchParams()
        if (search) params.set("search", search)
        params.set("page", newPage.toString())
        redirect(`/admin/tenants?${params.toString()}`)
    }

    return (
        <TenantsClient
            tenants={tenants}
            properties={propertiesResult.data?.data ?? []}
            meta={meta}
            role={role}
            token={sessionToken}
            search={search}
            onSearch={onSearchAction}
            onPageChange={onPageChangeAction}
        />
    )
}
