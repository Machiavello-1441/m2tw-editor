import { createSharedDictionaryBinding } from '@/lib/sharedDictionary';
import { parseUnitDescriptionStrings, serializeUnitDescriptionStrings } from '@/components/units/unitDescriptionsCodec';

export default function storeImportedUnitDescriptions(text) {
  return createSharedDictionaryBinding('export_units.txt.strings.bin', 'm2tw_export_units_file', parseUnitDescriptionStrings, serializeUnitDescriptionStrings).update(parseUnitDescriptionStrings(text));
}