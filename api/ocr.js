// Calls both OCR providers in parallel and returns both results.
// Frontend shows them side-by-side; user picks the better one.

const googleHandler = require('./ocr-google.js');
const claudeHandler = require('./ocr-claude.js');

// Wrap a provider in a Promise so we can run both at once and capture
// errors per-provider instead of letting one failure kill the comparison.
function callProvider(handler, req) {
  return new Promise(resolve => {
    let body;
    const fakeRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data)   { body = data; resolve({ statusCode: this.statusCode, body }); }
    };
    Promise.resolve(handler(req, fakeRes)).catch(err => {
      resolve({ statusCode: 500, body: { error: err.message || 'Provider failed' } });
    });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  if (!req.body?.image) return res.status(400).json({ error: 'Missing image' });

  // Fire both at once
  const [google, claude] = await Promise.all([
    callProvider(googleHandler, req),
    callProvider(claudeHandler, req)
  ]);

  return res.status(200).json({
    google: google.statusCode === 200 ? google.body : { error: google.body.error || 'Google failed' },
    claude: claude.statusCode === 200 ? claude.body : { error: claude.body.error || 'Claude failed' }
  });
};
