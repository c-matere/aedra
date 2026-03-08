"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, LogOut, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface TopNavProfileProps {
    role: string
    roleLabel: string
}

export function TopNavProfile({ role, roleLabel }: TopNavProfileProps) {
    const router = useRouter()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-full px-4 h-9 border border-white/5 bg-white/5 data-[state=open]:bg-white/10">
                    <div className="h-6 w-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
                        {role.startsWith("SUPER") ? "SA" : role === "COMPANY_ADMIN" ? "CA" : "CS"}
                    </div>
                    <span>{roleLabel}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-neutral-900 border-white/10 text-white shadow-2xl">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{roleLabel}</p>
                        <p className="text-xs leading-none text-neutral-400">
                            System Access
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <Link href="/admin/profile">
                    <DropdownMenuItem className="focus:bg-white/5 cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile Settings</span>
                    </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                    className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                    onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST" })
                        router.push("/login")
                        router.refresh()
                    }}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
