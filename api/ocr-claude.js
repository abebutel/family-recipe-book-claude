// Claude Sonnet 4.6 vision-based recipe extraction.
// Transcription-first prompt — explicitly told to leave illegible parts blank
// rather than invent ingredients.

module.exports = async function handler(req, res) {
  const { image, mediaType } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Missing image' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

  const prompt = `You are transcribing a handwritten recipe from a photo. Read what is actually on the page — do not infer, complete, or invent anything.

The recipe may be English, Hebrew, or mixed. Keep the original language for each part. Do NOT translate.

Rules:
- Transcribe every word you can clearly read.
- For a word you can partially read, write your best guess followed by [?] — for example: flour[?].
- For a word or phrase that is genuinely illegible, write [illegible]. Do not skip and do not guess.
- Never add ingredients or steps that are not visibly written on the page.
- Preserve the original line breaks and ordering where possible.

After transcribing, structure the result. Respond ONLY with a JSON object — no markdown fences, no extra commentary:

{
  "title": "the recipe name as written, or empty if no clear title exists",
  "ingredients": "ingredient list, one per line, transcribed verbatim",
  "instructions": "cooking method, transcribed verbatim. Empty if none is written.",
  "category": "one of: breakfast, appetizer, main, side, dessert, beverage, sauce, other. Pick 'other' if unclear.",
  "language": "en or he (whichever is dominant in the page)"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
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
      return res.status(500).json({ error: data.error?.message || 'Claude API error' });
    }

    const raw = data.content?.[0]?.text || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Couldn't parse — return raw output so user isn't stuck
      return res.status(200).json({
        provider: 'claude',
        title: '',
        ingredients: '',
        instructions: raw,
        category: 'other',
        language: 'en',
        text: raw
      });
    }

    const previewText = [
      parsed.title,
      '',
      parsed.ingredients,
      '',
      parsed.instructions
    ].filter(Boolean).join('\n').trim();

    return res.status(200).json({
      provider: 'claude',
      title:        parsed.title        || '',
      ingredients:  parsed.ingredients  || '',
      instructions: parsed.instructions || '',
      category:     parsed.category     || 'other',
      language:     parsed.language     || 'en',
      text:         previewText
    });

  } catch (err) {
    console.error('Claude OCR handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
