"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, KeyRound, Mail, Loader2 } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            })

            if (!response.ok) {
                const payload = (await response.json().catch(() => ({}))) as { error?: string }
                setError(payload.error ?? "Invalid email or password.")
                setLoading(false)
                return
            }

            router.push("/admin")
            router.refresh()
        } catch {
            setError("Unable to reach authentication service.")
            setLoading(false)
        }
    }

    return (
        <div className="dark flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-50 relative overflow-hidden px-4">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none z-0" />

            <Link href="/" className="absolute top-8 left-8 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 border border-neutral-700 shadow-inner">
                    <Building2 className="h-4 w-4 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">
                    Aedra
                </span>
            </Link>

            <div className="w-full max-w-md z-10">
                <Card className="border-white/10 shadow-lg bg-neutral-900 p-2">
                    <CardHeader className="space-y-2 pb-6 text-center">
                        <CardTitle className="text-3xl font-bold tracking-tight text-white">
                            Welcome back
                        </CardTitle>
                        <CardDescription className="text-neutral-400 text-base">
                            Enter your credentials to manage your properties.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300 ml-1">Company Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                                    <Input
                                        type="email"
                                        placeholder="name@company.co.ke"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-sm font-medium text-neutral-300">Password</label>
                                    <Link href="#" className="text-xs font-semibold text-neutral-400 hover:text-neutral-300 hover:underline">
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                                    <Input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 h-11 bg-white/5 border-white/10 text-white"
                                    />
                                </div>
                            </div>

                            {error ? (
                                <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                                    {error}
                                </div>
                            ) : null}

                            <Button
                                type="submit"
                                variant="glass"
                                disabled={loading}
                                className="w-full h-11 mt-6 font-semibold bg-white/10 text-white hover:bg-white/20 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Authenticating
                                    </>
                                ) : (
                                    "Sign In"
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="flex flex-col items-center pt-6 space-y-4">
                        <div className="text-sm text-neutral-400">
                            Don&apos;t have an account?{" "}
                            <Link href="#" className="font-semibold text-white hover:text-neutral-300 hover:underline">
                                Register Company
                            </Link>
                        </div>
                    </CardFooter>
                </Card>

                <div className="mt-8 text-center text-xs text-neutral-500">
                    <p>By logging in, you agree to our Terms of Service & Privacy Policy.</p>
                    <p className="mt-1">Aedra Support: +254 700 000 000</p>
                </div>
            </div>
        </div>
    )
}
