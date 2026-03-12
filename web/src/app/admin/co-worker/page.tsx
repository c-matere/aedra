import React from 'react';
import { ChatWindow } from '@/components/ai/chat-window';

export default function CoWorkerPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-background rounded-xl border border-border/50 overflow-hidden shadow-2xl shadow-black/20">
            <ChatWindow />
        </div>
    );
}
