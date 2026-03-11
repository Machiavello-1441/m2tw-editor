import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * options: [{ value: string, label: string }]
 * includeNone: boolean — prepend a "— None —" option
 */
export default function SearchableSelect({
  value,
  onValueChange,
  options = [],
  placeholder = 'Select...',
  includeNone = false,
  noneValue = '__none__',
  noneLabel = '— None —',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const found = options.find(o => o.value === value);
  const displayLabel = value === noneValue || !value
    ? (includeNone ? noneLabel : placeholder)
    : (found ? found.label : value);

  const allOptions = includeNone
    ? [{ value: noneValue, label: noneLabel }, ...options]
    : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-7 text-xs justify-between font-normal w-full', className)}
        >
          <span className="truncate text-left">{displayLabel}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="start">
        <Command>
          <CommandInput placeholder="Search..." className="h-8 text-xs" />
          <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">No results.</CommandEmpty>
          <CommandGroup className="max-h-60 overflow-auto">
            {allOptions.map(opt => (
              <CommandItem
                key={opt.value}
                value={opt.label}
                onSelect={() => {
                  onValueChange(opt.value);
                  setOpen(false);
                }}
                className="text-xs cursor-pointer"
              >
                <Check className={cn('mr-2 h-3 w-3', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                {opt.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}