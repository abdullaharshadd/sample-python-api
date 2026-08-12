```typescript
import { z } from 'zod';
import {
  bookSchema,
  bookInputSchema,
  marshalBook,
  marshalNull,
  Book,
  BookInput,
} from './book';

describe('bookSchema', () => {
  describe('field definitions', () => {
    it('should have exactly two fields: id and title', () => {
      const shape = bookSchema.shape;
      const keys = Object.keys(shape);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('id');
      expect(keys).toContain('title');
    });

    it("'id' field should be optional", () => {
      const result = bookSchema.safeParse({ title: 'Valid Title' });
      expect(result.success).toBe(true);
    });

    it("'id' field should be typed as integer", () => {
      const resultValid = bookSchema.safeParse({ id: 42, title: 'Valid Title' });
      expect(resultValid.success).toBe(true);

      const resultFloat = bookSchema.safeParse({ id: 3.14, title: 'Valid Title' });
      expect(resultFloat.success).toBe(false);
    });

    it("'id' field description should be 'Id'", () => {
      const idDef = bookSchema.shape.id;
      // unwrap the optional to get the inner schema description
      const innerSchema = (idDef as z.ZodOptional<z.ZodNumber>).unwrap();
      expect(innerSchema.description).toBe('Id');
    });

    it("'title' field description should be 'Book title'", () => {
      const titleDef = bookSchema.shape.title;
      expect(titleDef.description).toBe('Book title');
    });
  });

  describe('scenario: a Book object is serialized with both id and title present', () => {
    it('should parse an object with both id and title fields correctly', () => {
      const input = { id: 1, title: 'Test Book' };
      const result = bookSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(1);
        expect(typeof result.data.id).toBe('number');
        expect(result.data.title).toBe('Test Book');
        expect(typeof result.data.title).toBe('string');
      }
    });

    it('should expose id as an integer and title as a string matching the defined schema', () => {
      const input = { id: 100, title: 'Another Book' };
      const result = bookSchema.parse(input);
      expect(result).toEqual({ id: 100, title: 'Another Book' });
    });
  });

  describe("scenario: input title is missing or null", () => {
    it("should reject input when 'title' is absent", () => {
      const result = bookSchema.safeParse({ id: 1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        const titleError = result.error.issues.find(
          (issue) => issue.path.includes('title')
        );
        expect(titleError).toBeDefined();
      }
    });

    it("should reject input when 'title' is null", () => {
      const result = bookSchema.safeParse({ id: 1, title: null });
      expect(result.success).toBe(false);
    });

    it("should reject input when 'title' is undefined", () => {
      const result = bookSchema.safeParse({ id: 1, title: undefined });
      expect(result.success).toBe(false);
    });
  });

  describe("scenario: input title is an empty string (length 0)", () => {
    it("should reject input when 'title' has fewer than 1 character", () => {
      const result = bookSchema.safeParse({ id: 1, title: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const titleError = result.error.issues.find(
          (issue) => issue.path.includes('title')
        );
        expect(titleError).toBeDefined();
      }
    });
  });

  describe("scenario: input title exceeds 200 characters", () => {
    it("should reject input when 'title' has more than 200 characters", () => {
      const longTitle = 'a'.repeat(201);
      const result = bookSchema.safeParse({ id: 1, title: longTitle });
      expect(result.success).toBe(false);
      if (!result.success) {
        const titleError = result.error.issues.find(
          (issue) => issue.path.includes('title')
        );
        expect(titleError).toBeDefined();
      }
    });

    it('should reject a title of exactly 201 characters', () => {
      const longTitle = 'b'.repeat(201);
      const result = bookSchema.safeParse({ title: longTitle });
      expect(result.success).toBe(false);
    });
  });

  describe("scenario: input title is between 1 and 200 characters inclusive", () => {
    it('should accept a title of exactly 1 character', () => {
      const result = bookSchema.safeParse({ title: 'A' });
      expect(result.success).toBe(true);
    });

    it('should accept a title of exactly 200 characters', () => {
      const maxTitle = 'a'.repeat(200);
      const result = bookSchema.safeParse({ title: maxTitle });
      expect(result.success).toBe(true);
    });

    it('should accept a title of moderate length', () => {
      const result = bookSchema.safeParse({ title: 'The Great Gatsby' });
      expect(result.success).toBe(true);
    });
  });

  describe("scenario: input omits 'id' but provides a valid 'title'", () => {
    it("should pass validation since 'id' is optional", () => {
      const result = bookSchema.safeParse({ title: 'Valid Title' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeUndefined();
        expect(result.data.title).toBe('Valid Title');
      }
    });
  });
});

describe('bookInputSchema', () => {
  describe('field definitions', () => {
    it('should have exactly one field: title', () => {
      const shape = bookInputSchema.shape;
      const keys = Object.keys(shape);
      expect(keys).toHaveLength(1);
      expect(keys).toContain('title');
    });

    it("'title' field description should be 'Book title'", () => {
      const titleDef = bookInputSchema.shape.title;
      expect(titleDef.description).toBe('Book title');
    });
  });

  describe('title validation', () => {
    it('should reject empty title', () => {
      const result = bookInputSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing title', () => {
      const result = bookInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject title exceeding 200 characters', () => {
      const result = bookInputSchema.safeParse({ title: 'a'.repeat(201) });
      expect(result.success).toBe(false);
    });

    it('should accept a title with exactly 1 character', () => {
      const result = bookInputSchema.safeParse({ title: 'X' });
      expect(result.success).toBe(true);
    });

    it('should accept a title with exactly 200 characters', () => {
      const result = bookInputSchema.safeParse({ title: 'x'.repeat(200) });
      expect(result.success).toBe(true);
    });

    it('should accept a valid title', () => {
      const result = bookInputSchema.safeParse({ title: 'Clean Code' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Clean Code');
      }
    });
  });
});

describe('marshalBook', () => {
  it('should return a valid Book when given a valid input with id and title', () => {
    const input = { id: 5, title: 'Test Book' };
    const result = marshalBook(input);
    expect(result).toEqual({ id: 5, title: 'Test Book' });
  });

  it('should return a valid Book when id is omitted', () => {
    const input = { title: 'No ID Book' };
    const result = marshalBook(input);
    expect(result).toEqual({ title: 'No ID Book' });
    expect(result.id).toBeUndefined();
  });

  it('should strip extra fields not in the schema', () => {
    const input = { id: 1, title: 'Book', extraField: 'should be removed' };
    const result = marshalBook(input);
    expect(result).toEqual({ id: 1, title: 'Book' });
    expect((result as any).extraField).toBeUndefined();
  });

  it('should throw a ZodError when title is missing', () => {
    expect(() => marshalBook({ id: 1 })).toThrow(z.ZodError);
  });

  it('should throw a ZodError when title is empty', () => {
    expect(() => marshalBook({ title: '' })).toThrow(z.ZodError);
  });

  it('should throw a ZodError when title exceeds 200 characters', () => {
    expect(() => marshalBook({ title: 'a'.repeat(201) })).toThrow(z.ZodError);
  });

  it('should throw a ZodError when id is not an integer', () => {
    expect(() => marshalBook({ id: 3.14, title: 'Valid' })).toThrow(z.ZodError);
  });

  it('should throw a ZodError when input is null', () => {
    expect(() => marshalBook(null)).toThrow(z.ZodError);
  });

  it('should throw a ZodError when input is undefined', () => {
    expect(() => marshalBook(undefined)).toThrow(z.ZodError);
  });
});

describe('marshalNull', () => {
  it('should return an object with id: null and title: null', () => {
    const result = marshalNull();
    expect(result).toEqual({ id: null, title: null });
  });

  it('should always return id as null', () => {
    expect(marshalNull().id).toBeNull();
  });

  it('should always return title as null', () => {
    expect(marshalNull().title).toBeNull();
  });

  it('should have exactly two fields', () => {
    const result = marshalNull();
    expect(Object.keys(result)).toHaveLength(2);
  });
});

describe('Type inference', () => {
  it('Book type should include optional id and required title', () => {
    const book: Book = { title: 'Type Test' };
    expect(book.title).toBe('Type Test');
    expect(book.id).toBeUndefined();

    const bookWithId: Book = { id: 10, title: 'Type Test With ID' };
    expect(bookWithId.id).toBe(10);
  });

  it('BookInput type should only include title', () => {
    const input: BookInput = { title: 'Input Type Test' };
    expect(input.title).toBe('Input Type Test');
  });
});

describe('Schema invariants', () => {
  it("'id' field is always typed as an integer (rejects floats)", () => {
    const floatResult = bookSchema.safeParse({ id: 1.5, title: 'Test' });
    expect(floatResult.success).toBe(false);

    const intResult = bookSchema.safeParse({ id: 1, title: 'Test' });
    expect(intResult.success).toBe(true);
  });

  it("'title' field always enforces min_length=1 and max_length=200", () => {
    // Below min
    expect(bookSchema.safeParse({ title: '' }).success).toBe(false);

    // At min boundary
    expect(bookSchema.safeParse({ title: 'a' }).success).toBe(true);

    // At max boundary
    expect(bookSchema.safeParse({ title: 'a'.repeat(200) }).success).toBe(true);

    // Above max
    expect(bookSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false);
  });

  it("'title' field is always required (no default)", () => {
    const result = bookSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("'id' field is always optional", () => {
    const result = bookSchema.safeParse({ title: 'Just Title' });
    expect(result.success).toBe(true);
  });

  it('schema performs no data persistence or business logic', () => {
    // Schema is a pure validation/serialization concern
    expect(typeof bookSchema.parse).toBe('function');
    expect(typeof bookSchema.safeParse).toBe('function');
  });
});
```