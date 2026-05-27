const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;
const KALSHI_KEY_ID = process.env.KALSHI_KEY_ID || '';
const KALSHI_SECRET = process.env.KALSHI_SECRET || '';

function proxyRequest(targetUrl, res, extraHeaders = {}) {
  const url = new URL(targetUrl);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  };
  const req = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*'
    });
    proxyRes.pipe(res);
  });
  req.on('error', (e) => {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  });
  req.end();
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*'
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

  const extraHeaders = {
    'KALSHI-ACCESS-KEY': KALSHI_KEY_ID,
    'KALSHI-ACCESS-SIGNATURE': KALSHI_SECRET,
    'KALSHI-ACCESS-TIMESTAMP': Date.now().toString()
  };

  proxyRequest(target, res, extraHeaders);

}).listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
