"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface PaginationProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    className?: string
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    className,
}: PaginationProps) {
    if (totalPages <= 1) return null

    const pages = []
    const showMax = 5

    if (totalPages <= showMax) {
        for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
        pages.push(1)
        if (currentPage > 3) pages.push("...")

        const start = Math.max(2, currentPage - 1)
        const end = Math.min(totalPages - 1, currentPage + 1)

        for (let i = start; i <= end; i++) {
            if (!pages.includes(i)) pages.push(i)
        }

        if (currentPage < totalPages - 2) pages.push("...")
        if (!pages.includes(totalPages)) pages.push(totalPages)
    }

    return (
        <nav
            role="navigation"
            aria-label="pagination"
            className={cn("mx-auto flex w-full justify-center gap-1 py-4", className)}
        >
            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Go to previous page"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            {pages.map((page, i) => {
                if (page === "...") {
                    return (
                        <div
                            key={`ellipsis-${i}`}
                            className="flex h-9 w-9 items-center justify-center"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </div>
                    )
                }

                return (
                    <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="icon"
                        onClick={() => onPageChange(page as number)}
                        aria-label={`Go to page ${page}`}
                        aria-current={currentPage === page ? "page" : undefined}
                    >
                        {page}
                    </Button>
                )
            })}

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label="Go to next page"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </nav>
    )
}
