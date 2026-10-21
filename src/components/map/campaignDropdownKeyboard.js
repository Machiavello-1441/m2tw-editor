export default function campaignDropdownKeyboard(event, options, current, onSelect) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  const values = options.filter(option => typeof option !== 'object' || !option.disabled).map(option => String(typeof option === 'object' ? option.value : option));
  if (!values.length) return;
  const index = values.indexOf(String(current ?? ''));
  const direction = event.key === 'ArrowDown' ? 1 : -1;
  const next = index < 0 ? (direction > 0 ? 0 : values.length - 1) : Math.max(0, Math.min(values.length - 1, index + direction));
  if (values[next] !== String(current ?? '')) onSelect(values[next]);
}