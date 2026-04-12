import { Shield, Lock, Users, Fingerprint, Globe, Key, Clock, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { listUsers, listInvitations, getCompany, fetchMe } from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { RoleManager } from "../staff/role-manager"
import { SecurityEditButton } from "../settings/security-edit-button"

export default async function AccessControlPage() {
    const role = await getRoleFromCookie()
    const token = await getSessionTokenFromCookie()
    const sessionToken = token || ""

    const [meResult, invitationsRes] = await Promise.all([
        fetchMe(sessionToken),
        listInvitations(sessionToken)
    ])

    const companyId = meResult.data?.user?.companyId
    const companyResult = companyId ? await getCompany(sessionToken, companyId) : { data: null }
    const company = companyResult.data
    const invitations = invitationsRes.data ?? []

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Header section */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                        Access Control
                    </h1>
                    <p className="text-neutral-400 text-sm font-medium">
                        Centralized role permissions and platform security policies.
                    </p>
                </div>
                {company && (
                    <SecurityEditButton company={company} token={sessionToken} />
                )}
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-1 transition-all hover:bg-white/[0.07]">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                        <Lock className="h-3 w-3 text-emerald-400" /> Security Status
                    </span>
                    <span className="text-2xl font-black text-white">Active</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-1 transition-all hover:bg-white/[0.07]">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                        <Users className="h-3 w-3 text-blue-400" /> Pending Access
                    </span>
                    <span className="text-2xl font-black text-white">{invitations.length} Invites</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-1 transition-all hover:bg-white/[0.07]">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck className="h-3 w-3 text-purple-400" /> MFA Status
                    </span>
                    <span className="text-2xl font-black text-white">{company?.twoFactorAuthEnabled ? "Enforced" : "Optional"}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Roles Management Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Shield className="h-5 w-5 text-emerald-500" />
                            Roles & Permissions
                        </h2>
                    </div>
                    <Card className="bg-neutral-900 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-neutral-400">Custom Roles</CardTitle>
                            <CardDescription className="text-xs">Define granular access sets for your team.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RoleManager />
                        </CardContent>
                    </Card>

                    <Card className="bg-neutral-900 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-neutral-400">System Role Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                { role: "Super Admin", desc: "Full root access to all system settings and audit trails." },
                                { role: "Company Admin", desc: "Full control over company portfolio, staff, and financial actions." },
                                { role: "Company Staff", desc: "Tactical access for maintenance, property viewing, and lease logging." }
                            ].map((r) => (
                                <div key={r.role} className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                        <Fingerprint className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-white">{r.role}</p>
                                        <p className="text-[11px] text-neutral-500 leading-tight">{r.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Security Policies Section */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-500" />
                        Security Policies
                    </h2>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Clock className="h-4 w-4 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Session Duration</p>
                                    <p className="text-[11px] text-neutral-500">Automatic logout after inactivity</p>
                                </div>
                            </div>
                            <span className="text-sm font-black text-white">{company?.sessionDurationHours ?? 8}h</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                    <Key className="h-4 w-4 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Password Policy</p>
                                    <p className="text-[11px] text-neutral-500">Complexity requirements for staff</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter bg-white/10 px-2 py-0.5 rounded">Standard</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <Globe className="h-4 w-4 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">IP Allowlist</p>
                                    <p className="text-[11px] text-neutral-500">Restrict access to specific networks</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-neutral-500">{company?.ipAllowlist ? "Active" : "Disabled"}</span>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-white pt-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-amber-500" />
                        Onboarding & Invites
                    </h2>
                    <Card className="bg-neutral-900 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-neutral-400">Pending Invitations ({invitations.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {invitations.length > 0 ? (
                                invitations.map((invite) => (
                                    <div key={invite.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                        <div>
                                            <p className="text-sm font-bold text-white">{invite.firstName} {invite.lastName}</p>
                                            <p className="text-[10px] text-neutral-500 uppercase font-black tracking-tight">{invite.role}</p>
                                        </div>
                                        <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded-full animate-pulse">Pending</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-neutral-500 italic py-4 text-center">No active invitations found.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
