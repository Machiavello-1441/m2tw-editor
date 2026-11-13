import { getStringsBinStore } from '@/lib/stringsBinStore';
import { normalizedFileName } from '@/lib/modFileRegistry';
import { encodeStoredStringsBin } from '@/components/strings/stringsBinCodec';
import { entriesToTextBytes, txtNameFor } from '@/lib/stringsTxtFile';
import { writeLatestZipFile, removeZipFile } from '@/components/export/zipFilePrecedence';

/** Include UI dictionaries as binaries; ordered rows must never become fake {keys}. */
export function addSharedStringsToZip(dataFolder, files = getStringsBinStore()) {
  for (const [name, data] of Object.entries(files)) {
    try {
      const filename = normalizedFileName(name);
      writeLatestZipFile(dataFolder, `text/${filename}`, new Uint8Array(encodeStoredStringsBin(data)));
      if (data.magic1 !== 1 && data.format !== 'ordered') {
        writeLatestZipFile(dataFolder, `text/${txtNameFor(filename)}`, entriesToTextBytes(data.entries));
      } else removeZipFile(dataFolder, `text/${txtNameFor(filename)}`);
    } catch (error) {
      throw new Error(`Could not export ${name}: ${error.message}`);
    }
  }
}