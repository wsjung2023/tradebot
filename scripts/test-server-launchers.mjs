import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const launcher of ['start-dev-server.bat', 'start-server.bat']) {
  const contents = readFileSync(launcher, 'utf8');

  assert.match(contents, /scripts\\run-server-with-log\.ps1/,
    `${launcher} must display server output while writing the log file`);
  assert.doesNotMatch(contents, /npm run dev\s*>>/,
    `${launcher} must not hide server output with file-only redirection`);
  assert.doesNotMatch(contents, /Tee-Object/,
    `${launcher} must not use Windows PowerShell's UTF-16 Tee-Object output`);
  assert.match(contents, /:restart/);
  assert.match(contents, /goto restart/);
}

const logRunner = readFileSync('scripts/run-server-with-log.ps1', 'utf8');
assert.match(logRunner, /UTF8Encoding\(\$false\)/);
assert.match(logRunner, /\[Console\]::WriteLine/);
assert.match(logRunner, /StreamWriter/);

console.log('server launcher visibility test passed');
