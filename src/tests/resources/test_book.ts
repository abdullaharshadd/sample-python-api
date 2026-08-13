import request from 'supertest';
import { Express } from 'express';
import { getApp, createTestHarness, TestHarness } from '../../conftest';

/**
 * Integration tests for the Book resource.
 *
 * MIGRATION_NOTE: The source (`tests/resources/test_book.py`) used a pytest
 * `client` fixture (a Flask test client) and a wildcard import
 * (`from resources.book import *`) whose only purpose was the import side
 * effect of registering the book routes. In this project route registration
 * is done explicitly by the `Server`/app, so we obtain the Express app via
 * `getApp()` and drive it with supertest instead of a Flask test client.
 *
 * MIGRATION_NOTE: The Python `client` fixture is replaced by the shared
 * `{ client, repo }` harness (`createTestHarness`). Here only the HTTP client
 * side is needed, so the harness is built and the app is used with supertest.
 */
describe('GET /books/1', () => {
  let app: Express;
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
    app = getApp();
  });

  afterAll(async () => {
    if (harness && typeof (harness as unknown as { close?: () => Promise<void> }).close === 'function') {
      await (harness as unknown as { close: () => Promise<void> }).close();
    }
  });

  it('returns 200 and the expected book payload', async () => {
    const response = await request(app).get('/books/1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      title: 'Python for Dummies',
    });
  });
});
