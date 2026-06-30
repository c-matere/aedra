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
        { value: "CLEANING", label: "Cleaning", icon: Sparkles, color: "text-[#73726c]" },
        { value: "SECURITY", label: "Security", icon: Shield, color: "text-[#73726c]" },
        { value: "SALARY", label: "Caretaker / Salary", icon: UserCircle, color: "text-[#73726c]" },
        { value: "UTILITY", label: "Common Utilities", icon: Clock, color: "text-[#73726c]" },
        { value: "OTHER", label: "Other", icon: Plus, color: "text-[#73726c]" },
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
                <h3 className="text-xs font-bold text-[#73726c] uppercase tracking-widest flex items-center gap-2">
                    Recurring Expense Schedules
                </h3>
            </div>

            {/* Quick Add Form */}
            <div className="bg-[#ffffff] border border-[#dedcd1] p-4 rounded-[16px] space-y-4 shadow-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">Title / Description</label>
                        <Input 
                            placeholder="e.g. Monthly Security Fee" 
                            className="bg-[#ffffff] border-[#dedcd1] text-sm h-10 focus:border-[#1f1e1d] focus:outline-none placeholder-[#9c9a92] rounded-[9.6px]"
                            value={newExpense.description}
                            onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">Amount (KES)</label>
                            <Input 
                                type="number" 
                                placeholder="0.00" 
                                className="bg-[#ffffff] border-[#dedcd1] text-sm h-10 focus:border-[#1f1e1d] focus:outline-none placeholder-[#9c9a92] rounded-[9.6px]"
                                value={newExpense.amount}
                                onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-[#73726c] ml-1">Day of Month</label>
                            <Input 
                                type="number" 
                                min="1" 
                                max="31" 
                                className="bg-[#ffffff] border-[#dedcd1] text-sm h-10 focus:border-[#1f1e1d] focus:outline-none rounded-[9.6px]"
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
                                ? "bg-[#ccdbe8] border-[#dedcd1] text-[#141413]" 
                                : "bg-[#ffffff] border-[#dedcd1] text-[#73726c] hover:bg-[#f0eee6] hover:text-[#1f1e1d]"
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
                        className="bg-primary text-primary-foreground hover:opacity-90 font-medium h-9 px-6 rounded-[9.6px] border-none shadow-none"
                    >
                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Plus className="h-4 w-4 mr-1.5" />}
                        Add Schedule
                    </Button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#73726c]">
                        <Loader2 className="h-6 w-6 animate-spin text-[#1f1e1d]" />
                        <span className="text-xs font-medium">Loading schedules...</span>
                    </div>
                ) : expenses.length > 0 ? (
                    expenses.map(expense => {
                        const cat = categories.find(c => c.value === expense.category) || categories[5]
                        return (
                            <Card key={expense.id} className={`bg-[#ffffff] border border-[#dedcd1] overflow-hidden transition-all hover:bg-[#f0eee6] rounded-[16px] shadow-none ${!expense.isActive ? 'opacity-50 grayscale' : ''}`}>
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-[9.6px] bg-[#f0eee6] border border-[#dedcd1] flex items-center justify-center text-[#1f1e1d] shrink-0">
                                        <cat.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-[#1f1e1d] text-sm truncate">{expense.description}</h4>
                                            <Badge className="bg-[#f0eee6] border-[#dedcd1] text-[#73726c] text-[9px] h-4 rounded-[9.6px] shadow-none hover:bg-[#f0eee6]">
                                                {cat.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <p className="text-[#141413] font-normal font-serif text-sm">KES {expense.amount.toLocaleString()}</p>
                                            <div className="flex items-center gap-1 text-[11px] text-[#73726c]">
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
                                            className="h-9 w-9 rounded-[9.6px] hover:bg-[#f0eee6] text-[#73726c] hover:text-[#1f1e1d]"
                                        >
                                            <Power className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={() => handleDelete(expense.id)}
                                            className="h-9 w-9 rounded-[9.6px] hover:bg-red-500/5 hover:text-red-800"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : (
                    <div className="py-12 text-center rounded-[16px] border border-dashed border-[#dedcd1] bg-[#f0eee6]/10">
                        <Clock className="h-8 w-8 text-[#9c9a92] mx-auto mb-3" />
                        <p className="text-sm text-[#73726c]">No recurring expenses scheduled yet.</p>
                        <p className="text-[10px] text-[#9c9a92] mt-1 uppercase tracking-tight">Automate cleaning, security, and staff salaries</p>
                    </div>
                )}
            </div>

            {/* Info Message */}
            <div className="flex gap-3 p-4 rounded-[16px] bg-[#ccdbe8]/20 border border-[#dedcd1]">
                <AlertCircle className="h-5 w-5 text-[#1f1e1d] flex-shrink-0" />
                <div className="text-xs text-[#1f1e1d] leading-relaxed">
                    <span className="text-[#141413] font-bold">Automation Info:</span> Scheduled expenses are generated automatically at midnight on their respective days. You can track generated entries in the main expense ledger.
                </div>
            </div>
        </section>
    )
}
