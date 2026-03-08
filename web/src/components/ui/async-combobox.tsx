"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface AsyncComboboxOption {
    value: string
    label: string
}

interface AsyncComboboxProps {
    onSearch: (query: string) => Promise<AsyncComboboxOption[]>
    value?: string
    onValueChange: (value: string) => void
    placeholder?: string
    emptyMessage?: string
    className?: string
    name?: string
    required?: boolean
    initialOptions?: AsyncComboboxOption[]
}

export function AsyncCombobox({
    onSearch,
    value,
    onValueChange,
    placeholder = "Search...",
    emptyMessage = "No results found.",
    className,
    name,
    required,
    initialOptions = []
}: AsyncComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [options, setOptions] = React.useState<AsyncComboboxOption[]>(initialOptions)
    const [loading, setLoading] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")

    const debouncedSearchValue = React.useDeferredValue(searchValue)

    React.useEffect(() => {
        async function loadOptions() {
            setLoading(true)
            try {
                const results = await onSearch(debouncedSearchValue)
                setOptions(results)
            } catch (error) {
                console.error("Failed to load options:", error)
            } finally {
                setLoading(false)
            }
        }

        if (open) {
            loadOptions()
        }
    }, [debouncedSearchValue, onSearch, open])

    // If initialOptions change, update local state
    React.useEffect(() => {
        if (initialOptions.length > 0) {
            setOptions(initialOptions)
        }
    }, [initialOptions])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10", className)}
                >
                    {value
                        ? options.find((option) => option.value === value)?.label || "Loading..."
                        : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full min-w-[200px] p-0 bg-neutral-900 border-white/10 text-white shadow-2xl">
                <Command className="bg-transparent text-white" shouldFilter={false}>
                    <CommandInput
                        placeholder={placeholder}
                        className="text-white bg-transparent border-none focus:ring-0"
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList className="max-h-[300px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        ) : options.length === 0 ? (
                            <CommandEmpty>{emptyMessage}</CommandEmpty>
                        ) : (
                            <CommandGroup>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        onSelect={(currentValue) => {
                                            onValueChange(currentValue === value ? "" : currentValue)
                                            setOpen(false)
                                            setSearchValue("")
                                        }}
                                        className="hover:bg-white/10 data-[selected=true]:bg-white/15 text-white"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === option.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {option.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
            {name && <input type="hidden" name={name} value={value} required={required} />}
        </Popover>
    )
}
