import { test, expect } from 'bun:test';

test('committed bundle is up to date', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/bundle.mjs', '--check'], {
    cwd: new URL('../', import.meta.url).pathname, stdout: 'inherit', stderr: 'inherit',
  });
  expect(await child.exited).toBe(0);
});
