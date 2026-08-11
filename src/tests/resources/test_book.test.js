```typescript
import request from 'supertest';
import { getApp } from '../../conftest';
import { Express } from 'express';

describe('GET /books/1', () => {
  let app: Express;

  beforeAll(async () => {
    app = await getApp();
  });

  describe('GET request to /books/1 for an existing book', () => {
    it('returns HTTP 200 with the expected book payload', async () => {
      const response = await request(app).get('/books/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        title: 'Python for Dummies',
      });
    });

    it('returns a valid JSON response', async () => {
      const response = await request(app).get('/books/1');

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
      expect(response.body).not.toBeNull();
    });

    it("returns an object with an 'id' field equal to the requested book id", async () => {
      const response = await request(app).get('/books/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(1);
    });

    it("returns an object with a 'title' field", async () => {
      const response = await request(app).get('/books/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title');
      expect(typeof response.body.title).toBe('string');
    });

    it('the book identifier in the response corresponds to the identifier in the request path', async () => {
      const response = await request(app).get('/books/1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
    });
  });
});
```