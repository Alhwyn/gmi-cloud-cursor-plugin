import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('../bundle/server.mjs', import.meta.url);
const result = await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['src/index.ts'], bundle: true, platform: 'node', target: 'node20', format: 'esm',
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  write: false, legalComments: 'inline',
});
const generated = result.outputFiles[0].contents;
if (process.argv.includes('--check')) {
  const committed = await readFile(output).catch(() => Buffer.alloc(0));
  if (!committed.equals(Buffer.from(generated))) {
    console.error('FAIL: bundle/server.mjs is missing or stale. Run npm run bundle and commit it.');
    process.exitCode = 1;
  } else console.log('PASS: committed bundle matches source and locked dependencies');
} else {
  await writeFile(output, generated);
  console.log('Built bundle/server.mjs (standalone Node.js 20+ runtime)');
}
