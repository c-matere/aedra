"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { registerCompanyAction } from "@/lib/actions"

export default function RegisterPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const companyName = formData.get("companyName") as string
        const firstName = formData.get("firstName") as string
        const lastName = formData.get("lastName") as string
        const email = formData.get("email") as string
        const password = formData.get("password") as string

        try {
            const result = await registerCompanyAction({
                companyName,
                firstName,
                lastName,
                email,
                password,
            })

            if (result.error) {
                setError(result.error)
            } else {
                // Success - redirect to login for now, or we could auto-login
                router.push("/login?registered=true")
            }
        } catch (err) {
            setError("An unexpected error occurred. Please try again.")
        } finally {
            setIsLoading(false)
        }
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
                    <CardTitle className="text-2xl font-normal font-serif tracking-tight">Create your company</CardTitle>
                    <CardDescription className="text-[#73726c] text-center text-sm">
                        Enter your details to start managing your properties with Aedra.
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
                            <label className="text-sm font-medium text-[#1f1e1d] ml-1">Company Name</label>
                            <Input
                                name="companyName"
                                placeholder="Mombasa Estates Ltd"
                                required
                                className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#73726c] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#1f1e1d] ml-1">First Name</label>
                                <Input
                                    name="firstName"
                                    placeholder="John"
                                    required
                                    className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#73726c] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#1f1e1d] ml-1">Last Name</label>
                                <Input
                                    name="lastName"
                                    placeholder="Doe"
                                    required
                                    className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#73726c] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f1e1d] ml-1">Email</label>
                            <Input
                                name="email"
                                type="email"
                                placeholder="john@example.com"
                                required
                                className="bg-[#ffffff] border-[#dedcd1] text-[#141413] placeholder-[#73726c] rounded-[9.6px] focus:border-[#1f1e1d] focus:outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f1e1d] ml-1">Password</label>
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
                            className="w-full bg-primary text-primary-foreground hover:opacity-90 rounded-[9.6px] h-11"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                        <div className="text-center text-sm text-[#73726c]">
                            Already have an account?{" "}
                            <Link href="/login" className="text-[#1f1e1d] hover:text-[#141413] font-semibold hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
