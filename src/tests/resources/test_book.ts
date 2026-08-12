import request from 'supertest';
import { getApp } from '../../conftest';
import { Express } from 'express';

// MIGRATION_NOTE: The Python source used pytest's `client` fixture (a Flask test
// client) and a wildcard import of `resources.book` to ensure the route module
// was loaded. In the Node/TypeScript migration, routes are mounted explicitly via
// `getApp()` (from src/conftest.ts), so no side-effect import is required.
//
// The Flask test client's `client.get(...)` is replaced by supertest's
// `request(app).get(...)`, and `response.json` is compared against the expected
// payload via Jest's `toEqual`.
describe('GET /books/1', () => {
  let app: Express;

  beforeAll(async () => {
    app = await getApp();
  });

  it('returns 200 with the expected book payload', async () => {
    const response = await request(app).get('/books/1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      title: 'Python for Dummies',
    });
  });
});
