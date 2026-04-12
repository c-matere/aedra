"use client"

import { useState, useEffect } from "react"
import { 
    Clock, 
    Plus, 
    Trash2, 
    Power, 
    AlertCircle, 
    Calendar,
    Wallet,
    Shield,
    Sparkles,
    UserCircle,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    getRecurringExpenses,
    createRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense
} from "@/lib/backend-api"
import type { RecurringExpenseRecord } from "@/lib/backend-api"

interface RecurringExpensesProps {
    propertyId: string
    token: string
}

export function RecurringExpenses({ propertyId, token }: RecurringExpensesProps) {
    const [expenses, setExpenses] = useState<RecurringExpenseRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [newExpense, setNewExpense] = useState({
        description: "",
        amount: "",
        dayOfMonth: "1",
        category: "CLEANING"
    })

    const categories = [
        { value: "CLEANING", label: "Cleaning", icon: Sparkles, color: "text-blue-400" },
        { value: "SECURITY", label: "Security", icon: Shield, color: "text-red-400" },
        { value: "SALARY", label: "Caretaker / Salary", icon: UserCircle, color: "text-purple-400" },
        { value: "UTILITY", label: "Common Utilities", icon: Clock, color: "text-amber-400" },
        { value: "OTHER", label: "Other", icon: Plus, color: "text-neutral-400" },
    ]

    const fetchExpenses = async () => {
        setLoading(true)
        const res = await getRecurringExpenses(token, propertyId)
        if (res.data) setExpenses(res.data)
        setLoading(false)
    }

    useEffect(() => {
        fetchExpenses()
    }, [propertyId, token])

    const handleCreate = async () => {
        if (!newExpense.description || !newExpense.amount) return
        
        setIsCreating(true)
        const res = await createRecurringExpense(token, {
            propertyId,
            description: newExpense.description,
            amount: parseFloat(newExpense.amount),
            dayOfMonth: parseInt(newExpense.dayOfMonth),
            category: newExpense.category
        })
        
        if (res.data) {
            setExpenses([...expenses, res.data])
            setNewExpense({ description: "", amount: "", dayOfMonth: "1", category: "CLEANING" })
        }
        setIsCreating(false)
    }

    const handleToggleActive = async (id: string, current: boolean) => {
        const res = await updateRecurringExpense(token, id, { isActive: !current })
        if (res.data) {
            setExpenses(expenses.map(e => e.id === id ? res.data! : e))
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this recurring expense?")) return
        const res = await deleteRecurringExpense(token, id)
        if (!res.error) {
            setExpenses(expenses.filter(e => e.id !== id))
        }
    }

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    Recurring Expense Schedules
                </h3>
            </div>

            {/* Quick Add Form */}
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 ml-1">Title / Description</label>
                        <Input 
                            placeholder="e.g. Monthly Security Fee" 
                            className="bg-black/20 border-white/5 text-sm h-10"
                            value={newExpense.description}
                            onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-neutral-500 ml-1">Amount (KES)</label>
                            <Input 
                                type="number" 
                                placeholder="0.00" 
                                className="bg-black/20 border-white/5 text-sm h-10"
                                value={newExpense.amount}
                                onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-neutral-500 ml-1">Day of Month</label>
                            <Input 
                                type="number" 
                                min="1" 
                                max="31" 
                                className="bg-black/20 border-white/5 text-sm h-10"
                                value={newExpense.dayOfMonth}
                                onChange={e => setNewExpense({...newExpense, dayOfMonth: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat.value}
                            onClick={() => setNewExpense({...newExpense, category: cat.value})}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                newExpense.category === cat.value 
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                                : "bg-white/5 border-white/5 text-neutral-500 hover:text-neutral-300"
                            }`}
                        >
                            <cat.icon className="h-3.5 w-3.5" />
                            {cat.label}
                        </button>
                    ))}
                    <div className="flex-1" />
                    <Button 
                        size="sm" 
                        onClick={handleCreate}
                        disabled={isCreating || !newExpense.description || !newExpense.amount}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 px-6 rounded-xl"
                    >
                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                        Add Schedule
                    </Button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-xs font-medium">Loading schedules...</span>
                    </div>
                ) : expenses.length > 0 ? (
                    expenses.map(expense => {
                        const cat = categories.find(c => c.value === expense.category) || categories[5]
                        return (
                            <Card key={expense.id} className={`bg-white/[0.02] border border-white/5 overflow-hidden transition-all hover:bg-white/[0.04] ${!expense.isActive ? 'opacity-50 grayscale' : ''}`}>
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${cat.color}`}>
                                        <cat.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-white text-sm truncate">{expense.description}</h4>
                                            <Badge variant="outline" className="bg-black/40 border-white/10 text-[9px] h-4">
                                                {cat.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <p className="text-emerald-400 font-black text-sm">KES {expense.amount.toLocaleString()}</p>
                                            <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                                                <Calendar className="h-3 w-3" />
                                                Runs on day {expense.dayOfMonth}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={() => handleToggleActive(expense.id, expense.isActive)}
                                            className={`h-9 w-9 rounded-xl transition-colors ${expense.isActive ? 'hover:bg-amber-500/10 hover:text-amber-500' : 'hover:bg-emerald-500/10 hover:text-emerald-500'}`}
                                        >
                                            <Power className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={() => handleDelete(expense.id)}
                                            className="h-9 w-9 rounded-xl hover:bg-red-500/10 hover:text-red-500"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                        <Clock className="h-8 w-8 text-neutral-700 mx-auto mb-3" />
                        <p className="text-sm text-neutral-500">No recurring expenses scheduled yet.</p>
                        <p className="text-[10px] text-neutral-600 mt-1 uppercase tracking-tight">Automate cleaning, security, and staff salaries</p>
                    </div>
                )}
            </div>

            {/* Info Message */}
            <div className="flex gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <p className="text-xs text-neutral-400 leading-relaxed">
                    <span className="text-blue-400 font-bold">Automation Info:</span> Scheduled expenses are generated automatically at midnight on their respective days. You can track generated entries in the main expense ledger.
                </p>
            </div>
        </section>
    )
}
