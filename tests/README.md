# Shared file-loading regression tests

These tests use synthetic mod snippets and isolated browser/storage environments. They do not read user files, contact an account API, publish the app, or modify the real browser's mod cache.

## Run

The app dependencies provide Vite/esbuild and React. The tests additionally require `jsdom` and `fake-indexeddb`, either in the app's development environment or in a separate test-only dependency directory. They were run with Node.js 24 in the Base44 sandbox.

```sh
node tests/edu-source-preservation.mjs
node tests/strings-bin-formats.mjs
node tests/shared-file-loading.mjs
node tests/editor-loading-smoke.mjs
npm run build
```

For an external test-only dependency installation:

```sh
M2TW_TEST_DEPS=/absolute/path/to/test-dependencies node tests/shared-file-loading.mjs
M2TW_TEST_DEPS=/absolute/path/to/test-dependencies node tests/editor-loading-smoke.mjs
```

`M2TW_TEST_DEPS` points to the directory containing that installation's `node_modules`, not to `node_modules` itself. In PowerShell, set `$env:M2TW_TEST_DEPS` before running the Node commands.

## Coverage

`shared-file-loading.mjs` contains 12 regression cases: canonical and legacy file keys, full native browser storage, two-way expanded/menu string sharing, legacy migration, large-file restoration into a fresh browser environment, replacement/deletion, change notifications, picker recognition, banner texture paths and duplication, truncated binaries, faction duplication dependencies, unavailable IndexedDB, and explicit cache clearing. Several cases cover more than one of these conditions.

`editor-loading-smoke.mjs` contains 15 React/storage smoke checks. It selects synthetic files through the actual Home folder picker while native local/session storage writes fail, includes an intentionally unreadable binary and an unsupported map file, then navigates to Factions, Strings, Units and back to Home. It verifies all 11 Faction dependencies and tests value-only ordered binaries under all five reported filenames: battle, battle_ed, shared, strat, and tooltips. It exercises actual value editing and single-file export, checks ZIP inclusion without fake keyed text twins, verifies separate failed/skipped counts, and restores the format metadata after a simulated page reload.

`strings-bin-formats.mjs` contains 15 independent binary-fixture checks. Coverage includes type 1 value-only and type 2 keyed data, uint32 record counts above 65535, UTF-16 code-unit preservation, no-footer and zero-footer variants, recognised keyed lookup trailers, unchanged preservation of unknown trailers, index/count edit restrictions, invalid signature diagnostics, typed-array offsets, truncated records, and the exact reported 3025 + 5 + 6 = 3036 import breakdown. Its hard-coded byte fixtures and independent fixture builder do not rely on the app encoder to generate every decoder input.

`edu-source-preservation.mjs` adds 16 cases for exact source preservation. It independently checks ship/engine/custom directives, headers, BOM, mixed line endings, comments, exact token matching, culture lists, repeat/no-match handling, input validation, insertion verification, JSON source metadata, explicit field edits, no parsed-only fallback, and the pre-faction backup. The UI suite now clicks the actual faction duplication modal, downloads and inspects the faction ZIP, verifies the Unit Editor download byte-for-byte, downloads the backup, and repeats the export after navigation/restoration.

The combined suite currently contains 58 passing checks. The five named fixtures are synthetic, not copies of the user's original game files.

These are DOM/storage tests, not screenshot or visual-layout tests. They do not certify every mod-specific syntax variant or every optional binary/image asset. Existing React warnings and dependency update notices may appear without a failed assertion.

## Storage rules for future editor changes

Use `getFile` / `setFile` / `removeFile` from `src/lib/bigFileStore`, or the explicit adapters in `src/lib/editorStorage`, rather than reading native localStorage directly. File aliases belong in `src/lib/modFileRegistry`; parsed lists must not be aliases for raw source text. Keep picker recognition, Home import handling and editor reader mappings aligned when adding a format.

For strings binaries, use `decodeStringsBin` in import UIs for precise diagnostics and preserve its complete returned metadata in the shared store. Use `encodeStoredStringsBin` for single-file or ZIP exports. A type 1 file's numeric keys are synthetic display labels and must not be serialised as named identifiers or used to populate keyed faction/trait/building dictionaries. Do not change the count or order of its records. Unknown trailers can be viewed and exported unchanged, but edits remain locked until their layout is understood.

Use `FILES_CHANGED_EVENT` with key filtering for mounted consumers. Do not write files back from a refresh listener. Await `flushBigFiles` before reporting a completed batch import. Keep any persistence failure visible to the user, and never clear shared mod files in a `beforeunload` handler.

## EDU safety rules

Faction addition must use `patchEduOwnership` and `verifyEduOwnershipPatch` on the authoritative raw `m2tw_units_file`. Never feed a parsed unit array to a serializer as a fallback. If the raw source is missing, stop and request an intact original. A source with no matching membership lines is a no-op, not a reason to reconstruct it from stale cache data.

The patch inserts the new faction only into active matching `ownership` and `era` lines. It leaves original characters in place, including separator spacing, inline comments, CRLF/LF/CR endings and unsupported directives. `m2tw_units_before_faction_patch` holds the immediately preceding raw source when an actual change occurs; repeat/no-op requests do not overwrite this backup.

Unit Editor hydration and downloads do not rewrite the raw file. Explicit Unit Editor changes use source-backed blocks and update only deliberately changed supported directives; unknown lines stay in the source. Source-less legacy caches cannot be used for editing, downloading or copying imported units. Newly created units can use the explicit new-unit template. These tests validate source preservation, not in-game execution or recovery of directives erased by an earlier export.
