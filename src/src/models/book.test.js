```typescript
import { z } from 'zod';
import { bookSchema, bookInputSchema } from '../../src/models/book';
import type { Book, BookInput } from '../../src/models/book';

describe('bookSchema', () => {
  describe('field definitions', () => {
    it('should expose exactly two fields: id and title', () => {
      const shape = bookSchema.shape;
      const keys = Object.keys(shape);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('id');
      expect(keys).toContain('title');
    });

    it('should have id field description as "Id"', () => {
      const idField = bookSchema.shape.id;
      // Zod wraps optional around the described field; unwrap to check description
      const def = idField._def;
      // The description is stored in the innerType after .describe()
      // Walk the chain: ZodOptional -> ZodNumber (with description)
      let inner = def;
      // Traverse optional wrapper if present
      if (inner.typeName === 'ZodOptional') {
        inner = inner.innerType._def;
      }
      expect(inner.description).toBe('Id');
    });

    it('should have title field description as "Book title"', () => {
      const titleField = bookSchema.shape.title;
      const def = titleField._def;
      expect(def.description).toBe('Book title');
    });
  });

  describe('valid inputs', () => {
    it('should parse a book object with an integer id and valid title', () => {
      const input = { id: 1, title: 'The Great Gatsby' };
      const result = bookSchema.parse(input);
      expect(result).toEqual({ id: 1, title: 'The Great Gatsby' });
      expect(typeof result.id).toBe('number');
      expect(typeof result.title).toBe('string');
    });

    it('should parse a book object without id (id is optional)', () => {
      const input = { title: 'Brave New World' };
      const result = bookSchema.parse(input);
      expect(result).toEqual({ title: 'Brave New World' });
      expect(result.id).toBeUndefined();
    });

    it('should parse a book with id explicitly set to undefined', () => {
      const input = { id: undefined, title: 'Some Title' };
      const result = bookSchema.parse(input);
      expect(result.title).toBe('Some Title');
      expect(result.id).toBeUndefined();
    });

    it('should parse a title with exactly 1 character (min boundary)', () => {
      const input = { title: 'A' };
      const result = bookSchema.parse(input);
      expect(result.title).toBe('A');
    });

    it('should parse a title with exactly 200 characters (max boundary)', () => {
      const title = 'A'.repeat(200);
      const input = { title };
      const result = bookSchema.parse(input);
      expect(result.title).toBe(title);
    });

    it('should parse a book with various valid integer ids', () => {
      [0, 1, 42, 9999, -1].forEach((id) => {
        const result = bookSchema.parse({ id, title: 'Valid Title' });
        expect(result.id).toBe(id);
      });
    });

    it('should serialize id as integer and title as string in the result', () => {
      const input: Book = { id: 7, title: 'Node.js Patterns' };
      const result = bookSchema.parse(input);
      expect(Number.isInteger(result.id)).toBe(true);
      expect(typeof result.title).toBe('string');
    });
  });

  describe('title validation errors', () => {
    it('should fail validation when title is missing (required field)', () => {
      const input = { id: 1 };
      expect(() => bookSchema.parse(input)).toThrow();
      const result = bookSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const titleError = result.error.issues.find((i) => i.path.includes('title'));
        expect(titleError).toBeDefined();
      }
    });

    it('should fail validation when title is an empty string (below min_length of 1)', () => {
      const input = { id: 1, title: '' };
      const result = bookSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const titleError = result.error.issues.find((i) => i.path.includes('title'));
        expect(titleError).toBeDefined();
      }
    });

    it('should fail validation when title exceeds max_length of 200 characters', () => {
      const input = { id: 1, title: 'A'.repeat(201) };
      const result = bookSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const titleError = result.error.issues.find((i) => i.path.includes('title'));
        expect(titleError).toBeDefined();
      }
    });

    it('should fail validation when title is null', () => {
      const input = { id: 1, title: null };
      const result = bookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should fail validation when title is a number instead of string', () => {
      const input = { id: 1, title: 123 };
      const result = bookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('id field validation', () => {
    it('should treat id as optional — omitting id should succeed', () => {
      const result = bookSchema.safeParse({ title: 'Some Book' });
      expect(result.success).toBe(true);
    });

    it('should fail when id is a non-integer number (float)', () => {
      const input = { id: 1.5, title: 'Some Book' };
      const result = bookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should fail when id is a string', () => {
      const input = { id: 'abc', title: 'Some Book' };
      const result = bookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should fail when id is null', () => {
      const input = { id: null, title: 'Some Book' };
      const result = bookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should not require id — it has no required constraint', () => {
      // id omitted entirely
      const resultWithout = bookSchema.safeParse({ title: 'No Id Book' });
      expect(resultWithout.success).toBe(true);

      // id provided
      const resultWith = bookSchema.safeParse({ id: 5, title: 'With Id Book' });
      expect(resultWith.success).toBe(true);
    });
  });

  describe('extra fields', () => {
    it('should strip unknown fields by default (Zod strip behavior)', () => {
      const input = { id: 1, title: 'Valid', extra: 'should be stripped' };
      const result = bookSchema.parse(input);
      expect((result as any).extra).toBeUndefined();
    });
  });
});

describe('bookInputSchema', () => {
  it('should omit the id field from the input schema', () => {
    const shape = bookInputSchema.shape;
    const keys = Object.keys(shape);
    expect(keys).not.toContain('id');
    expect(keys).toContain('title');
  });

  it('should parse a valid book input with only title', () => {
    const input: BookInput = { title: 'Clean Code' };
    const result = bookInputSchema.parse(input);
    expect(result).toEqual({ title: 'Clean Code' });
  });

  it('should fail when title is missing', () => {
    const result = bookInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should fail when title is empty', () => {
    const result = bookInputSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when title exceeds 200 characters', () => {
    const result = bookInputSchema.safeParse({ title: 'B'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('should parse a title with exactly 1 character', () => {
    const result = bookInputSchema.safeParse({ title: 'X' });
    expect(result.success).toBe(true);
  });

  it('should parse a title with exactly 200 characters', () => {
    const result = bookInputSchema.safeParse({ title: 'Y'.repeat(200) });
    expect(result.success).toBe(true);
  });
});

describe('TypeScript type inference', () => {
  it('should allow a valid Book object matching the inferred type', () => {
    const book: Book = { id: 10, title: 'TypeScript Deep Dive' };
    const result = bookSchema.parse(book);
    expect(result.id).toBe(10);
    expect(result.title).toBe('TypeScript Deep Dive');
  });

  it('should allow a Book without id (optional)', () => {
    const book: Book = { title: 'No Id' };
    const result = bookSchema.parse(book);
    expect(result.title).toBe('No Id');
    expect(result.id).toBeUndefined();
  });

  it('should allow a valid BookInput with only title', () => {
    const input: BookInput = { title: 'Input Only' };
    const result = bookInputSchema.parse(input);
    expect(result.title).toBe('Input Only');
  });
});

describe('schema invariants', () => {
  it('bookSchema should always be named/identified as the Book schema (two fields: id, title)', () => {
    const keys = Object.keys(bookSchema.shape);
    expect(keys.sort()).toEqual(['id', 'title'].sort());
  });

  it('id field should be of integer type and optional', () => {
    // Parse without id — should succeed
    expect(bookSchema.safeParse({ title: 'Test' }).success).toBe(true);
    // Parse with integer id — should succeed
    expect(bookSchema.safeParse({ id: 1, title: 'Test' }).success).toBe(true);
    // Parse with float id — should fail
    expect(bookSchema.safeParse({ id: 1.1, title: 'Test' }).success).toBe(false);
  });

  it('title field should be required and enforce min_length=1 and max_length=200', () => {
    // Missing title
    expect(bookSchema.safeParse({ id: 1 }).success).toBe(false);
    // Empty title
    expect(bookSchema.safeParse({ id: 1, title: '' }).success).toBe(false);
    // 1 char
    expect(bookSchema.safeParse({ id: 1, title: 'A' }).success).toBe(true);
    // 200 chars
    expect(bookSchema.safeParse({ id: 1, title: 'A'.repeat(200) }).success).toBe(true);
    // 201 chars
    expect(bookSchema.safeParse({ id: 1, title: 'A'.repeat(201) }).success).toBe(false);
  });
});
```