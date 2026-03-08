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

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0" />

            <Card className="w-full max-w-md bg-neutral-900 border-neutral-800 text-white z-10 shadow-2xl">
                <CardHeader className="space-y-1 flex flex-col items-center">
                    <div className="h-12 w-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4">
                        <Building2 className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Create your company</CardTitle>
                    <CardDescription className="text-neutral-400 text-center">
                        Enter your details to start managing your properties with Aedra.
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
                            <label className="text-sm font-medium text-neutral-300">Company Name</label>
                            <Input
                                name="companyName"
                                placeholder="Mombasa Estates Ltd"
                                required
                                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">First Name</label>
                                <Input
                                    name="firstName"
                                    placeholder="John"
                                    required
                                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Last Name</label>
                                <Input
                                    name="lastName"
                                    placeholder="Doe"
                                    required
                                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Email</label>
                            <Input
                                name="email"
                                type="email"
                                placeholder="john@example.com"
                                required
                                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Password</label>
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
                            className="w-full bg-white text-black hover:bg-neutral-200"
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
                        <div className="text-center text-sm text-neutral-400">
                            Already have an account?{" "}
                            <Link href="/login" className="text-white hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
