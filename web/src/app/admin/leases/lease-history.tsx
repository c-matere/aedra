"use client"

import { useState, useEffect } from "react"
import { History, Clock, User, Activity, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import {
    SlidePanel,
    SlidePanelContent,
    SlidePanelDescription,
    SlidePanelHeader,
    SlidePanelTitle,
    SlidePanelTrigger,
} from "@/components/ui/slide-panel"
import { Button } from "@/components/ui/button"
import { type AuditLogRecord } from "@/lib/backend-api"
import { getAuditLogsAction } from "@/lib/actions"
import { cn } from "@/lib/utils"

interface LeaseHistoryProps {
    leaseId: string
    leaseTitle: string
    children?: React.ReactNode
}

export function LeaseHistory({ leaseId, leaseTitle, children }: LeaseHistoryProps) {
    const [open, setOpen] = useState(false)
    const [logs, setLogs] = useState<AuditLogRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            fetchHistory()
        }
    }, [open])

    async function fetchHistory() {
        setLoading(true)
        setError(null)
        try {
            const result = await getAuditLogsAction({
                targetId: leaseId,
                limit: 100,
            })
            if (result.error) {
                setError(result.error)
            } else {
                setLogs(result.data?.logs || [])
            }
        } catch (err) {
            setError("Failed to fetch history")
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const getActionIcon = (action: string) => {
        switch (action) {
            case "CREATE": return <Activity className="h-4 w-4 text-emerald-400" />
            case "UPDATE": return <Activity className="h-4 w-4 text-amber-400" />
            case "DELETE": return <XCircle className="h-4 w-4 text-red-400" />
            default: return <Activity className="h-4 w-4 text-neutral-400" />
        }
    }

    const getOutcomeIcon = (outcome: string) => {
        return outcome === "SUCCESS"
            ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            : <AlertCircle className="h-3 w-3 text-red-500" />
    }

    return (
        <SlidePanel open={open} onOpenChange={setOpen}>
            <SlidePanelTrigger asChild>
                {children || (
                    <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                        <History className="h-4 w-4 mr-2" />
                        History
                    </Button>
                )}
            </SlidePanelTrigger>
            <SlidePanelContent className="sm:max-w-xl">
                <SlidePanelHeader>
                    <SlidePanelTitle>Lease History</SlidePanelTitle>
                    <SlidePanelDescription>
                        Timeline of all actions and changes for lease: <span className="text-white font-medium">{leaseTitle}</span>
                    </SlidePanelDescription>
                </SlidePanelHeader>

                <div className="mt-8 relative border-l border-white/10 ml-3 space-y-8 pb-8">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Clock className="h-8 w-8 text-neutral-500 animate-pulse" />
                        </div>
                    ) : error ? (
                        <div className="p-4 text-sm text-red-400 bg-red-500/10 rounded-md border border-red-500/20">
                            {error}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-20 text-center text-neutral-500">
                            No history found for this lease.
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="relative pl-8">
                                {/* Dot on timeline */}
                                <div className={cn(
                                    "absolute left-[-5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-neutral-950",
                                    log.outcome === "SUCCESS" ? "bg-white/20" : "bg-red-500"
                                )} />

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-white/5 p-1.5 rounded-md border border-white/10">
                                            {getActionIcon(log.action)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-white flex items-center gap-2">
                                                {log.action} {log.entity || "Lease"}
                                                {getOutcomeIcon(log.outcome)}
                                            </span>
                                            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="ml-9 text-xs text-neutral-400 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <User className="h-3 w-3" />
                                            <span>
                                                {log.actorId ? `User: ${log.actorId.substring(0, 8)}...` : "System"}
                                            </span>
                                            {log.actorRole && (
                                                <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-500">
                                                    {log.actorRole}
                                                </span>
                                            )}
                                        </div>

                                        {Object.keys(log.metadata || {}).length > 0 && (
                                            <div className="mt-2 p-2 rounded bg-neutral-900 border border-white/5 overflow-hidden">
                                                <pre className="text-[10px] text-neutral-500 overflow-x-auto">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </SlidePanelContent>
        </SlidePanel>
    )
}
