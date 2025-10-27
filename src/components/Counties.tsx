"use client"

import { useState } from "react"
import countries from "world-countries"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
} from "@/components/ui/dialog"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command"
import { ChevronsUpDown } from "lucide-react"
import { DialogTitle } from "@radix-ui/react-dialog"

export default function CountrySelect({
  value,
  onChange,
}: {
  value?: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        Country of residence
      </label>

      {/* Trigger */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none"
          >
            {value ? (
              <>
                {countries.find((c) => c.name.common === value)?.flag} {value}
              </>
            ) : (
              <span className="text-muted-foreground">Select country</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </button>
        </DialogTrigger>
        

        {/* Dropdown content */}
        <DialogContent className="p-0 max-w-md w-[90vw] max-h-[90vh] overflow-hidden divide-y divide-gray-300 gap-0">
          <DialogTitle className="flex px-2 py-2 justify-center" >
            <span className="font-semibold text-center">Country of Issuance</span>
          </DialogTitle>
          <Command className="rounded rounded-t-none">
            <CommandInput placeholder="Search country..." className="h-9" />
            <CommandList className="max-h-[70vh] overflow-y-auto overscroll-contain">
              <CommandEmpty>No countries found.</CommandEmpty>
              {countries.map((c) => (
                <CommandItem
                  key={c.cca2}
                  value={c.name.common}
                  onSelect={() => {
                    onChange(c.name.common)
                    setOpen(false)
                  }}
                >
                  {c.flag} {c.name.common}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  )
}
