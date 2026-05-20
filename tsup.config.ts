import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: 'inline',
    clean: true,
    external: ['react', 'react-dom'],
    noExternal: ['jszip', 'cheerio', 'cheerio-select', 'domhandler', 'domutils', 'htmlparser2', 'entities'],
    platform: 'browser',
    treeshake: true,
  },
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    platform: 'node',
    shims: true,
    noExternal: [/./],
  }
]);
