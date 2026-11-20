import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('../bundle/server.mjs', import.meta.url);
const result = Bun.spawn([process.execPath, 'build', 'src/index.ts', '--target=node', '--format=esm', '--packages=bundle', '--env=disable'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), stdout: 'pipe', stderr: 'inherit',
});
const generated = Buffer.from(await new Response(result.stdout).arrayBuffer());
if (await result.exited !== 0) throw new Error('bun build failed');
if (process.argv.includes('--check')) {
  const committed = await readFile(output).catch(() => Buffer.alloc(0));
  if (!committed.equals(Buffer.from(generated))) {
    console.error('FAIL: bundle/server.mjs is missing or stale. Run bun run bundle and commit it.');
    process.exitCode = 1;
  } else console.log('PASS: committed bundle matches source and locked dependencies');
} else {
  await writeFile(output, generated);
  console.log('Built bundle/server.mjs (standalone Node.js 20+ runtime)');
}
