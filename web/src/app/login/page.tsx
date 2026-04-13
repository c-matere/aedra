"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, KeyRound, Mail, Loader2, Phone, QrCode } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

type LoginMode = "EMAIL" | "OTP"
type OtpStep = "PHONE" | "VERIFY"

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<LoginMode>("EMAIL")
    const [otpStep, setOtpStep] = useState<OtpStep>("PHONE")

    // Email state
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    // OTP state
    const [phone, setPhone] = useState("")
    const [code, setCode] = useState("")

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

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const response = await fetch("/api/auth/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            })

            if (!response.ok) {
                const payload = (await response.json().catch(() => ({}))) as { message?: string }
                setError(payload.message ?? "Failed to send OTP. Is your phone number registered?")
                setLoading(false)
                return
            }

            setOtpStep("VERIFY")
            setLoading(false)
        } catch {
            setError("Unable to reach authentication service.")
            setLoading(false)
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const response = await fetch("/api/auth/login-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, code }),
            })

            if (!response.ok) {
                const payload = (await response.json().catch(() => ({}))) as { message?: string }
                setError(payload.message ?? "Invalid or expired OTP.")
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

    const isRegistered = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('registered') === 'true'

    return (
        <div className="dark flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-50 relative overflow-hidden px-4">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none z-0" />

            <Link href="/" className="absolute top-8 left-8 flex items-center gap-3 hover:opacity-90 transition-opacity">
                <img src="/aedra logo.png" alt="Aedra" className="h-8 w-auto" />
            </Link>

            <div className="w-full max-w-md z-10">
                <Card className="border-white/10 shadow-lg bg-neutral-900 p-2">
                    <CardHeader className="space-y-2 pb-6 text-center">
                        <CardTitle className="text-3xl font-bold tracking-tight text-white">
                            {mode === "EMAIL" ? "Welcome back" : "WhatsApp Login"}
                        </CardTitle>
                        <CardDescription className="text-neutral-400 text-base">
                            {mode === "EMAIL"
                                ? "Enter your credentials to manage your properties."
                                : otpStep === "PHONE"
                                    ? "Enter your registered phone number to receive an OTP."
                                    : "Enter the 6-digit code sent to your WhatsApp."}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {mode === "EMAIL" ? (
                            <form onSubmit={handleLogin} className="space-y-4">
                                {isRegistered && (
                                    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200 mb-4">
                                        Registration successful! Please sign in with your credentials.
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-neutral-300 ml-1">Email</label>
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
                        ) : (
                            <form onSubmit={otpStep === "PHONE" ? handleRequestOtp : handleVerifyOtp} className="space-y-4">
                                {otpStep === "PHONE" ? (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-neutral-300 ml-1">Phone Number</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                                            <Input
                                                type="tel"
                                                placeholder="254700000000"
                                                required
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-neutral-300 ml-1">OTP Code</label>
                                        <div className="relative">
                                            <QrCode className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                                            <Input
                                                type="text"
                                                placeholder="123456"
                                                required
                                                maxLength={6}
                                                value={code}
                                                onChange={(e) => setCode(e.target.value)}
                                                className="pl-10 h-11 bg-white/5 border-white/10 text-white tracking-[0.5em] text-center font-bold"
                                            />
                                        </div>
                                    </div>
                                )}

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
                                            {otpStep === "PHONE" ? "Sending OTP" : "Verifying"}
                                        </>
                                    ) : (
                                        otpStep === "PHONE" ? "Send OTP Code" : "Verify & Sign In"
                                    )}
                                </Button>

                                {otpStep === "VERIFY" && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setOtpStep("PHONE")}
                                        className="w-full text-neutral-400 hover:text-white"
                                    >
                                        Change Phone Number
                                    </Button>
                                )}
                            </form>
                        )}

                        <div className="mt-8 flex items-center gap-4">
                            <div className="h-px flex-1 bg-white/10" />
                            <div className="text-xs text-neutral-500 font-medium uppercase tracking-wider">or continue with</div>
                            <div className="h-px flex-1 bg-white/10" />
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setMode(mode === "EMAIL" ? "OTP" : "EMAIL")
                                setError(null)
                            }}
                            className="w-full h-11 mt-6 border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all font-medium"
                        >
                            {mode === "EMAIL" ? (
                                <>
                                    <Phone className="mr-2 h-4 w-4" />
                                    WhatsApp OTP Login
                                </>
                            ) : (
                                <>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Email & Password
                                </>
                            )}
                        </Button>
                    </CardContent>

                    <CardFooter className="flex flex-col items-center pt-6 space-y-4">
                        <div className="text-sm text-neutral-400">
                            Don&apos;t have an account?{" "}
                            <Link href="/register" className="font-semibold text-white hover:text-neutral-300 hover:underline">
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
