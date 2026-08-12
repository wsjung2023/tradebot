import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const [launcher, port] of [
  ['start-dev-server.bat', 5002],
  ['start-server.bat', 5000],
]) {
  const contents = readFileSync(launcher, 'utf8');

  assert.match(contents, new RegExp(`clear-server-port\\.ps1" -Port ${port}`),
    `${launcher} must clear an orphaned listener before a task-level restart`);
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

const portCleaner = readFileSync('scripts/clear-server-port.ps1', 'utf8');
assert.match(portCleaner, /ProcessName -ne 'node'/);
assert.match(portCleaner, /Stop-Process/);

const registration = readFileSync('register-task.ps1', 'utf8');
assert.match(registration, /TradeBot-Server/);
assert.match(registration, /TradeBot-Dev-Server/);
assert.match(registration, /-LogonType Interactive/);
assert.match(registration, /-RestartCount 999/);
assert.match(registration, /-RestartInterval \(New-TimeSpan -Minutes 1\)/);
assert.match(registration, /-StartWhenAvailable/);
assert.match(registration, /\$SettingsOnly/);
assert.match(registration, /New-ScheduledTaskTrigger -Once/);
assert.match(registration, /-RepetitionInterval \(New-TimeSpan -Minutes 1\)/);

console.log('server launcher visibility test passed');
