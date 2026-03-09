'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface Workflow {
    id: string;
    type: string;
    status: string;
    updatedAt: string;
}

export function WorkflowTracker() {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWorkflows = async () => {
            try {
                const res = await fetch('/api/ai/workflows/active');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setWorkflows(data);
                }
            } catch (error) {
                console.error('Failed to fetch workflows', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWorkflows();
        // Poll every 30 seconds
        const interval = setInterval(fetchWorkflows, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'AWAITING_INPUT': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'COMPLETED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diff < 1) return 'Just now';
        if (diff < 60) return `${diff}m ago`;
        return `${Math.floor(diff / 60)}h ago`;
    };

    if (loading && workflows.length === 0) {
        return <div className="animate-pulse space-y-2 px-1">
            <div className="h-2 w-20 bg-zinc-800 rounded mb-4" />
            <div className="h-16 bg-zinc-900 rounded-lg border border-zinc-800" />
            <div className="h-16 bg-zinc-900 rounded-lg border border-zinc-800" />
        </div>;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider px-1">
                Active Workflows
            </h3>
            <div className="space-y-2">
                {workflows.map((wf) => (
                    <Card key={wf.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer">
                        <CardContent className="p-3">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-medium text-zinc-100">{wf.type.replace(/_/g, ' ')}</span>
                                <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${getStatusColor(wf.status)}`}>
                                    {wf.status}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-zinc-500">
                                <span className="truncate max-w-[120px]">ID: {wf.id}</span>
                                <span>{formatTime(wf.updatedAt)}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {workflows.length === 0 && !loading && (
                    <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg">
                        <p className="text-xs text-zinc-600">No active workflows</p>
                    </div>
                )}
            </div>
        </div>
    );
}
