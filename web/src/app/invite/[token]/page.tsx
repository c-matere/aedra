"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, ArrowRight, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { verifyInvitationAction, acceptInvitationAction } from "@/lib/actions"
import type { InvitationRecord } from "@/lib/backend-api"

export default function InvitePage({ params }: { params: { token: string } }) {
    const router = useRouter()
    const [token, setToken] = useState<string>("")
    const [invitation, setInvitation] = useState<InvitationRecord | null>(null)
    const [isVerifying, setIsVerifying] = useState(true)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSuccess, setIsSuccess] = useState(false)

    useEffect(() => {
        async function getToken() {
            const resolvedParams = await (params as any)
            const tokenValue = resolvedParams.token
            setToken(tokenValue)

            try {
                const result = await verifyInvitationAction(tokenValue)
                if (result.error) {
                    setError(result.error)
                } else if (result.data) {
                    setInvitation(result.data)
                }
            } catch (err) {
                setError("Failed to verify invitation link.")
            } finally {
                setIsVerifying(false)
            }
        }
        getToken()
    }, [params])

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const firstName = formData.get("firstName") as string
        const lastName = formData.get("lastName") as string
        const password = formData.get("password") as string

        try {
            const result = await acceptInvitationAction(token, {
                firstName,
                lastName,
                password,
            })

            if (result.error) {
                setError(result.error)
            } else {
                setIsSuccess(true)
                setTimeout(() => router.push("/login"), 3000)
            }
        } catch (err) {
            setError("An unexpected error occurred. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    if (isVerifying) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-neutral-950">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
        )
    }

    if (error && !invitation) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
                <Card className="w-full max-w-md bg-neutral-900 border-neutral-800 text-white shadow-2xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl text-red-500 text-3xl font-bold">Invalid Link</CardTitle>
                        <CardDescription className="text-neutral-400">
                            {error || "This invitation link is invalid or has expired."}
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Link href="/" className="w-full">
                            <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg border-none transition-all duration-300">Return Home</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    if (isSuccess) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
                <Card className="w-full max-w-md bg-neutral-900 border-neutral-800 text-white shadow-2xl">
                    <CardHeader className="text-center space-y-4">
                        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Account Created!</CardTitle>
                        <CardDescription className="text-neutral-400">
                            Your account has been successfully set up. Redirecting you to login...
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Link href="/login" className="w-full">
                            <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg border-none transition-all duration-300">Go to Login Now</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0" />

            <Card className="w-full max-w-md bg-neutral-900 border-neutral-800 text-white z-10 shadow-2xl">
                <CardHeader className="space-y-1 flex flex-col items-center">
                    <div className="h-12 w-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4">
                        <Building2 className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        {invitation?.company?.name ? `Join ${invitation.company.name}` : "Complete Your Profile"}
                    </CardTitle>
                    <CardDescription className="text-neutral-400 text-center">
                        You've been invited as a {invitation?.role.replace('_', ' ').toLowerCase()}. Set up your profile to continue.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Email Address</label>
                            <Input
                                value={invitation?.email}
                                disabled
                                className="bg-neutral-800 border-neutral-700 text-neutral-400"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">First Name</label>
                                <Input
                                    key={`fn-${invitation?.id}`}
                                    name="firstName"
                                    defaultValue={invitation?.firstName || ""}
                                    placeholder="John"
                                    required
                                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Last Name</label>
                                <Input
                                    key={`ln-${invitation?.id}`}
                                    name="lastName"
                                    defaultValue={invitation?.lastName || ""}
                                    placeholder="Doe"
                                    required
                                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Set Password</label>
                            <Input
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg border-none transition-all duration-300"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    Accept Invitation <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
