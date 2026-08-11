```typescript
import request from 'supertest';
import express, { Express } from 'express';

// We need to be able to reset the module between tests to restore the initial booksDb state.
// We'll use jest's module registry isolation via jest.resetModules() + re-require.

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { bookRouter } = require('./book');
  app.use(bookRouter);
  return app;
}

describe('Book API', () => {
  let app: Express;

  beforeEach(() => {
    jest.resetModules();
    app = buildApp();
  });

  // ---------------------------------------------------------------------------
  // BookList.get  GET /books
  // ---------------------------------------------------------------------------
  describe('GET /books', () => {
    it('returns a JSON array of all books when collection has books', async () => {
      const res = await request(app).get('/books');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({ id: 0, title: 'War and Peace' });
      expect(res.body[1]).toEqual({ id: 1, title: 'Python for Dummies' });
    });

    it('each element is marshalled with exactly id and title fields', async () => {
      const res = await request(app).get('/books');

      for (const book of res.body) {
        expect(Object.keys(book).sort()).toEqual(['id', 'title'].sort());
      }
    });

    it('returns an empty JSON array when collection is empty', async () => {
      // Delete all books first
      await request(app).delete('/books/0');
      await request(app).delete('/books/1');

      const res = await request(app).get('/books');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('does not modify the collection (GET is idempotent)', async () => {
      const res1 = await request(app).get('/books');
      const res2 = await request(app).get('/books');

      expect(res1.body).toEqual(res2.body);
    });
  });

  // ---------------------------------------------------------------------------
  // BookList.post  POST /books
  // ---------------------------------------------------------------------------
  describe('POST /books', () => {
    it('creates a book with id = last book id + 1 when collection is non-empty', async () => {
      const res = await request(app)
        .post('/books')
        .send({ title: 'Clean Code' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 2, title: 'Clean Code' });
    });

    it('appends the new book to the in-memory collection', async () => {
      await request(app)
        .post('/books')
        .send({ title: 'Clean Code' })
        .set('Content-Type', 'application/json');

      const listRes = await request(app).get('/books');
      expect(listRes.body).toHaveLength(3);
      expect(listRes.body[2]).toEqual({ id: 2, title: 'Clean Code' });
    });

    it('creates a book with id 0 when collection is empty', async () => {
      // Empty the collection
      await request(app).delete('/books/0');
      await request(app).delete('/books/1');

      const res = await request(app)
        .post('/books')
        .send({ title: 'New Book' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 0, title: 'New Book' });
    });

    it('returns 400 with Flask-RESTPlus-style body on invalid payload', async () => {
      const res = await request(app)
        .post('/books')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Input payload validation failed');
      expect(res.body).toHaveProperty('errors');
      expect(typeof res.body.errors).toBe('object');
    });

    it('returns 400 when title is not a string', async () => {
      const res = await request(app)
        .post('/books')
        .send({ title: 123 })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Input payload validation failed');
    });

    it('does not add to collection on validation failure', async () => {
      await request(app)
        .post('/books')
        .send({})
        .set('Content-Type', 'application/json');

      const listRes = await request(app).get('/books');
      expect(listRes.body).toHaveLength(2);
    });

    it('response is marshalled with only id and title fields', async () => {
      const res = await request(app)
        .post('/books')
        .send({ title: 'Test Book' })
        .set('Content-Type', 'application/json');

      expect(Object.keys(res.body).sort()).toEqual(['id', 'title'].sort());
    });

    it('server always overwrites id (client-supplied id is ignored)', async () => {
      const res = await request(app)
        .post('/books')
        // Try to sneak in a custom id — it should be ignored
        .send({ id: 999, title: 'Override Attempt' })
        .set('Content-Type', 'application/json');

      // The server should assign id 2 (last id 1 + 1), not 999
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Book.get  GET /books/:id
  // ---------------------------------------------------------------------------
  describe('GET /books/:id', () => {
    it('returns the matching book marshalled with id and title when it exists', async () => {
      const res = await request(app).get('/books/0');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 0, title: 'War and Peace' });
    });

    it('returns 404 when no book with the given id exists', async () => {
      const res = await request(app).get('/books/999');

      expect(res.status).toBe(404);
    });

    it('returns 404 with error body when book is not found', async () => {
      const res = await request(app).get('/books/999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not found');
    });

    it('returns 404 when id is not an integer', async () => {
      const res = await request(app).get('/books/abc');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not found');
    });

    it('does not modify the collection', async () => {
      await request(app).get('/books/0');
      const listRes = await request(app).get('/books');
      expect(listRes.body).toHaveLength(2);
    });

    it('returns the second seeded book correctly', async () => {
      const res = await request(app).get('/books/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 1, title: 'Python for Dummies' });
    });
  });

  // ---------------------------------------------------------------------------
  // Book.delete  DELETE /books/:id
  // ---------------------------------------------------------------------------
  describe('DELETE /books/:id', () => {
    it('returns the deleted book marshalled with id and title when it exists', async () => {
      const res = await request(app).delete('/books/0');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 0, title: 'War and Peace' });
    });

    it('removes the book from the collection', async () => {
      await request(app).delete('/books/0');

      const listRes = await request(app).get('/books');
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body.find((b: { id: number }) => b.id === 0)).toBeUndefined();
    });

    it('does not remove other books when deleting one', async () => {
      await request(app).delete('/books/0');

      const listRes = await request(app).get('/books');
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0]).toEqual({ id: 1, title: 'Python for Dummies' });
    });

    it('returns marshalled null fields when book does not exist', async () => {
      const res = await request(app).delete('/books/999');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: null, title: null });
    });

    it('collection remains unchanged when deleting a non-existent book', async () => {
      await request(app).delete('/books/999');

      const listRes = await request(app).get('/books');
      expect(listRes.body).toHaveLength(2);
    });

    it('returns 404 when id is not an integer', async () => {
      const res = await request(app).delete('/books/abc');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not found');
    });

    it('after deletion, the book cannot be retrieved', async () => {
      await request(app).delete('/books/1');

      const res = await request(app).get('/books/1');
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // Book.put  PUT /books/:id
  // ---------------------------------------------------------------------------
  describe('PUT /books/:id', () => {
    it('returns the updated book with payload fields applied and id preserved', async () => {
      const res = await request(app)
        .put('/books/0')
        .send({ title: 'Updated Title' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 0, title: 'Updated Title' });
    });

    it('updates the book in place within the collection', async () => {
      await request(app)
        .put('/books/0')
        .send({ title: 'Updated Title' })
        .set('Content-Type', 'application/json');

      const getRes = await request(app).get('/books/0');
      expect(getRes.body).toEqual({ id: 0, title: 'Updated Title' });
    });

    it('preserves the id from the URL path, not from any payload', async () => {
      const res = await request(app)
        .put('/books/1')
        .send({ title: 'New Title', id: 999 })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });

    it('returns marshalled null fields when book does not exist (VERIFY-9)', async () => {
      const res = await request(app)
        .put('/books/999')
        .send({ title: 'Ghost Book' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: null, title: null });
    });

    it('collection remains unchanged when updating a non-existent book', async () => {
      await request(app)
        .put('/books/999')
        .send({ title: 'Ghost Book' })
        .set('Content-Type', 'application/json');

      const listRes = await request(app).get('/books');
      expect(listRes.body).toHaveLength(2);
    });

    it('returns 400 with Flask-RESTPlus-style body on invalid payload', async () => {
      const res = await request(app)
        .put('/books/0')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Input payload validation failed');
      expect(res.body).toHaveProperty('errors');
    });

    it('returns 400 when title is not a string', async () => {
      const res = await request(app)
        .put('/books/0')
        .send({ title: 42 })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Input payload validation failed');
    });

    it('does not modify collection on validation failure', async () => {
      await request(app)
        .put('/books/0')
        .send({})
        .set('Content-Type', 'application/json');

      const getRes = await request(app).get('/books/0');
      expect(getRes.body).toEqual({ id: 0, title: 'War and Peace' });
    });

    it('returns 404 when id is not an integer', async () => {
      const res = await request(app)
        .put('/books/abc')
        .send({ title: 'Some Title' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Global invariants
  // ---------------------------------------------------------------------------
  describe('Global invariants', () => {
    it('collection is seeded with the two initial books on startup', async () => {
      const res = await request(app).get('/books');

      expect(res.body).toContainEqual({ id: 0, title: 'War and Peace' });
      expect(res.body).toContainEqual({ id: 1, title: 'Python for Dummies' });
    });

    it('all endpoints serialize responses through the book marshalling schema (id + title only)', async () => {
      const getList = await request(app).get('/books');
      for (const book of getList.body) {
        expect(Object.keys(book).sort()).toEqual(['id', 'title'].sort());
      }

      const getOne = await request(app).get('/books/0');
      expect(Object.keys(getOne.body).sort()).toEqual(['id', 'title'].sort());

      const post = await request(app)
        .post('/books')
        .send({ title: 'Marshalled?' })
        .set('Content-Type', 'application/json');
      expect(Object.keys(post.body).sort()).toEqual(['id', 'title'].sort());

      const put = await request(app)
        .put('/books/1')
        .send({ title: 'Marshalled?' })
        .set('Content-Type', 'application/json');
      expect(Object.keys(put.body).sort()).toEqual(['id', 'title'].sort());

      const del = await request(app).delete('/books/1');
      expect(Object.keys(del.body).sort()).toEqual(['id', 'title'].sort());
    });

    it('book ids are integers managed by the server', async () => {
      const res = await request(app).get('/books');
      for (const book of res.body) {
        expect(typeof book.id).toBe('number');
        expect(Number.isInteger(book.id)).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Book.find_one