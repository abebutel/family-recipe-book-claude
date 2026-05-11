import { json } from 'micro';

// In-memory storage (replace with database for production)
const storage = new Map();

// GET recipes for a book
export async function GET(req) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const bookId = searchParams.get('bookId');
  const recipeId = searchParams.get('id');

  if (!bookId) {
    return new Response(json({ error: 'Missing bookId' }), { status: 400 });
  }

  if (recipeId) {
    const recipe = storage.get(`recipe_${recipeId}`);
    return new Response(json({ recipe }), { status: 200 });
  }

  const book = storage.get(`book_${bookId}`) || { recipes: [], members: [] };
  return new Response(json(book), { status: 200 });
}

// POST create recipe or join book
export async function POST(req) {
  const data = await json(req);
  
  if (data.joinCode) {
    // Join existing book
    const bookId = data.joinCode.toUpperCase();
    const book = storage.get(`book_${bookId}`);
    
    if (!book) {
      return new Response(json({ error: 'Invalid code' }), { status: 404 });
    }

    book.members.push({
      id: data.userId,
      name: data.userName,
      email: data.email,
      joinedAt: new Date().toISOString()
    });

    storage.set(`book_${bookId}`, book);
    return new Response(json({ bookId, members: book.members }), { status: 200 });
  }

  // Save recipe
  const { bookId, userId, userName, title, category, instructions, ingredients, language, createdAt } = data;

  if (!bookId || !title) {
    return new Response(json({ error: 'Missing required fields' }), { status: 400 });
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
      members: [{ id: userId, name: userName, email: data.email, createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
  }

  book.recipes.push(recipe);
  storage.set(`book_${bookId}`, book);
  storage.set(`recipe_${recipe.id}`, recipe);

  return new Response(json(recipe), { status: 201 });
}

// DELETE recipe
export async function DELETE(req) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const recipeId = searchParams.get('id');
  const bookId = searchParams.get('bookId');

  if (!recipeId || !bookId) {
    return new Response(json({ error: 'Missing id or bookId' }), { status: 400 });
  }

  const book = storage.get(`book_${bookId}`);
  if (book) {
    book.recipes = book.recipes.filter(r => r.id !== parseInt(recipeId));
    storage.set(`book_${bookId}`, book);
  }

  storage.delete(`recipe_${recipeId}`);
  return new Response(json({ success: true }), { status: 200 });
}