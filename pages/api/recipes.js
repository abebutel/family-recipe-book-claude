// In-memory storage (replace with database for production)
const storage = new Map();

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { bookId, id } = req.query;

  if (req.method === 'GET') {
    if (!bookId) {
      res.status(400).json({ error: 'Missing bookId' });
      return;
    }

    if (id) {
      const recipe = storage.get(`recipe_${id}`);
      res.status(200).json({ recipe });
      return;
    }

    const book = storage.get(`book_${bookId}`) || { recipes: [], members: [] };
    res.status(200).json(book);
    return;
  }

  if (req.method === 'POST') {
    const data = req.body;

    if (data.joinCode) {
      // Join existing book
      const bookId = data.joinCode.toUpperCase();
      const book = storage.get(`book_${bookId}`);

      if (!book) {
        res.status(404).json({ error: 'Invalid code' });
        return;
      }

      book.members.push({
        id: data.userId,
        name: data.userName,
        email: data.email,
        joinedAt: new Date().toISOString()
      });

      storage.set(`book_${bookId}`, book);
      res.status(200).json({ bookId, members: book.members });
      return;
    }

    // Save recipe
    const { bookId, userId, userName, title, category, instructions, ingredients, language, createdAt, email } = data;

    if (!bookId || !title) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const recipe = {
      id: Date.now(),
      title,
      category,
      instructions,
      ingredients,
      language,
      createdAt,
      userId,
      userName
    };

    // Get or create book
    let book = storage.get(`book_${bookId}`);
    if (!book) {
      book = {
        id: bookId,
        recipes: [],
        members: [{ id: userId, name: userName, email: email, createdAt: new Date().toISOString() }],
        createdAt: new Date().toISOString()
      };
    }

    book.recipes.push(recipe);
    storage.set(`book_${bookId}`, book);
    storage.set(`recipe_${recipe.id}`, recipe);

    res.status(201).json(recipe);
    return;
  }

  if (req.method === 'DELETE') {
    const { id, bookId } = req.query;

    if (!id || !bookId) {
      res.status(400).json({ error: 'Missing id or bookId' });
      return;
    }

    const book = storage.get(`book_${bookId}`);
    if (book) {
      book.recipes = book.recipes.filter(r => r.id !== parseInt(id));
      storage.set(`book_${bookId}`, book);
    }

    storage.delete(`recipe_${id}`);
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}