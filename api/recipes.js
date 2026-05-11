const storage = new Map();

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { bookId, id } = req.query;

  // ── GET ──────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!bookId) { res.status(400).json({ error: 'Missing bookId' }); return; }
    const book = storage.get('book_' + bookId) || { recipes: [], members: [] };
    res.status(200).json(book);
    return;
  }

  // ── POST ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const data = req.body;

    // Join an existing book
    if (data.joinCode) {
      const targetId = data.joinCode.toUpperCase();
      const book = storage.get('book_' + targetId);
      if (!book) { res.status(404).json({ error: 'Invalid code' }); return; }
      const alreadyMember = book.members.some(m => m.id === data.userId);
      if (!alreadyMember) {
        book.members.push({ id: data.userId, name: data.userName, joinedAt: new Date().toISOString() });
        storage.set('book_' + targetId, book);
      }
      res.status(200).json({ bookId: targetId, members: book.members });
      return;
    }

    // Save a new recipe
    const { bookId, userId, userName, title, category, instructions, ingredients, language, createdAt, email } = data;
    if (!bookId || !title) { res.status(400).json({ error: 'Missing required fields' }); return; }

    const recipe = {
      id: Date.now(),
      title, category, instructions, ingredients,
      language, createdAt, userId, userName
    };

    let book = storage.get('book_' + bookId);
    if (!book) {
      book = {
        id: bookId,
        recipes: [],
        members: [{ id: userId, name: userName, email: email || '', createdAt: new Date().toISOString() }],
        createdAt: new Date().toISOString()
      };
    }

    book.recipes.push(recipe);
    storage.set('book_' + bookId, book);
    res.status(201).json(recipe);
    return;
  }

  // ── DELETE ───────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!id || !bookId) { res.status(400).json({ error: 'Missing id or bookId' }); return; }
    const book = storage.get('book_' + bookId);
    if (book) {
      book.recipes = book.recipes.filter(r => r.id !== parseInt(id));
      storage.set('book_' + bookId, book);
    }
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
