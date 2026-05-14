import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const trackedFiles = execSync('git ls-files', { encoding: 'utf-8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const forbiddenTrackedFiles = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.replit',
  '.kiwoom_token_cache.json',
];

const trackedSensitiveFiles = trackedFiles.filter((file) => forbiddenTrackedFiles.includes(file));
if (trackedSensitiveFiles.length > 0) {
  console.error('❌ 민감 파일이 git에 추적되고 있습니다:', trackedSensitiveFiles.join(', '));
  process.exit(1);
}

const literalChecks = [
  {
    pattern: 'kiwoom-ai-trading-secret-key-change-in-production',
    message: '고정 SESSION_SECRET fallback 문자열이 남아있습니다.',
  },
  {
    pattern: 'my-secret-agent-key-2024',
    message: '고정 AGENT_KEY fallback 문자열이 남아있습니다.',
  },
];

const regexChecks = [
  {
    pattern: /KIWOOM_(KEY|SECRET)_\d+\s*=\s*["'][^"']+["']/g,
    message: '계정별 키움 키/시크릿 평문이 파일에 포함되어 있습니다.',
  },
  {
    pattern: /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/g,
    message: '개인키 블록이 파일에 포함되어 있습니다.',
  },
];

const textFiles = trackedFiles.filter((file) =>
  /\.(ts|tsx|js|mjs|cjs|json|md|env|yaml|yml|sh|sql|txt|toml|gitignore)$/.test(file)
);

const findings = [];
for (const file of textFiles) {
  if (file === 'scripts/check-secret-hygiene.mjs') continue;
  let content = '';
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    continue;
  }

  for (const check of literalChecks) {
    if (content.includes(check.pattern)) {
      findings.push(`${file}: ${check.message}`);
    }
  }

  for (const check of regexChecks) {
    if (check.pattern.test(content)) {
      findings.push(`${file}: ${check.message}`);
    }
    check.pattern.lastIndex = 0;
  }
}

if (findings.length > 0) {
  console.error('❌ 시크릿 위생 검사 실패');
  for (const finding of findings) {
    console.error(` - ${finding}`);
  }
  process.exit(1);
}

console.log('✅ 시크릿 위생 검사 통과');
