// Calls Claude Vision (Haiku 4.5) to extract handwritten recipes.
// Returns structured data: title, ingredients, instructions, category, language.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { image, mediaType } = req.body;
  if (!image) { res.status(400).json({ error: 'Missing image' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Anthropic API key not configured' }); return; }

  const prompt = `This is a photo of a handwritten recipe. Please read it carefully and extract its content.

The recipe may be written in English, Hebrew, or a mix of both. Preserve the original language of each part — don't translate.

Respond ONLY with a JSON object in this exact shape (no markdown fences, no commentary):

{
  "title": "the recipe name (a short, descriptive title)",
  "ingredients": "the ingredient list, one per line",
  "instructions": "the cooking method, as written. If only ingredients are visible with no method, leave this empty.",
  "category": "one of: breakfast, appetizer, main, side, dessert, beverage, sauce, other",
  "language": "en or he (the dominant language)"
}

If part of the handwriting is genuinely illegible, write [illegible] in that spot rather than guessing. Use your understanding of cooking to interpret ambiguous words sensibly — e.g. "flour" vs "floor" — but never invent ingredients that aren't there.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API error:', JSON.stringify(data));
      res.status(500).json({ error: data.error?.message || 'Claude API error' });
      return;
    }

    // Claude returns its reply in content[0].text
    const raw = data.content?.[0]?.text || '';

    // Strip any stray markdown fences in case Claude wraps the JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: return raw text so the user isn't stuck
      res.status(200).json({
        title: '',
        ingredients: '',
        instructions: raw,
        category: '',
        language: 'en',
        text: raw,
        raw: true
      });
      return;
    }

    // Build a combined text field for the "Extracted Text" preview box
    const previewText = [
      parsed.title,
      '',
      parsed.ingredients,
      '',
      parsed.instructions
    ].filter(Boolean).join('\n').trim();

    res.status(200).json({
      title:        parsed.title        || '',
      ingredients:  parsed.ingredients  || '',
      instructions: parsed.instructions || '',
      category:     parsed.category     || '',
      language:     parsed.language     || 'en',
      text:         previewText
    });

  } catch (err) {
    console.error('OCR handler error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
