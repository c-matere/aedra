'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Copy,
    RefreshCcw,
    Plus,
    Mic,
    SendHorizontal,
    ChevronDown,
    Check,
    MoreVertical,
    History,
    Trash2,
    MessageSquare,
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkflowTracker } from './workflow-tracker';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatSession {
    id: string;
    title: string;
    createdAt: string;
}

export function ChatWindow() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm your Aedra AI Co-worker. How can I assist you with your properties today?" }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
    const [attachments, setAttachments] = useState<{ data: string; mimeType: string; name: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages, isTyping]);

    const fetchSessions = async () => {
        try {
            const res = await fetch('/api/ai/chat/sessions', { method: 'POST' });
            const data = await res.json();
            if (Array.isArray(data)) setSessions(data);
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        }
    };

    const loadSession = async (id: string) => {
        try {
            const res = await fetch(`/api/ai/chat/sessions/${id}`, { method: 'POST' });
            const data = await res.json();
            if (data.messages) {
                setMessages(data.messages.map((m: any) => ({
                    role: m.role,
                    content: m.content
                })));
                setCurrentChatId(id);
            }
        } catch (error) {
            console.error("Failed to load session", error);
        }
    };

    const deleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`/api/ai/chat/sessions/${id}`, { method: 'DELETE' });
            setSessions(prev => prev.filter(s => s.id !== id));
            if (currentChatId === id) {
                startNewChat();
            }
        } catch (error) {
            console.error("Failed to delete session", error);
        }
    };

    const startNewChat = () => {
        setMessages([{ role: 'assistant', content: "Hello! I'm your Aedra AI Co-worker. How can I assist you with your properties today?" }]);
        setCurrentChatId(null);
    };

    const handleSend = async (customMessage?: string) => {
        const msgToSend = customMessage || input.trim();
        if (!msgToSend || isTyping) return;

        if (!customMessage) setInput('');

        const newHistory: Message[] = [...messages, { role: 'user', content: msgToSend }];
        setMessages(newHistory);
        setIsTyping(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: messages.slice(1).filter(m => m.content),
                    message: msgToSend,
                    chatId: currentChatId,
                    attachments: attachments.map(a => ({ data: a.data, mimeType: a.mimeType }))
                }),
            });
            const data = await res.json();
            if (data?.error) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.error }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            }

            if (data.chatId && data.chatId !== currentChatId) {
                setCurrentChatId(data.chatId);
                fetchSessions();
            }
            setAttachments([]); // Clear attachments after sending
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error. Please check your connection." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = (event.target?.result as string).split(',')[1];
                setAttachments(prev => [...prev, {
                    data: base64,
                    mimeType: file.type,
                    name: file.name
                }]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = ''; // Reset input
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleRegenerate = () => {
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            const lastIndex = messages.findLastIndex(m => m.role === 'user');
            setMessages(messages.slice(0, lastIndex));
            handleSend(lastUserMsg.content);
        }
    };

    return (
        <div className="flex-1 flex min-w-0 bg-background h-full overflow-hidden">
            {/* Left Sidebar (History) */}
            <div className={cn(
                "border-r border-border/50 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col transition-all duration-300 relative z-20",
                isLeftSidebarOpen ? "w-64" : "w-0 opacity-0 -translate-x-full overflow-hidden"
            )}>
                <div className="p-4 flex flex-col h-full w-64">
                    <button
                        onClick={startNewChat}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-background hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium mb-6"
                    >
                        <Plus size={16} />
                        New Chat
                    </button>

                    <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                        <div className="px-3 mb-2">
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <History size={12} />
                                History
                            </h3>
                        </div>
                        {sessions.map(session => (
                            <div
                                key={session.id}
                                onClick={() => loadSession(session.id)}
                                className={cn(
                                    "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                                    currentChatId === session.id
                                        ? "bg-zinc-200/50 dark:bg-zinc-800/50 text-foreground"
                                        : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground"
                                )}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <MessageSquare size={14} className="flex-shrink-0" />
                                    <span className="truncate">{session.title || "New Chat"}</span>
                                </div>
                                <button
                                    onClick={(e) => deleteSession(session.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                <div className="flex flex-col h-full mx-auto w-full max-w-5xl bg-background relative overflow-hidden">
                    {/* Unified Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                title="Toggle History"
                            >
                                {isLeftSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                            </button>

                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold tracking-tight">AI Co-worker</h2>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">ONLINE</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                    GEMINI 2.0 FLASH <ChevronDown size={10} />
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border",
                                isRightSidebarOpen
                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                                    : "bg-zinc-100 dark:bg-zinc-900 border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Activity size={16} />
                            <span className="text-xs font-semibold">Workflows</span>
                            {isRightSidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                        </button>
                    </div>

                    {/* Chat Messages */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto px-10 py-10 space-y-12 scrollbar-hide select-text"
                    >
                        {messages.map((m, i) => (
                            <div key={i} className={cn(
                                "flex w-full group transition-all duration-300 animate-in fade-in slide-in-from-bottom-2",
                                m.role === 'user' ? 'justify-end' : 'justify-start items-start gap-4'
                            )}>
                                {m.role === 'assistant' && (
                                    <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-border/50 shadow-sm">
                                        <div className="text-[11px] font-black text-blue-600 tracking-tighter">Ai</div>
                                    </div>
                                )}

                                <div className={cn(
                                    "flex flex-col relative",
                                    m.role === 'user' ? 'max-w-[75%] items-end' : 'max-w-[85%] items-start'
                                )}>
                                    <div className={cn(
                                        "text-[15px] leading-relaxed",
                                        m.role === 'user'
                                            ? 'bg-zinc-100 dark:bg-zinc-900 px-6 py-4 rounded-[28px] rounded-tr-none text-foreground shadow-sm border border-border/50'
                                            : 'text-foreground/90 pl-1'
                                    )}>
                                        {m.content}
                                    </div>

                                    {m.role === 'assistant' && (
                                        <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pl-1">
                                            <button
                                                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                onClick={() => handleCopy(m.content, i)}
                                            >
                                                {copiedIndex === i ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-muted-foreground" />}
                                            </button>
                                            <button
                                                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                onClick={handleRegenerate}
                                            >
                                                <RefreshCcw size={14} className="text-muted-foreground" />
                                            </button>
                                            <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                                <MoreVertical size={14} className="text-muted-foreground" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex justify-start items-start gap-4 animate-in fade-in">
                                <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 animate-pulse border border-border/50 shadow-sm">
                                    <div className="text-[11px] font-black text-blue-500/50 tracking-tighter">Ai</div>
                                </div>
                                <div className="flex gap-1.5 mt-4 pl-1">
                                    <div className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-duration:1s]" />
                                    <div className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-duration:1s] [animation-delay:0.2s]" />
                                    <div className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-duration:1s] [animation-delay:0.4s]" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="px-10 py-6 pb-10 bg-gradient-to-t from-background via-background to-transparent relative z-10">
                    {/* Selected Attachments */}
                    {attachments.length > 0 && (
                        <div className="px-14 flex flex-wrap gap-2 mb-2 animate-in fade-in slide-in-from-bottom-1">
                            {attachments.map((a, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-border text-[12px] font-medium group">
                                    <span className="truncate max-w-[120px]">{a.name}</span>
                                    <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-red-500">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative max-w-4xl mx-auto ring-1 ring-border rounded-[32px] bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-2xl shadow-black/10 hover:bg-white dark:hover:bg-zinc-900 transition-all duration-300 focus-within:bg-white dark:focus-within:bg-zinc-900 focus-within:ring-blue-500/50">
                        <div className="flex items-end gap-2 p-3.5 pl-5">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                multiple
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all h-10 w-10 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-blue-500 mb-0.5"
                            >
                                <Plus size={22} strokeWidth={2.5} />
                            </button>

                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    rows={1}
                                    placeholder="Message your Co-worker..."
                                    className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 outline-none text-[16px] resize-none py-2 max-h-[200px] overflow-y-auto scrollbar-hide text-foreground placeholder:text-muted-foreground/60 leading-relaxed translate-y-[1px]"
                                    style={{
                                        height: 'auto',
                                        minHeight: '44px'
                                    }}
                                />

                                <div className="flex items-center gap-2 mb-0.5">
                                    <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium h-10 w-10 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-muted-foreground">
                                        <Mic size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={isTyping || !input.trim()}
                                        className={cn(
                                            "inline-flex items-center justify-center h-10 w-10 rounded-full transition-all duration-500",
                                            input.trim()
                                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/40 translate-y-0"
                                                : "bg-transparent text-muted-foreground/20 pointer-events-none"
                                        )}
                                    >
                                        <SendHorizontal size={22} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p className="mt-4 text-[11px] text-center text-muted-foreground/50 select-none font-medium">
                            Aedra AI can make mistakes. Always verify important documents.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Sidebar (Workflows) */}
            <div className={cn(
                "border-l border-border/50 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col transition-all duration-300 relative z-20",
                isRightSidebarOpen ? "w-80" : "w-0 opacity-0 translate-x-full overflow-hidden"
            )}>
                <div className="p-6 flex flex-col h-full w-80">
                    <WorkflowTracker />
                </div>
            </div>
        </div>
    );
}
