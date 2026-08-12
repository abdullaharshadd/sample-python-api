import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Book, BookInput, bookInputSchema } from '../models/book';

// MIGRATION_NOTE: The Python source used Flask-RESTPlus Resource classes with
// @api.route decorators and an in-memory module-level list `books_db`. This is
// migrated to an Express Router with an in-memory array. Global mutation of the
// module-level list is preserved via a mutable module-scoped array.
//
// VERIFY-2 (marshal-wrapping): Flask-RESTPlus's marshal_with / marshal_list_with
// filters the returned dict/list to only the fields declared in the `book`
// model (id, title). We replicate this by explicitly projecting to { id, title }
// via `marshalBook`.
//
// VERIFY-3 (404 body shape): The source `get` returns the Python tuple
// ("Not found", 404). Under Flask-RESTPlus with marshal_with, the marshaller
// actually attempts to marshal the string... but effectively the response is a
// 404 with body "Not found". We preserve a 404 status. To keep a consistent JSON
// error shape for this codebase we return { error: 'Not found' }.
//
// VERIFY-4 (int vs string id): The source route was /books/<int:id>, so `id` is
// an integer. We parse the path param to an integer and 404 on non-integer ids
// (Flask would 404 on a non-int segment as it wouldn't match the <int:> converter).
//
// VERIFY-5 (validation-400 body): Flask-RESTPlus @api.expect(book, validate=True)
// returns 400 with body { errors: {...}, message: 'Input payload validation
// failed' } on invalid input. We preserve that exact shape.
//
// VERIFY-9 (put abort behavior): The source `put` returns `match` which is None
// when the book does not exist. Under marshal_with, marshalling None yields a
// response of all-null fields ({ id: null, title: null }). We preserve that
// behavior: when no match is found, PUT returns { id: null, title: null } with 200.

// In-memory data store (module-level mutable list, mirrors `books_db`).
let booksDb: Book[] = [
  { id: 0, title: 'War and Peace' },
  { id: 1, title: 'Python for Dummies' },
];

/**
 * Projects a book-like object down to the fields declared in the `book` model
 * (id, title), replicating Flask-RESTPlus marshal_with. Nulls are used for
 * missing fields to mirror RESTPlus marshalling of None.
 */
function marshalBook(b: Partial<Book> | null | undefined): { id: number | null; title: string | null } {
  return {
    id: b?.id ?? null,
    title: b?.title ?? null,
  };
}

function findOne(id: number): Book | undefined {
  return booksDb.find((b) => b.id === id);
}

/**
 * Parses the `:id` path parameter as an integer, mirroring Flask's <int:id>
 * converter. Returns null when the value is not a valid integer.
 */
function parseIntId(raw: string): number | null {
  if (!/^-?\d+$/.test(raw)) {
    return null;
  }
  return parseInt(raw, 10);
}

/**
 * Builds the Flask-RESTPlus-style 400 validation error body.
 */
function validationErrorBody(err: z.ZodError): { errors: Record<string, string>; message: string } {
  const errors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    errors[key] = issue.message;
  }
  return { errors, message: 'Input payload validation failed' };
}

export const bookRouter = Router();

// GET /books -> BookList.get
bookRouter.get('/books', (_req: Request, res: Response) => {
  res.status(200).json(booksDb.map(marshalBook));
});

// POST /books -> BookList.post
bookRouter.post('/books', (req: Request, res: Response) => {
  const parsed = bookInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(validationErrorBody(parsed.error));
    return;
  }

  const payload: BookInput = parsed.data;
  const nextId = booksDb.length > 0 ? booksDb[booksDb.length - 1].id + 1 : 0;
  const created: Book = { ...payload, id: nextId };
  booksDb.push(created);

  res.status(200).json(marshalBook(created));
});

// GET /books/:id -> Book.get
bookRouter.get('/books/:id', (req: Request, res: Response) => {
  const id = parseIntId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const match = findOne(id);
  if (!match) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.status(200).json(marshalBook(match));
});

// DELETE /books/:id -> Book.delete
bookRouter.delete('/books/:id', (req: Request, res: Response) => {
  const id = parseIntId(req.params.id);
  if (id === null) {
    // MIGRATION_NOTE: The source has no explicit not-found handling in delete;
    // it filters the list and returns `match` (possibly None -> null fields).
    // For a non-int id the Flask route would 404, so we replicate that here.
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const match = findOne(id);
  booksDb = booksDb.filter((b) => b.id !== id);

  // Mirrors the source: returns `match`, which marshals to all-null fields
  // when the book did not exist.
  res.status(200).json(marshalBook(match));
});

// PUT /books/:id -> Book.put
bookRouter.put('/books/:id', (req: Request, res: Response) => {
  const id = parseIntId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const parsed = bookInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(validationErrorBody(parsed.error));
    return;
  }

  const match = findOne(id);
  if (match) {
    Object.assign(match, parsed.data);
    match.id = id;
  }

  // VERIFY-9: when no match, source returns None which marshals to null fields.
  res.status(200).json(marshalBook(match));
});

export default bookRouter;
