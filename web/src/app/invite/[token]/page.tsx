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

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
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

    const LogoMark = () => (
        <svg className="w-6 h-6 text-[#d96b27] mr-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="22"></line>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            <line x1="4.93" y1="19.07" x2="19.07" y2="4.93"></line>
        </svg>
    )

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#faf9f5] text-[#141413] p-4 relative overflow-hidden font-sans">

            <Link href="/" className="absolute top-8 left-8 flex items-center hover:opacity-90 transition-opacity">
                <LogoMark />
                <span className="font-serif font-normal text-2xl tracking-tight text-[#141413]">Aedra</span>
            </Link>

            <Card className="w-full max-w-md bg-[#ffffff] border-[#dedcd1] text-[#141413] z-10 shadow-none p-4 rounded-[16px] mt-12">
                <CardHeader className="space-y-1 flex flex-col items-center">
                    <div className="h-12 w-12 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center mb-4 text-[#1f1e1d]">
                        <Building2 className="h-6 w-6 text-[#141413]" />
                    </div>
                    <CardTitle className="text-2xl font-normal font-serif tracking-tight text-center">
                        {invitation?.company?.name ? `Join ${invitation.company.name}` : "Complete Your Profile"}
                    </CardTitle>
                    <CardDescription className="text-[#73726c] text-center text-sm">
                        You've been invited as a {invitation?.role.replace('_', ' ').toLowerCase()}. Set up your profile to continue.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-[9.6px] bg-red-500/5 border border-red-500/20 text-red-800 text-sm">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f1e1d] ml-1">Email Address</label>
                            <Input
                                value={invitation?.email}
                                disabled
                                className="bg-[#f0eee6] border-[#dedcd1] text-[#73726c] opacity-80"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#1f1e1d] ml-1">First Name</label>
                                <Input
                                    key={`fn-${invitation?.id}`}
                                    name="firstName"
                                    defaultValue={invitation?.firstName || ""}
                                    placeholder="John"
                                    required
                                    className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#73726c] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#1f1e1d] ml-1">Last Name</label>
                                <Input
                                    key={`ln-${invitation?.id}`}
                                    name="lastName"
                                    defaultValue={invitation?.lastName || ""}
                                    placeholder="Doe"
                                    required
                                    className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#73726c] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f1e1d] ml-1">Set Password</label>
                            <Input
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#73726c] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pt-4">
                        <Button
                            type="submit"
                            className="w-full bg-primary text-primary-foreground hover:opacity-90 font-medium rounded-[9.6px] h-11 border-none shadow-none"
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
