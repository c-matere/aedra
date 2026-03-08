import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuditLogs } from "@/lib/backend-api";
import { getSessionTokenFromCookie } from "@/lib/cookie-utils";

export default async function AuditLogsPage({
    searchParams,
}: {
    searchParams: Promise<{ limit?: string; action?: string; outcome?: string }>;
}) {
    const token = await getSessionTokenFromCookie();
    const sessionToken = token || "";

    const resolvedParams = await searchParams;
    const limit = resolvedParams.limit ? parseInt(resolvedParams.limit, 10) : 100;
    const action = resolvedParams.action;
    const outcome = resolvedParams.outcome;

    const result = await getAuditLogs(sessionToken, { limit, action, outcome });
    const logs = result.data?.logs ?? [];

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
                <p className="text-sm text-neutral-300">System activity and security events.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm text-neutral-300">Activity History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-neutral-500">
                                    <th className="pb-3 pt-0 font-medium whitespace-nowrap px-2">Timestamp</th>
                                    <th className="pb-3 pt-0 font-medium whitespace-nowrap px-2">Action</th>
                                    <th className="pb-3 pt-0 font-medium whitespace-nowrap px-2">Entity</th>
                                    <th className="pb-3 pt-0 font-medium whitespace-nowrap px-2">Actor (ID)</th>
                                    <th className="pb-3 pt-0 font-medium whitespace-nowrap px-2">Path</th>
                                    <th className="pb-3 pt-0 font-medium whitespace-nowrap px-2">Outcome</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-neutral-500">
                                            No audit logs found.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="group hover:bg-white/[0.02]">
                                            <td className="py-3 px-2 text-neutral-400 font-mono text-[11px]">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${log.action === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                                                        log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400' :
                                                            log.action === 'UPDATE' ? 'bg-amber-500/10 text-amber-400' :
                                                                'bg-neutral-500/10 text-neutral-400'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-white font-medium italic">
                                                {log.entity || '—'}
                                            </td>
                                            <td className="py-3 px-2 text-neutral-400">
                                                {log.actorId ? log.actorId.substring(0, 8) : 'System'}
                                            </td>
                                            <td className="py-3 px-2 text-neutral-500 truncate max-w-[150px]" title={log.path}>
                                                {log.path}
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className={`inline-flex h-2 w-2 rounded-full mr-2 ${log.outcome === 'SUCCESS' ? 'bg-emerald-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                                    }`} />
                                                <span className={log.outcome === 'SUCCESS' ? 'text-neutral-300' : 'text-red-400 font-medium'}>
                                                    {log.outcome}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
