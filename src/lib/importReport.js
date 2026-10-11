/** Include all three outcomes even when the batch contains failures. */
export function formatImportSummary(result, total) {
  return `Loaded ${result.ok || 0}/${total}, failed ${result.errors?.length || 0}, skipped ${result.skipped?.length || 0}`;
}
