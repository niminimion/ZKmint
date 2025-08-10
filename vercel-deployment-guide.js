#!/usr/bin/env node
/*
 Minimal helper to list required env vars for Vercel and print
 safe commands to set them (without exposing secrets).
*/

const required = [
  'GOOGLE_CLIENT_ID',
  'REDIRECT_URL',
  'PACKAGE_ID',
  'SPONSOR_ADDRESS',
  'SPONSOR_PRIVATE_KEY',
  'BLOB_READ_WRITE_TOKEN'
];

const optional = [
  'SUI_RPC_URL',
  'OAUTH_FLOW',
  'GOOGLE_CLIENT_SECRET',
  'USE_DATABASE'
];

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

printHeader('Vercel Env Checklist');
for (const key of required) {
  const has = process.env[key] ? 'OK' : 'MISSING';
  console.log(`${key}: ${has}`);
}
for (const key of optional) {
  const has = process.env[key] ? 'SET' : 'unset';
  console.log(`${key}: ${has}`);
}

printHeader('Set Required Vars (production)');
console.log('Use these (paste your actual values after echo):');
console.log('echo YOUR_GOOGLE_CLIENT_ID | vercel env add GOOGLE_CLIENT_ID production --force');
console.log('echo https://zkmint-niminimions-projects.vercel.app/callback | vercel env add REDIRECT_URL production --force');
console.log('echo YOUR_PACKAGE_ID | vercel env add PACKAGE_ID production --force');
console.log('echo YOUR_SPONSOR_ADDRESS | vercel env add SPONSOR_ADDRESS production --force');
console.log('echo YOUR_SPONSOR_PRIVATE_KEY | vercel env add SPONSOR_PRIVATE_KEY production --sensitive --force');
console.log('echo YOUR_BLOB_RW_TOKEN | vercel env add BLOB_READ_WRITE_TOKEN production --sensitive --force');

printHeader('Recommended (production)');
console.log('echo https://fullnode.testnet.sui.io | vercel env add SUI_RPC_URL production --force');
console.log('echo code | vercel env add OAUTH_FLOW production --force    # if switching to code flow');
console.log('echo YOUR_GOOGLE_CLIENT_SECRET | vercel env add GOOGLE_CLIENT_SECRET production --sensitive --force');
console.log('echo false | vercel env add USE_DATABASE production --force');

printHeader('Deploy');
console.log('vercel deploy --prod --yes');

printHeader('Notes');
console.log('- Keep using the stable alias domain: https://zkmint-niminimions-projects.vercel.app');
console.log('- In Google Cloud OAuth, set:');
console.log('  Authorized origins: https://zkmint-niminimions-projects.vercel.app');
console.log('  Redirect URIs:      https://zkmint-niminimions-projects.vercel.app/callback');
console.log('- Do NOT paste secrets in code or Git; add via Vercel env only.');




