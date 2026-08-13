import { Request, Response, NextFunction } from 'express';
import { Book, BookInput, marshalBook, bookInputSchema } from '../models/book';

/**
 * Book resource handlers.
 *
 * MIGRATION_NOTE: The source used Flask-RESTPlus `Resource` classes
 * (`BookList` and `Book`) whose methods (get/post/put/delete) mapped to HTTP
 * verbs. Here those handlers are plain async Express handlers exported from
 * this module and wired into an Express Router in `src/src/routes/book.ts`
 * (the shared route-definition table that drives both the router and the
 * OpenAPI registry).
 *
 * MIGRATION_NOTE: The source stored books in a module-level Python list
 * (`books_db`) — an in-memory store, NOT a database. There is no SQL/DB layer
 * to migrate here, so the PostgreSQL note does not apply. To keep the store
 * injectable/testable (per DI requirements) it is encapsulated in a
 * `BookStore` class rather than a global mutable list.
 *
 * MIGRATION_NOTE: The source id-assignment logic was
 *   `books_db[-1]["id"] + 1 if len(books_db) > 0 else 0`
 * i.e. one greater than the LAST element's id (not the max). This is
 * preserved exactly.
 *
 * MIGRATION_NOTE: The Flask `@api.expect(book, validate=True)` decorator is
 * replaced by validating the request body with `bookInputSchema` (Zod).
 */

/**
 * In-memory book store. Mirrors the source `books_db` list, including its two
 * seed rows.
 */
export class BookStore {
  private books: Book[];

  constructor(initial?: Book[]) {
    this.books = initial ?? [
      { id: 0, title: 'War and Peace' },
      { id: 1, title: 'Python for Dummies' },
    ];
  }

  list(): Book[] {
    return this.books;
  }

  /**
   * Mirrors `find_one`: returns the matching book or undefined.
   */
  findOne(id: number): Book | undefined {
    return this.books.find((b) => b.id === id);
  }

  /**
   * Mirrors the POST handler's id assignment:
   *   id = last.id + 1 if non-empty else 0
   */
  add(input: BookInput): Book {
    const nextId =
      this.books.length > 0 ? this.books[this.books.length - 1].id! + 1 : 0;
    const created: Book = { ...input, id: nextId };
    this.books.push(created);
    return created;
  }

  /**
   * Mirrors DELETE: removes the book by id and returns the removed match
   * (or undefined if it did not exist).
   */
  delete(id: number): Book | undefined {
    const match = this.findOne(id);
    this.books = this.books.filter((b) => b.id !== id);
    return match;
  }

  /**
   * Mirrors PUT: if a match exists, merges the payload into it and forces the
   * id back to the path id. Returns the updated match (or undefined).
   */
  update(id: number, input: BookInput): Book | undefined {
    const match = this.findOne(id);
    if (match) {
      Object.assign(match, input);
      match.id = id;
    }
    return match;
  }
}

/**
 * Default shared store instance. Route wiring may inject a different store
 * (e.g. tests create a fresh one via the harness).
 */
export const defaultBookStore = new BookStore();

/**
 * Parses and validates the `:id` path parameter as an integer.
 * Mirrors Flask's `<int:id>` converter, which only matches integers.
 */
function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 10);
}

/**
 * Factory that produces the resource handlers bound to a given store.
 * Using a factory keeps the store injectable (DI) instead of relying on a
 * module-level singleton.
 */
export function createBookHandlers(store: BookStore = defaultBookStore) {
  /**
   * GET /books  -> BookList.get (marshal_list_with(book))
   */
  const listBooks = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      res.status(200).json(store.list().map(marshalBook));
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /books -> BookList.post (expect(book) + marshal_with(book))
   *
   * MIGRATION_NOTE: Flask-RESTPlus returned HTTP 200 by default for a
   * successful POST (not 201). The source relied on that default, so 200 is
   * preserved here to keep behaviour identical.
   */
  const createBook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = bookInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'Validation failed', details: parsed.error.format() });
        return;
      }
      const created = store.add(parsed.data);
      res.status(200).json(marshalBook(created));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /books/:id -> Book.get
   * Source returned ("Not found", 404) on miss.
   */
  const getBook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const match = store.findOne(id);
      if (!match) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.status(200).json(marshalBook(match));
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /books/:id -> Book.delete
   *
   * MIGRATION_NOTE: The source did not special-case a missing id on delete —
   * it filtered the list and returned the (possibly null) match marshalled
   * through `book`. Flask-RESTPlus marshalling a None produced an object with
   * null fields; here we return the marshalled match, or marshalled-null
   * (via marshalBook of an empty shape) to mirror that. Behaviour preserved.
   */
  const deleteBook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(200).json(marshalBook(undefined as unknown as Book));
        return;
      }
      const match = store.delete(id);
      res.status(200).json(marshalBook(match as unknown as Book));
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /books/:id -> Book.put (expect(book) + marshal_with(book))
   */
  const updateBook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = bookInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'Validation failed', details: parsed.error.format() });
        return;
      }
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(200).json(marshalBook(undefined as unknown as Book));
        return;
      }
      const match = store.update(id, parsed.data);
      res.status(200).json(marshalBook(match as unknown as Book));
    } catch (err) {
      next(err);
    }
  };

  return { listBooks, createBook, getBook, deleteBook, updateBook };
}

export type BookHandlers = ReturnType<typeof createBookHandlers>;
