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

    const LogoMark = () => (
        <svg className="w-6 h-6 text-[#d96b27] mr-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="22"></line>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            <line x1="4.93" y1="19.07" x2="19.07" y2="4.93"></line>
        </svg>
    )

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#faf9f5] text-[#141413] relative overflow-hidden px-4 font-sans">

            <Link href="/" className="absolute top-8 left-8 flex items-center hover:opacity-90 transition-opacity">
                <LogoMark />
                <span className="font-serif font-normal text-2xl tracking-tight text-[#141413]">Aedra</span>
            </Link>

            <div className="w-full max-w-md z-10 mt-12">
                <Card className="border-[#dedcd1] shadow-none bg-[#ffffff] p-6 rounded-[16px]">
                    <CardHeader className="space-y-2 pb-6 text-center">
                        <CardTitle className="text-3xl font-normal font-serif text-[#141413]">
                            {mode === "EMAIL" ? "Welcome back" : "WhatsApp Login"}
                        </CardTitle>
                        <CardDescription className="text-[#73726c] text-sm">
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
                                    <div className="rounded-[9.6px] border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-800 mb-4">
                                        Registration successful! Please sign in with your credentials.
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[#1f1e1d] ml-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-[#73726c]" />
                                        <Input
                                            type="email"
                                            placeholder="name@company.co.ke"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10 h-11 bg-[#ffffff] border-[#dedcd1] rounded-[9.6px] text-[#141413] placeholder-[#73726c] focus:border-[#1f1e1d] focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between ml-1">
                                        <label className="text-sm font-medium text-[#1f1e1d]">Password</label>
                                        <Link href="#" className="text-xs font-semibold text-[#73726c] hover:text-[#1f1e1d] hover:underline">
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-3 h-4 w-4 text-[#73726c]" />
                                        <Input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-10 h-11 bg-[#ffffff] border-[#dedcd1] rounded-[9.6px] text-[#141413] focus:border-[#1f1e1d] focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {error ? (
                                    <div className="rounded-[9.6px] border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-800">
                                        {error}
                                    </div>
                                ) : null}

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-11 mt-6 font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all rounded-[9.6px]"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Authenticating...
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
                                        <label className="text-sm font-medium text-[#1f1e1d] ml-1">Phone Number</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-3 h-4 w-4 text-[#73726c]" />
                                            <Input
                                                type="tel"
                                                placeholder="254700000000"
                                                required
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="pl-10 h-11 bg-[#ffffff] border-[#dedcd1] rounded-[9.6px] text-[#141413] placeholder-[#73726c] focus:border-[#1f1e1d] focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#1f1e1d] ml-1">OTP Code</label>
                                        <div className="relative">
                                            <QrCode className="absolute left-3 top-3 h-4 w-4 text-[#73726c]" />
                                            <Input
                                                type="text"
                                                placeholder="123456"
                                                required
                                                maxLength={6}
                                                value={code}
                                                onChange={(e) => setCode(e.target.value)}
                                                className="pl-10 h-11 bg-[#ffffff] border-[#dedcd1] rounded-[9.6px] text-[#141413] tracking-[0.5em] text-center font-bold focus:border-[#1f1e1d] focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {error ? (
                                    <div className="rounded-[9.6px] border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-800">
                                        {error}
                                    </div>
                                ) : null}

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-11 mt-6 font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all rounded-[9.6px]"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {otpStep === "PHONE" ? "Sending OTP..." : "Verifying..."}
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
                                        className="w-full text-[#73726c] hover:text-[#1f1e1d] hover:bg-[#f0eee6] rounded-[9.6px]"
                                    >
                                        Change Phone Number
                                    </Button>
                                )}
                            </form>
                        )}

                        <div className="mt-8 flex items-center gap-4">
                            <div className="h-[1px] flex-1 bg-[#dedcd1]" />
                            <div className="text-[11px] text-[#73726c] font-medium uppercase tracking-wider">or continue with</div>
                            <div className="h-[1px] flex-1 bg-[#dedcd1]" />
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setMode(mode === "EMAIL" ? "OTP" : "EMAIL")
                                setError(null)
                            }}
                            className="w-full h-11 mt-6 border-[#dedcd1] bg-transparent text-[#1f1e1d] hover:bg-[#f0eee6] transition-all font-medium rounded-[9.6px]"
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
                        <div className="text-sm text-[#73726c]">
                            Don&apos;t have an account?{" "}
                            <Link href="/register" className="font-semibold text-[#1f1e1d] hover:text-[#141413] hover:underline">
                                Register Company
                            </Link>
                        </div>
                    </CardFooter>
                </Card>

                <div className="mt-8 text-center text-xs text-[#73726c] space-y-1">
                    <p>By logging in, you agree to our Terms of Service & Privacy Policy.</p>
                    <p>Aedra Support: +254 700 000 000</p>
                </div>
            </div>
        </div>
    )
}
