import React from 'react';
import { ChatWindow } from '@/components/ai/chat-window';
import { WorkflowTracker } from '@/components/ai/workflow-tracker';

export default function CoWorkerPage() {
    return (
        <div className="flex flex-col h-full bg-black text-zinc-100">
            <header className="flex items-center justify-between p-6 border-b border-zinc-900">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">AI Co-worker</h1>
                    <p className="text-sm text-zinc-500">Autonomous Property Management Brain</p>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-mono text-zinc-400">GEMINI_1.5_PRO_V1</span>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden p-6 gap-6">
                {/* Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    <ChatWindow />
                </div>

                {/* Sidebar */}
                <aside className="w-80 flex-shrink-0 flex flex-col gap-6">
                    <WorkflowTracker />

                    <div className="mt-auto p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Capability Level</h4>
                        <div className="flex flex-wrap gap-2">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Finance Management</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Legal Workflows</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Asset Analysis</span>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}
