import { defineConfig } from 'tsup';

// Dual CJS + ESM so the NestJS api (CommonJS) and the bundlers used by
// Next.js and Metro (ESM) consume the same build.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
});
