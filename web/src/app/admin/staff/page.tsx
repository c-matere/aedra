import { 
    Users, 
    Shield, 
    Lock, 
    ShieldCheck, 
    Fingerprint, 
    Clock, 
    Key, 
    Globe, 
    Search,
    UserPlus,
    History
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
    listUsers, 
    listInvitations, 
    getCompany, 
    fetchMe, 
    listRoles,
    type UserRecord 
} from "@/lib/backend-api"
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils"
import { AddStaffButton, StaffRowActions } from "./staff-actions"
import { RoleManager } from "./role-manager"
import { SecurityEditButton } from "../settings/security-edit-button"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { redirect } from "next/navigation"

export default async function StaffAndAccessPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; search?: string; tab?: string }>;
}) {
    const role = await getRoleFromCookie()
    const token = await getSessionTokenFromCookie()
    const sessionToken = token || ""

    const resolvedParams = await searchParams
    const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1
    const search = resolvedParams.search || ""
    const activeTab = resolvedParams.tab || "directory"

    const [usersResult, invitationsRes, meResult, rolesRes] = await Promise.all([
        listUsers(sessionToken, { page, search }),
        listInvitations(sessionToken),
        fetchMe(sessionToken),
        listRoles(sessionToken)
    ])

    const usersData = usersResult.data
    const users = usersData?.data ?? []
    const meta = usersData?.meta
    const invitations = invitationsRes.data ?? []

    const companyId = meResult.data?.user?.companyId
    const companyResult = companyId ? await getCompany(sessionToken, companyId) : { data: null }
    const company = companyResult.data
    const customRoles = rolesRes.data ?? []

    const onSearchAction = async (formData: FormData) => {
        "use server"
        const query = formData.get("search") as string
        if (query) {
            redirect(`/admin/staff?search=${encodeURIComponent(query)}&tab=directory`)
        } else {
            redirect("/admin/staff?tab=directory")
        }
    }

    const onPageChangeAction = async (newPage: number) => {
        "use server"
        const params = new URLSearchParams()
        if (search) params.set("search", search)
        params.set("page", newPage.toString())
        params.set("tab", "directory")
        redirect(`/admin/staff?${params.toString()}`)
    }

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Header Section */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-neutral-100 tracking-tight drop-shadow-md">
                        Staff & Access
                    </h1>
                    <p className="text-neutral-400 text-sm font-medium">
                        Manage your team, define granular roles, and enforce security policies.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {company && activeTab === "access" && (
                        <SecurityEditButton company={company} token={sessionToken} />
                    )}
                    {activeTab === "directory" && (
                        <AddStaffButton role={role} customRoles={customRoles} />
                    )}
                </div>
            </div>

            <Tabs defaultValue={activeTab} className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1 mb-8">
                    <TabsTrigger value="directory" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                        <Users className="h-4 w-4 mr-2" />
                        Team Directory
                    </TabsTrigger>
                    <TabsTrigger value="access" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                        <Shield className="h-4 w-4 mr-2" />
                        Access Control
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="directory" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* KPI row for Directory */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Total Staff</CardTitle>
                                <Users className="h-4 w-4 text-blue-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-neutral-100">{meta?.total ?? users.length}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Active Users</CardTitle>
                                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-400">{users.filter(u => u.isActive).length}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Pending Invites</CardTitle>
                                <UserPlus className="h-4 w-4 text-amber-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{invitations.length}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex items-center gap-2">
                        <form action={onSearchAction} className="flex-1 relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500 pointer-events-none" />
                            <Input
                                name="search"
                                placeholder="Search team members by name or email..."
                                defaultValue={search}
                                className="bg-neutral-900 border-white/10 text-white pl-9 h-10"
                            />
                        </form>
                    </div>

                    {invitations.length > 0 && (
                        <Card className="border-amber-500/20 bg-amber-500/5">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Pending Invitations
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {invitations.map((invite) => (
                                    <div key={invite.id} className="flex items-center justify-between p-4 rounded-xl bg-neutral-900 border border-white/5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white">{invite.firstName} {invite.lastName}</p>
                                            <p className="text-xs text-neutral-500">{invite.email}</p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase tracking-widest">{invite.role}</span>
                                                <span className="text-[9px] text-neutral-600 italic">Created {new Date(invite.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="bg-neutral-900 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-neutral-400 uppercase tracking-wider">User Directory</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-white/5">
                                {users.map((user) => (
                                    <div key={user.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-neutral-100">{user.firstName} {user.lastName}</p>
                                            <p className="text-xs text-neutral-500">{user.email}</p>
                                            <div className="mt-2 flex items-center gap-2 overflow-x-auto">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                                    user.role === 'SUPER_ADMIN' ? 'bg-purple-500/10 text-purple-400' :
                                                    user.role === 'COMPANY_ADMIN' ? 'bg-blue-500/10 text-blue-400' :
                                                    'bg-neutral-500/10 text-neutral-400'
                                                }`}>
                                                    {user.role}
                                                </span>
                                                {user.isActive 
                                                    ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase tracking-widest">Active</span>
                                                    : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 uppercase tracking-widest">Inactive</span>
                                                }
                                                {user.permissions && user.permissions.length > 0 && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase tracking-widest">
                                                        {user.permissions.length} PERMS
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            <StaffRowActions role={role} user={user} customRoles={customRoles} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {meta && (
                                <div className="p-4 border-t border-white/5">
                                    <Pagination
                                        currentPage={meta.page}
                                        totalPages={meta.totalPages}
                                        onPageChange={onPageChangeAction}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="access" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-white/5 border-white/10 p-5 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                <Lock className="h-3 w-3 text-emerald-400" /> Security Status
                            </span>
                            <span className="text-2xl font-bold text-neutral-100">Hardened</span>
                        </Card>
                        <Card className="bg-white/5 border-white/10 p-5 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                <History className="h-3 w-3 text-blue-400" /> Audit Logging
                            </span>
                            <span className="text-2xl font-bold text-neutral-100">Enabled</span>
                        </Card>
                        <Card className="bg-white/5 border-white/10 p-5 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck className="h-3 w-3 text-purple-400" /> MFA Policy
                            </span>
                            <span className="text-2xl font-bold text-neutral-100">{company?.twoFactorAuthEnabled ? "Enforced" : "Optional"}</span>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Shield className="h-5 w-5 text-emerald-500" />
                                Roles & Permissions
                            </h2>
                            <Card className="bg-neutral-900 border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Custom Roles</CardTitle>
                                    <CardDescription className="text-xs">Define granular access sets for your team.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <RoleManager />
                                </CardContent>
                            </Card>

                            <Card className="bg-neutral-900 border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold text-neutral-400 uppercase tracking-wider">System Roles</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {[
                                        { role: "Super Admin", desc: "Full root access to all system settings and global audit trails." },
                                        { role: "Company Admin", desc: "Full control over company portfolio, staff, and financial actions." },
                                        { role: "Company Staff", desc: "Tactical access for maintenance, property viewing, and lease logging." }
                                    ].map((r) => (
                                        <div key={r.role} className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                                <Fingerprint className="h-4 w-4 text-emerald-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-neutral-100">{r.role}</p>
                                                <p className="text-[11px] text-neutral-500 leading-tight">{r.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Globe className="h-5 w-5 text-blue-500" />
                                Security Policies
                            </h2>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                            <Clock className="h-4 w-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">Session Duration</p>
                                            <p className="text-[11px] text-neutral-500">Automatic logout after inactivity</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-neutral-100">{company?.sessionDurationHours ?? 8}h</span>
                                </div>

                                <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between">
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

                                <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between">
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
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
