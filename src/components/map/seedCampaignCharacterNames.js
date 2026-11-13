import { getFile, setFile } from '@/lib/bigFileStore';
import { getCharacterDisplayNames } from '@/lib/characterNames';
import { updateStringsBinFile } from '@/lib/stringsBinStore';
import { parseStringsBin } from '@/components/strings/stringsBinCodec';

// Campaign folders retain original File objects, not the latest mod edits.
export default async function seedCampaignCharacterNames(file) {
  if (getFile('m2tw_names_file') !== null) return;
  const raw = await file.text();
  if (getFile('m2tw_names_file') === null) setFile('m2tw_names_file', raw);
}

export async function seedCampaignCharacterDisplayNames(file) {
  if (Object.keys(getCharacterDisplayNames()).length) return;
  const decoded = parseStringsBin(await file.arrayBuffer());
  if (decoded?.entries?.length && !Object.keys(getCharacterDisplayNames()).length) {
    updateStringsBinFile(file.name, decoded);
  }
}