import { randomBytes } from 'node:crypto';

function makeSecret(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

const sessionSecret = makeSecret(48);
const agentKey = makeSecret(48);

console.log('# Generated secure values');
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`AGENT_KEY=${agentKey}`);
console.log('\n# Copy into Replit Secrets / deployment secret manager (do not commit)');
