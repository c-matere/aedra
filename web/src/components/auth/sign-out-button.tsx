"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
export function SignOutButton() {
    const router = useRouter()

    return (
        <Button
            variant="outline"
            onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" })
                router.push("/login")
                router.refresh()
            }}
            className="w-full justify-start gap-3 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
            <LogOut className="h-4 w-4" />
            Sign Out
        </Button>
    )
}
