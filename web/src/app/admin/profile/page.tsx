import { redirect } from "next/navigation"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { fetchMe } from "@/lib/backend-api"
import { getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { ProfileSections } from "./profile-sections"

export default async function AdminProfilePage() {
    const token = await getSessionTokenFromCookie()
    if (!token) {
        redirect("/login")
    }

    const res = await fetchMe(token)

    if (res.error || !res.data?.user) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <AlertCircle className="h-10 w-10 text-red-500" />
                <h2 className="text-xl font-semibold text-white">Profile Error</h2>
                <p className="text-neutral-400">{res.error || "Could not retrieve your account information."}</p>
                <Button variant="outline" asChild>
                    <a href="/admin/profile">Retry</a>
                </Button>
            </div>
        )
    }

    const u = res.data.user

    // Debug logging to help identify why firstName might be missing
    if (!u.firstName) {
        console.error("[DEBUG] AdminProfilePage: User data returned from /me is missing firstName", u);
    }

    const initialUserData = {
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        email: u.email || "",
        phone: u.phone || "",
        role: u.role || "COMPANY_STAFF",
    }

    return <ProfileSections initialUserData={initialUserData} />
}
