# Shared file-loading regression tests

These tests use synthetic mod snippets and isolated browser/storage environments. They do not read user files, contact an account API, publish the app, or modify the real browser's mod cache.

## Run

The app dependencies provide Vite/esbuild and React. The tests additionally require `jsdom` and `fake-indexeddb`, either in the app's development environment or in a separate test-only dependency directory. They were run with Node.js 24 in the Base44 sandbox.

```sh
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

`editor-loading-smoke.mjs` contains 6 React smoke checks. It selects synthetic files through the actual Home folder picker while native local/session storage writes fail, includes an intentionally unreadable binary before later files, then navigates to Factions, Strings, Units and back to Home. It verifies all 11 Faction dependencies and checks that page-unload handlers do not delete shared files before restoration.

These are DOM/storage tests, not screenshot or visual-layout tests. They do not certify every mod-specific syntax variant or every optional binary/image asset. Existing React warnings and dependency update notices may appear without a failed assertion.

## Storage rules for future editor changes

Use `getFile` / `setFile` / `removeFile` from `src/lib/bigFileStore`, or the explicit adapters in `src/lib/editorStorage`, rather than reading native localStorage directly. File aliases belong in `src/lib/modFileRegistry`; parsed lists must not be aliases for raw source text. Keep picker recognition, Home import handling and editor reader mappings aligned when adding a format.

Use `FILES_CHANGED_EVENT` with key filtering for mounted consumers. Do not write files back from a refresh listener. Await `flushBigFiles` before reporting a completed batch import. Keep any persistence failure visible to the user, and never clear shared mod files in a `beforeunload` handler.
