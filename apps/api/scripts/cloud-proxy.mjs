import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST?.trim() || undefined;
const CLOUD_API_URL = (
  process.env.CLOUD_API_URL || 'https://organizapp.nsarmiento.workers.dev'
).replace(/\/+$/, '');

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'origin',
  'referer',
  'accept-encoding',
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie',
]);

function applyCorsHeaders(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Cookie, expo-origin, X-Requested-With'
  );
  res.setHeader('Vary', 'Origin');
}

function rewriteRequestCookieHeader(rawCookie) {
  return rawCookie
    .replace(/(^|;\s*)__local_secure_/g, '$1__Secure-')
    .replace(/(^|;\s*)__local_host_/g, '$1__Host-');
}

function rewriteSetCookieForLocalhost(rawSetCookie) {
  return rawSetCookie
    .replace(/^__Secure-/, '__local_secure_')
    .replace(/^__Host-/, '__local_host_')
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*Secure(?=\s*(?:;|$))/gi, '')
    .replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const method = (req.method || 'GET').toUpperCase();
  const urlPath = req.url || '/';
  const requestOrigin =
    typeof req.headers.origin === 'string' ? req.headers.origin : undefined;

  if (method === 'OPTIONS') {
    applyCorsHeaders(res, requestOrigin);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const targetUrl = `${CLOUD_API_URL}${urlPath}`;
    const forwardHeaders = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      const lowerKey = key.toLowerCase();
      if (HOP_BY_HOP_REQUEST_HEADERS.has(lowerKey)) continue;

      const joined = Array.isArray(value) ? value.join('; ') : value;
      if (lowerKey === 'cookie') {
        forwardHeaders.set('cookie', rewriteRequestCookieHeader(joined));
      } else {
        forwardHeaders.set(lowerKey, joined);
      }
    }

    forwardHeaders.set('origin', CLOUD_API_URL);
    forwardHeaders.set('referer', `${CLOUD_API_URL}/`);

    const hasBody = method !== 'GET' && method !== 'HEAD';
    const bodyBuffer = hasBody ? await readRequestBody(req) : undefined;

    const upstreamRes = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: hasBody && bodyBuffer && bodyBuffer.length > 0 ? bodyBuffer : undefined,
      redirect: 'manual',
    });

    const responseBuffer = Buffer.from(await upstreamRes.arrayBuffer());

    for (const [key, value] of upstreamRes.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (
        HOP_BY_HOP_RESPONSE_HEADERS.has(lowerKey) ||
        lowerKey.startsWith('access-control-')
      ) {
        continue;
      }
      res.setHeader(lowerKey, value);
    }

    applyCorsHeaders(res, requestOrigin);

    const setCookies =
      typeof upstreamRes.headers.getSetCookie === 'function'
        ? upstreamRes.headers.getSetCookie()
        : [];
    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies.map(rewriteSetCookieForLocalhost));
    }

    res.setHeader('content-length', String(responseBuffer.byteLength));
    res.writeHead(upstreamRes.status);
    res.end(responseBuffer);

    console.log(`[cloud-proxy] ${method} ${urlPath} -> ${upstreamRes.status}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con Cloudflare';
    console.error(`[cloud-proxy] ${method} ${urlPath} -> 502 (${message})`);

    const errorPayload = Buffer.from(
      JSON.stringify({
        ok: false,
        error: 'CLOUD_PROXY_ERROR',
        message,
      })
    );
    applyCorsHeaders(res, requestOrigin);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('content-length', String(errorPayload.byteLength));
    res.writeHead(502);
    res.end(errorPayload);
  }
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST || 'localhost';
  console.log(
    `[cloud-proxy] Escuchando en http://${displayHost}:${PORT} -> ${CLOUD_API_URL}`
  );
});
