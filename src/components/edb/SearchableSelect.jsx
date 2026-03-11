import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * options: Array<{ value: string, label: string }>
 * noneOption: if true, adds a "— None —" option with value '__none__'
 */
export default function SearchableSelect({
  value,
  onValueChange,
  options = [],
  placeholder = 'Select...',
  className,
  noneOption = false,
}) {
  const [open, setOpen] = useState(false);
  const allOptions = noneOption ? [{ value: '__none__', label: '— None —' }, ...options] : options;
  const selected = allOptions.find(o => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-7 text-xs justify-between font-normal px-2 w-full', className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." className="h-8 text-xs" />
          <CommandList className="max-h-52">
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No results.</CommandEmpty>
            <CommandGroup>
              {allOptions.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => { onValueChange(opt.value); setOpen(false); }}
                  className="text-xs"
                >
                  <Check className={cn('w-3 h-3 mr-2 shrink-0', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}