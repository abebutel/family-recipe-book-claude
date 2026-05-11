// Google Cloud Vision OCR — raw handwriting extraction.
// Returns plain text plus a guessed title. No categorization, no ingredients
// vs instructions split — Vision can't do that, so the form will keep them
// merged in instructions and the user can clean up.

module.exports = async function handler(req, res) {
  const { image, mediaType } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Missing image' });

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Google Vision API key not configured' });

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
            // No languageHints — Vision auto-detects English & Hebrew on its own.
          }]
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('Google Vision error:', JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || 'Vision API error' });
    }

    const annotation = data.responses?.[0];
    if (annotation?.error) return res.status(500).json({ error: annotation.error.message });

    const fullText = annotation?.fullTextAnnotation?.text || '';
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines.length > 0 && lines[0].length < 60 ? lines[0] : '';

    return res.status(200).json({
      provider: 'google',
      title,
      ingredients: '',                            // Vision can't separate these
      instructions: title ? lines.slice(1).join('\n') : fullText,
      category: '',
      language: /[\u0590-\u05FF]/.test(fullText) ? 'he' : 'en',
      text: fullText
    });

  } catch (err) {
    console.error('Google OCR handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
