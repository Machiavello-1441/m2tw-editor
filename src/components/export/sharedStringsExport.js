import { getStringsBinStore } from '@/lib/stringsBinStore';
import { normalizedFileName } from '@/lib/modFileRegistry';
import { encodeStoredStringsBin } from '@/components/strings/stringsBinCodec';

/** Include UI dictionaries as binaries; ordered rows must never become fake {keys}. */
export function addSharedStringsToZip(dataFolder, files = getStringsBinStore()) {
  for (const [name, data] of Object.entries(files)) {
    try {
      dataFolder.file(`text/${normalizedFileName(name)}`, new Uint8Array(encodeStoredStringsBin(data)));
    } catch (error) {
      throw new Error(`Could not export ${name}: ${error.message}`);
    }
  }
}
