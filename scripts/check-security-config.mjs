const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || '';
const agentKey = process.env.AGENT_KEY || '';

let failed = false;

function fail(message) {
  console.error(`❌ ${message}`);
  failed = true;
}

function pass(message) {
  console.log(`✅ ${message}`);
}

if (isProduction) {
  if (sessionSecret.length < 32) {
    fail('production requires SESSION_SECRET with length >= 32');
  } else {
    pass('SESSION_SECRET length check passed (production)');
  }

  if (agentKey.length < 32) {
    fail('production requires AGENT_KEY with length >= 32');
  } else {
    pass('AGENT_KEY length check passed (production)');
  }
} else {
  if (!sessionSecret) {
    console.warn('⚠️ SESSION_SECRET is not set (allowed in non-production)');
  } else {
    pass('SESSION_SECRET is set');
  }

  if (!agentKey) {
    console.warn('⚠️ AGENT_KEY is not set (allowed in non-production)');
  } else if (agentKey.length < 32) {
    console.warn('⚠️ AGENT_KEY length is below 32 chars (allowed in non-production)');
  } else {
    pass('AGENT_KEY length check passed');
  }
}

if (failed) process.exit(1);
console.log('✅ security config check passed');
