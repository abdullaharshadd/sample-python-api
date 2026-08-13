```typescript
import request from 'supertest';
import { Express } from 'express';
import { getApp, createTestHarness, TestHarness } from '../../conftest';

describe('Book Resource - GET /books/:id', () => {
  let app: Express;
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
    app = getApp();
  });

  afterAll(async () => {
    if (
      harness &&
      typeof (harness as unknown as { close?: () => Promise<void> }).close ===
        'function'
    ) {
      await (harness as unknown as { close: () => Promise<void> }).close();
    }
  });

  describe('GET /books/1', () => {
    it('returns HTTP 200 for an existing book', async () => {
      const response = await request(app).get('/books/1');

      expect(response.status).toBe(200);
    });

    it('returns JSON content type', async () => {
      const response = await request(app).get('/books/1');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('returns the expected book payload with id and title fields', async () => {
      const response = await request(app).get('/books/1');

      expect(response.body).toEqual({
        id: 1,
        title: 'Python for Dummies',
      });
    });

    it("returns a body with an 'id' field matching the requested id", async () => {
      const response = await request(app).get('/books/1');

      expect(response.body).toHaveProperty('id', 1);
    });

    it("returns a body with a 'title' field", async () => {
      const response = await request(app).get('/books/1');

      expect(response.body).toHaveProperty('title');
      expect(typeof response.body.title).toBe('string');
    });

    it('returns a valid JSON body containing both id and title properties', async () => {
      const response = await request(app).get('/books/1');

      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
    });

    it('does not modify persistent state (subsequent GET returns the same result)', async () => {
      const firstResponse = await request(app).get('/books/1');
      const secondResponse = await request(app).get('/books/1');

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(firstResponse.body).toEqual(secondResponse.body);
    });
  });

  describe('GET /books/:id - endpoint availability', () => {
    it('responds to GET requests at /books/1', async () => {
      const response = await request(app).get('/books/1');

      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(405);
    });
  });
});
```