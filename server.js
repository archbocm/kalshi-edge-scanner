const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;

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
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const target = url.searchParams.get('url');

  if (!target) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Missing url param' }));
    return;
  }

  const kalshiKey = url.searchParams.get('kalshi_key');
  const kalshiKeyId = url.searchParams.get('kalshi_key_id');

  const extraHeaders = {};
  if (kalshiKey && kalshiKeyId) {
    extraHeaders['KALSHI-ACCESS-KEY'] = kalshiKeyId;
    extraHeaders['KALSHI-ACCESS-SIGNATURE'] = kalshiKey;
    extraHeaders['KALSHI-ACCESS-TIMESTAMP'] = Date.now().toString();
  }

  proxyRequest(target, res, extraHeaders);

}).listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
