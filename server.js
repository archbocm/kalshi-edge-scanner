const https = require('https');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const KALSHI_KEY_ID = process.env.KALSHI_KEY_ID || '';
const RAW_SECRET = process.env.KALSHI_SECRET || '';
const KALSHI_SECRET = RAW_SECRET.replace(/\\n/g, '\n');
const FRED_API_KEY = process.env.FRED_API_KEY || 'DEMO_KEY';

function signRequest(timestamp, method, fullPath) {
  const pathOnly = fullPath.split('?')[0];
  const message = timestamp + method.toUpperCase() + pathOnly;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  return sign.sign({
    key: KALSHI_SECRET,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
  }, 'base64');
}

function proxyRequest(targetUrl, method, body, res) {
  // Inject real FRED key if URL contains DEMO_KEY
  targetUrl = targetUrl.replace('api_key=DEMO_KEY', `api_key=${FRED_API_KEY}`);

  const url = new URL(targetUrl);
  const isKalshi = url.hostname.includes('kalshi');
  const timestamp = Date.now().toString();

  const headers = { 'Content-Type': 'application/json' };

  if (isKalshi) {
    let signature;
    try {
      signature = signRequest(timestamp, method, url.pathname + url.search);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Signing failed: ' + e.message }));
      return;
    }
    headers['KALSHI-ACCESS-KEY'] = KALSHI_KEY_ID;
    headers['KALSHI-ACCESS-SIGNATURE'] = signature;
    headers['KALSHI-ACCESS-TIMESTAMP'] = timestamp;
  }

  if (body) headers['Content-Length'] = Buffer.byteLength(body);

  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: method,
    headers
  };

  const req = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    proxyRes.pipe(res);
  });

  req.on('error', (e) => {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  });

  if (body) req.write(body);
  req.end();
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const target = url.searchParams.get('url');

  if (!target) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: 'Kalshi proxy running' }));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => proxyRequest(target, 'POST', body, res));
  } else {
    proxyRequest(target, 'GET', null, res);
  }

}).listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
