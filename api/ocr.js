module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { image } = req.body; // base64 string, no data-URI prefix
  if (!image) { res.status(400).json({ error: 'Missing image' }); return; }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Vision API key not configured' }); return; }

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
            // No languageHints — Vision auto-detects English & Hebrew correctly on its own.
            // Forcing hints like ['en', 'iw'] makes it overlay Hebrew chars on English text.
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Vision API error:', JSON.stringify(data));
      res.status(500).json({ error: data.error?.message || 'Vision API error' });
      return;
    }

    const annotation = data.responses?.[0];

    if (annotation.error) {
      res.status(500).json({ error: annotation.error.message });
      return;
    }

    const fullText = annotation.fullTextAnnotation?.text || '';

    // Try to pull a title from the first non-empty line
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines.length > 0 && lines[0].length < 60 ? lines[0] : '';
    const rest = title ? lines.slice(1).join('\n') : fullText;

    res.status(200).json({ text: fullText, suggestedTitle: title, body: rest });

  } catch (err) {
    console.error('OCR handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};