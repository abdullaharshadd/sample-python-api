import { z } from 'zod';

/**
 * Book model / schema definitions.
 *
 * MIGRATION_NOTE: The source defined a Flask-RESTPlus API model
 * (`server.api.model('Book', {...})`) that served two purposes at once:
 *   1. serialization/marshalling of responses
 *   2. Swagger/OpenAPI documentation
 *
 * In this project those concerns are expressed with Zod schemas, which act as
 * the single source of truth consumed by both the router (validation +
 * marshalling) and the Swagger layer (via zod-to-openapi or an equivalent).
 *
 * Field mapping from the source model:
 *   - id:    fields.Integer(description='Id')                         -> optional integer
 *   - title: fields.String(required=True, min_length=1, max_length=200) -> required string, 1..200 chars
 */

/**
 * Full Book shape (as serialized in responses).
 *
 * `id` is optional here to mirror the source, where `id` had no `required=True`
 * constraint (it is assigned by the server and absent on input).
 */
export const bookSchema = z.object({
  id: z.number().int().describe('Id').optional(),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Book title'),
});

/**
 * Input Book shape (for create/update request bodies).
 *
 * MIGRATION_NOTE: The source model was used both for input and output. For
 * input we omit the server-assigned `id`, keeping only the validated `title`.
 * `title` remains required with the same 1..200 length constraints.
 */
export const bookInputSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Book title'),
});

export type Book = z.infer<typeof bookSchema>;
export type BookInput = z.infer<typeof bookInputSchema>;

/**
 * Marshal an arbitrary value into the Book response shape.
 *
 * MIGRATION_NOTE: Flask-RESTPlus performed field-level marshalling implicitly
 * via the API model. `marshalBook` makes that explicit: it strips any extra
 * fields and coerces the value to the documented `Book` shape. Throws a
 * ZodError if the value cannot be represented as a Book.
 */
export function marshalBook(value: unknown): Book {
  return bookSchema.parse(value);
}

/**
 * Marshal a "not found" / empty result.
 *
 * MIGRATION_NOTE: Flask-RESTPlus `marshal_with` on a missing resource yields a
 * document with null fields. `marshalNull` reproduces that behaviour for
 * endpoints that must return an empty Book envelope rather than throwing.
 */
export function marshalNull(): { id: null; title: null } {
  return { id: null, title: null };
}
