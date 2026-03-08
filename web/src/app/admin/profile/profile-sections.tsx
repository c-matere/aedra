"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mail, Phone, Shield, User, Lock, CheckCircle2, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateProfileAction } from "@/lib/actions"

interface ProfileSectionsProps {
    initialUserData: {
        firstName: string
        lastName: string
        email: string
        phone: string
        role: string
    }
}

export function ProfileSections({ initialUserData }: ProfileSectionsProps) {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [userData] = useState(initialUserData)

    async function onUpdateProfile(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setSaving(true)
        setError(null)
        setSuccess(null)

        const formData = new FormData(e.currentTarget)
        const payload = {
            firstName: String(formData.get("firstName")),
            lastName: String(formData.get("lastName")),
            email: String(formData.get("email")),
            phone: String(formData.get("phone")),
        }

        const res = await updateProfileAction(payload)
        if (res.error) {
            setError(res.error)
        } else {
            setSuccess("Profile updated successfully.")
            router.refresh()
        }
        setSaving(false)
    }

    async function onUpdatePassword(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setSaving(true)
        setError(null)
        setSuccess(null)

        const formData = new FormData(e.currentTarget)
        const password = String(formData.get("password"))
        const confirm = String(formData.get("confirmPassword"))

        if (password !== confirm) {
            setError("Passwords do not match.")
            setSaving(false)
            return
        }

        const res = await updateProfileAction({ password })
        if (res.error) {
            setError(res.error)
        } else {
            setSuccess("Password updated successfully.")
            e.currentTarget.reset()
        }
        setSaving(false)
    }

    return (
        <div className="space-y-8 pb-10">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">Profile Settings</h1>
                <p className="text-neutral-400 text-sm font-medium">Manage your personal information and account security.</p>
            </div>

            {error && (
                <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {success && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                </div>
            )}

            <div className="grid gap-8 lg:grid-cols-3">
                {/* User Card */}
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader className="text-center pb-8 border-b border-white/5">
                        <div className="mx-auto h-20 w-20 rounded-full bg-neutral-800 border-2 border-white/10 flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-xl">
                            {(userData?.firstName?.[0] || "U").toUpperCase()}{(userData?.lastName?.[0] || "A").toUpperCase()}
                        </div>
                        <CardTitle className="text-xl font-bold text-white tracking-tight">
                            {userData?.firstName || "User"} {userData?.lastName || "Account"}
                        </CardTitle>
                        <CardDescription className="text-neutral-400">{userData?.email || "No email provided"}</CardDescription>
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-neutral-300">
                            <Shield className="h-3 w-3 text-emerald-400" />
                            {(userData?.role || "STAFF").replace('_', ' ')}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-sm">
                                <Mail className="h-4 w-4 text-neutral-500" />
                                <span className="text-neutral-300 truncate">{userData.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Phone className="h-4 w-4 text-neutral-500" />
                                <span className="text-neutral-300">{userData.phone || "Not set"}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-8">
                    {/* Personal Info Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <User className="h-5 w-5 text-neutral-400" />
                                Personal Information
                            </CardTitle>
                            <CardDescription className="text-neutral-400 text-xs mt-1">Update your display name and contact details.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={onUpdateProfile} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">First Name</label>
                                        <Input name="firstName" defaultValue={userData.firstName} required className="bg-white/5 border-white/10 text-sm h-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Last Name</label>
                                        <Input name="lastName" defaultValue={userData.lastName} required className="bg-white/5 border-white/10 text-sm h-10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Email Address</label>
                                    <Input name="email" type="email" defaultValue={userData.email} required className="bg-white/5 border-white/10 text-sm h-10" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Phone Number</label>
                                    <Input name="phone" defaultValue={userData.phone} placeholder="+254..." className="bg-white/5 border-white/10 text-sm h-10" />
                                </div>
                                <div className="pt-4">
                                    <Button type="submit" disabled={saving} className="w-full md:w-auto px-8">
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Security Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Lock className="h-5 w-5 text-neutral-400" />
                                Security Settings
                            </CardTitle>
                            <CardDescription className="text-neutral-400 text-xs mt-1">Change your account password.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={onUpdatePassword} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">New Password</label>
                                    <Input name="password" type="password" required className="bg-white/5 border-white/10 text-sm h-10" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Confirm New Password</label>
                                    <Input name="confirmPassword" type="password" required className="bg-white/5 border-white/10 text-sm h-10" />
                                </div>
                                <div className="pt-4">
                                    <Button type="submit" variant="outline" disabled={saving} className="w-full md:w-auto px-8 border-white/10 text-neutral-300 font-medium">
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Update Password
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
