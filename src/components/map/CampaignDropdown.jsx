import React, { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import campaignDropdownOptions from '@/components/map/campaignDropdownOptions';
import CampaignDropdownMenu from '@/components/map/CampaignDropdownMenu';

export default function CampaignDropdown({ children, value, defaultValue, onChange, disabled, className = '', name, required, ...props }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const [selected, setSelected] = useState(defaultValue);
  const select = useRef(null);
  const options = campaignDropdownOptions(children);
  const current = String(value ?? selected ?? options.find(option => !option.disabled)?.value ?? '');
  const label = options.find(option => option.value === current)?.label ?? options.find(option => !option.disabled)?.label ?? 'Select…';
  const choose = next => {
    select.current.value = next;
    select.current.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
  };
  return <>
    <select ref={select} hidden tabIndex={-1} aria-hidden="true" name={name} required={required} disabled={disabled} value={value} defaultValue={defaultValue} onChange={event => { onChange?.(event); setSelected(event.currentTarget.value); }}>{children}</select>
    <Popover open={open} onOpenChange={next => { setOpen(next); setQuery(''); }}>
      <PopoverTrigger asChild>
        <button {...props} type="button" disabled={disabled} className={`inline-flex min-w-0 items-center justify-between gap-1 text-left ${className}`}>
          <span className="truncate">{label}</span><ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="dark z-[1101] w-[var(--radix-popover-trigger-width)] min-w-40 p-0">
        <CampaignDropdownMenu options={options} current={current} query={query} setQuery={setQuery} choose={choose} />
      </PopoverContent>
    </Popover>
  </>;
}