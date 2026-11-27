import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function generateVapidKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  const pubJwk = publicKey.export({ format: 'jwk' });
  const privJwk = privateKey.export({ format: 'jwk' });

  if (!pubJwk.x || !pubJwk.y || !privJwk.d) {
    throw new Error('No se pudieron exportar los componentes JWK P-256.');
  }

  const xBytes = Buffer.from(pubJwk.x, 'base64url');
  const yBytes = Buffer.from(pubJwk.y, 'base64url');
  const uncompressedPub = Buffer.concat([Buffer.from([0x04]), xBytes, yBytes]);

  return {
    publicKey: uncompressedPub.toString('base64url'),
    privateKey: privJwk.d,
  };
}

const args = new Set(process.argv.slice(2));

if (args.has('--apply-local')) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const apiRoot = path.resolve(__dirname, '..');
  const wranglerPath = path.join(apiRoot, 'wrangler.toml');
  const devVarsPath = path.join(apiRoot, '.dev.vars');

  let wranglerToml = fs.readFileSync(wranglerPath, 'utf8');
  let devVars = fs.existsSync(devVarsPath) ? fs.readFileSync(devVarsPath, 'utf8') : '';

  const hasPublic = /^VAPID_PUBLIC_KEY\s*=/m.test(wranglerToml);
  const hasPrivate = /^VAPID_PRIVATE_KEY\s*=/m.test(devVars);

  if (hasPublic && hasPrivate) {
    const match = wranglerToml.match(/^VAPID_PUBLIC_KEY\s*=\s*"([^"]+)"/m);
    console.log(
      JSON.stringify({
        ok: true,
        alreadyConfigured: true,
        publicKey: match?.[1] ?? null,
      })
    );
    process.exit(0);
  }

  const pair = generateVapidKeyPair();

  if (!hasPublic) {
    const varsLines = [
      `VAPID_PUBLIC_KEY = "${pair.publicKey}"`,
      `VAPID_SUBJECT = "https://organizapp.nsarmiento.workers.dev"`,
    ].join('\n');

    if (/^\[vars\]/m.test(wranglerToml)) {
      wranglerToml = wranglerToml.replace(
        /(^TRUSTED_ORIGINS\s*=.*$)/m,
        `$1\n${varsLines}`
      );
    } else {
      wranglerToml += `\n[vars]\n${varsLines}\n`;
    }
    fs.writeFileSync(wranglerPath, wranglerToml, 'utf8');
  }

  if (!hasPrivate) {
    const prefix = devVars.length > 0 && !devVars.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(
      devVarsPath,
      `${devVars}${prefix}VAPID_PRIVATE_KEY="${pair.privateKey}"\n`,
      'utf8'
    );
  }

  console.log(
    JSON.stringify({
      ok: true,
      alreadyConfigured: false,
      publicKey: pair.publicKey,
    })
  );
  process.exit(0);
}

const pair = generateVapidKeyPair();
if (args.has('--json')) {
  console.log(JSON.stringify(pair, null, 2));
} else {
  console.log('=== Par de llaves VAPID P-256 ($0 USD) ===');
  console.log(`VAPID_PUBLIC_KEY=${pair.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${pair.privateKey}`);
  console.log('\nEn producción guarda la privada como secreto en Cloudflare:');
  console.log('  npx wrangler secret put VAPID_PRIVATE_KEY');
}
