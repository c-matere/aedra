"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { type CompanyRecord } from "@/lib/backend-api";
import { Building2, Loader2 } from "lucide-react";

interface CompanySelectorProps {
    companies: CompanyRecord[];
    currentCompanyId: string;
}

export function CompanySelector({ companies, currentCompanyId }: CompanySelectorProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleSelect = (companyId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("companyId", companyId);
        
        startTransition(() => {
            router.push(`/admin/settings?${params.toString()}`);
        });
    };

    return (
        <div className="flex flex-col gap-2 p-4 bg-white/5 border border-white/10 rounded-xl mb-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Building2 className="h-4 w-4 text-neutral-400" />
                Manage Company Settings
            </div>
            <div className="flex items-center gap-3">
                <Select
                    value={currentCompanyId}
                    onValueChange={handleSelect}
                    disabled={isPending}
                >
                    <SelectTrigger className="w-[300px] bg-neutral-900 border-white/10 text-white">
                        <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-white/10 text-white">
                        {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {isPending && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
            </div>
            <p className="text-xs text-neutral-500">
                Super Admin mode: You can switch between companies to manage their individual settings.
            </p>
        </div>
    );
}
