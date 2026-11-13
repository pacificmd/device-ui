import { defineConfig } from 'tsup';

// Every path is its own entry. A pack reaches the base by name, so a page has one base however many paths it imports.
export default defineConfig([
  {
    entry: ['src/base/index.ts', 'src/materials/*.ts', 'src/packs/*.ts', 'src/packs/controls/*.ts', 'src/sound/index.ts', 'src/air/index.ts', 'src/hand/index.ts', 'src/print/index.ts', 'src/react/index.ts'],
    format: 'esm',
    external: ['device-ui', 'react'],
  },
  // One file, as a global, for a page with no build step: base and controls, or those and every pack.
  {
    entry: { 'device-ui': 'src/script/index.ts', 'device-ui.all': 'src/script/all.ts' },
    format: 'iife',
    globalName: 'DeviceUI',
    minify: true,
  },
]);
