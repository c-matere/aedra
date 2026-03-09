'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function ChatWindow() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm your Aedra AI Co-worker. How can I assist you with your properties today?" }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsTyping(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: messages, message: userMsg }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error. Please check your connection." }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <Card className="flex flex-col h-[calc(100vh-12rem)] bg-zinc-950 border-zinc-800">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
            >
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${m.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-900 text-zinc-200 border border-zinc-800'
                            }`}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-900 rounded-2xl p-3 space-x-1 flex border border-zinc-800">
                            <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
                            <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950/50">
                <div className="flex space-x-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask anything..."
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                    />
                    <Button onClick={handleSend} disabled={isTyping} className="bg-blue-600 hover:bg-blue-700">
                        Send
                    </Button>
                </div>
            </div>
        </Card>
    );
}
