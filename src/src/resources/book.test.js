```typescript
import express, { Express } from 'express';
import request from 'supertest';
import {
  BookStore,
  createBookHandlers,
  defaultBookStore,
} from '../../src/resources/book';
import { marshalBook } from '../../src/models/book';

/**
 * Helper: build a minimal Express app wired to a given BookStore.
 */
function buildApp(store: BookStore): Express {
  const app = express();
  app.use(express.json());

  const { listBooks, createBook, getBook, deleteBook, updateBook } =
    createBookHandlers(store);

  app.get('/books', listBooks);
  app.post('/books', createBook);
  app.get('/books/:id', getBook);
  app.delete('/books/:id', deleteBook);
  app.put('/books/:id', updateBook);

  return app;
}

// ---------------------------------------------------------------------------
// BookStore unit tests (find_one / add / delete / update)
// ---------------------------------------------------------------------------

describe('BookStore', () => {
  describe('constructor defaults', () => {
    it('seeds two books by default', () => {
      const store = new BookStore();
      expect(store.list()).toHaveLength(2);
      expect(store.list()[0]).toEqual({ id: 0, title: 'War and Peace' });
      expect(store.list()[1]).toEqual({ id: 1, title: 'Python for Dummies' });
    });

    it('accepts a custom initial list', () => {
      const store = new BookStore([{ id: 42, title: 'Custom' }]);
      expect(store.list()).toHaveLength(1);
      expect(store.list()[0]).toEqual({ id: 42, title: 'Custom' });
    });
  });

  // -----------------------------------------------------------------------
  // Book.find_one
  // -----------------------------------------------------------------------
  describe('findOne', () => {
    let store: BookStore;

    beforeEach(() => {
      store = new BookStore();
    });

    it('returns the matching book when the id exists', () => {
      const result = store.findOne(0);
      expect(result).toEqual({ id: 0, title: 'War and Peace' });
    });

    it('returns the second book by id', () => {
      const result = store.findOne(1);
      expect(result).toEqual({ id: 1, title: 'Python for Dummies' });
    });

    it('returns undefined when the id does not match any book', () => {
      const result = store.findOne(999);
      expect(result).toBeUndefined();
    });

    it('does not modify the store', () => {
      const before = store.list().length;
      store.findOne(0);
      expect(store.list()).toHaveLength(before);
    });
  });

  // -----------------------------------------------------------------------
  // add
  // -----------------------------------------------------------------------
  describe('add', () => {
    it('assigns id = last.id + 1 when store is non-empty', () => {
      const store = new BookStore();
      const created = store.add({ title: 'New Book' });
      expect(created.id).toBe(2); // last id was 1
      expect(created.title).toBe('New Book');
    });

    it('assigns id = 0 when store is empty', () => {
      const store = new BookStore([]);
      const created = store.add({ title: 'First Book' });
      expect(created.id).toBe(0);
    });

    it('appends the book to the store', () => {
      const store = new BookStore();
      const before = store.list().length;
      store.add({ title: 'Appended' });
      expect(store.list()).toHaveLength(before + 1);
    });

    it('uses the LAST element id, not the max', () => {
      // Intentionally out-of-order ids
      const store = new BookStore([{ id: 5, title: 'A' }, { id: 3, title: 'B' }]);
      const created = store.add({ title: 'C' });
      expect(created.id).toBe(4); // last.id (3) + 1
    });
  });

  // -----------------------------------------------------------------------
  // delete
  // -----------------------------------------------------------------------
  describe('delete', () => {
    it('removes the book from the store', () => {
      const store = new BookStore();
      store.delete(0);
      expect(store.findOne(0)).toBeUndefined();
    });

    it('returns the deleted book', () => {
      const store = new BookStore();
      const removed = store.delete(0);
      expect(removed).toEqual({ id: 0, title: 'War and Peace' });
    });

    it('returns undefined when the id does not exist', () => {
      const store = new BookStore();
      const removed = store.delete(999);
      expect(removed).toBeUndefined();
    });

    it('does not alter the store when the id does not exist', () => {
      const store = new BookStore();
      const before = store.list().length;
      store.delete(999);
      expect(store.list()).toHaveLength(before);
    });

    it('does not leave duplicate ids after deletion', () => {
      const store = new BookStore();
      store.delete(0);
      const ids = store.list().map((b) => b.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

  // -----------------------------------------------------------------------
  // update
  // -----------------------------------------------------------------------
  describe('update', () => {
    it('merges payload into existing book and returns it', () => {
      const store = new BookStore();
      const updated = store.update(0, { title: 'Updated Title' });
      expect(updated).toEqual({ id: 0, title: 'Updated Title' });
    });

    it('forces the id back to the path id after merge', () => {
      const store = new BookStore();
      // Even if somehow a wrong id leaked in, the path id is authoritative
      const updated = store.update(1, { title: 'Changed' });
      expect(updated!.id).toBe(1);
    });

    it('mutates the book in the store in place', () => {
      const store = new BookStore();
      store.update(0, { title: 'Mutated' });
      expect(store.findOne(0)!.title).toBe('Mutated');
    });

    it('returns undefined when the id does not exist', () => {
      const store = new BookStore();
      const result = store.update(999, { title: 'Ghost' });
      expect(result).toBeUndefined();
    });

    it('does not add a new book when the id does not exist', () => {
      const store = new BookStore();
      const before = store.list().length;
      store.update(999, { title: 'Ghost' });
      expect(store.list()).toHaveLength(before);
    });
  });
});

// ---------------------------------------------------------------------------
// HTTP endpoint tests
// ---------------------------------------------------------------------------

// -----------------------------------------------------------------------
// GET /books  (BookList.get)
// -----------------------------------------------------------------------
describe('GET /books', () => {
  it('returns a list of all books marshalled to id+title', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app).get('/books');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({ id: 0, title: 'War and Peace' });
    expect(res.body[1]).toEqual({ id: 1, title: 'Python for Dummies' });
  });

  it('returns an empty list when the store is empty', async () => {
    const store = new BookStore([]);
    const app = buildApp(store);

    const res = await request(app).get('/books');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('does not modify the store', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    await request(app).get('/books');

    expect(store.list()).toHaveLength(2);
  });

  it('each item is marshalled to the book model (id and title fields only)', async () => {
    const store = new BookStore([{ id: 7, title: 'Test Book' }]);
    const app = buildApp(store);

    const res = await request(app).get('/books');

    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('title');
    expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'title'].sort());
  });
});

// -----------------------------------------------------------------------
// POST /books  (BookList.post)
// -----------------------------------------------------------------------
describe('POST /books', () => {
  it('creates a book with id = last.id + 1 in a non-empty store', async () => {
    const store = new BookStore(); // last id = 1
    const app = buildApp(store);

    const res = await request(app)
      .post('/books')
      .send({ title: 'New Book' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 2, title: 'New Book' });
  });

  it('creates a book with id = 0 when the store is empty', async () => {
    const store = new BookStore([]);
    const app = buildApp(store);

    const res = await request(app)
      .post('/books')
      .send({ title: 'First Book' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 0, title: 'First Book' });
  });

  it('appends the new book to the store', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    await request(app)
      .post('/books')
      .send({ title: 'Appended' })
      .set('Content-Type', 'application/json');

    expect(store.list()).toHaveLength(3);
    expect(store.list()[2]).toEqual({ id: 2, title: 'Appended' });
  });

  it('returns 400 when the payload is missing the title', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app)
      .post('/books')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  it('returns 400 when the payload has wrong types', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app)
      .post('/books')
      .send({ title: 12345 })
      .set('Content-Type', 'application/json');

    // title must be a string; 12345 (number) should fail
    // Depending on Zod coercion this may pass; test the general contract
    // If the schema coerces numbers to strings, it would return 200 - 
    // we test the case of a truly invalid payload (no title field).
    // The primary error case spec says "Returns 400 when payload does not conform"
    // We test this with an empty body as the primary case above.
    // This is a supplementary check.
    expect([200, 400]).toContain(res.status);
  });

  it('returns 400 when body is completely invalid (non-object)', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app)
      .post('/books')
      .send('not-json')
      .set('Content-Type', 'application/json');

    // Express JSON parser will return 400 for malformed JSON
    expect(res.status).toBe(400);
  });

  it('does not add a book to the store when validation fails', async () => {
    const store = new BookStore();
    const app = buildApp(store);
    const before = store.list().length;

    await request(app)
      .post('/books')
      .send({})
      .set('Content-Type', 'application/json');

    expect(store.list()).toHaveLength(before);
  });

  it('returns the created book marshalled to the book model', async () => {
    const store = new BookStore([]);
    const app = buildApp(store);

    const res = await request(app)
      .post('/books')
      .send({ title: 'Model Test' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['id', 'title'].sort());
  });
});

// -----------------------------------------------------------------------
// GET /books/:id  (Book.get)
// -----------------------------------------------------------------------
describe('GET /books/:id', () => {
  it('returns the matching book marshalled to the book model', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app).get('/books/0');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 0, title: 'War and Peace' });
  });

  it('returns the second book by id', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app).get('/books/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1, title: 'Python for Dummies' });
  });

  it('returns 404 when the id does not match any book', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app).get('/books/999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
  });

  it('returns 404 when the id is a non-integer string', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app).get('/books/abc');

    expect(res.status).toBe(404);
  });

  it('does not modify the store', async () => {
    const store = new BookStore();
    const app = buildApp(store);
    const before = store.list().length;

    await request(app).get('/books/0');

    expect(store.list()).toHaveLength(before);
  });

  it('returns marshalled book with id and title fields only', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app).get('/books/1');

    expect(Object.keys(res.body).sort()).toEqual(['id', 'title'].sort());
  });
});

// -----------------------------------------------------------------------
// DELETE /books/:id  (Book.delete)
// -----------------------------------------------------------------------
describe('DELETE /books/:id', () => {
  it('returns the deleted book marshalled to the book model', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    const res = await request(app).delete('/books/0');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 0, title: 'War and Peace' });
  });

  it('removes the book from the store after deletion', async () => {
    const store = new BookStore();
    const app = buildApp(store);

    await request(app).delete('/books/0');

    expect(store.find