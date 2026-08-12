import { z } from 'zod';

// MIGRATION_NOTE: The Python source defined a Flask-RESTPlus `api.model('Book', ...)`
// used for request/response serialization and Swagger documentation. There is no
// direct Express equivalent for the RESTPlus model registry, so this is migrated to
// a pure Zod schema. This inverts the source "landmine" by removing the dependency
// on the shared server/api singleton — the schema is now standalone and can be
// imported anywhere for validation without triggering server initialization.
//
// VERIFY-1 (resolved): In the source, `id` is declared as
// `fields.Integer(description='Id')` WITHOUT `required=True`, while `title` IS
// `required=True`. Therefore `id` is optional and `title` is the only required
// field. This matches a typical create/input payload where the server assigns the
// id. The full schema below reflects that: `id` optional, `title` required with
// min length 1 and max length 200 (mirroring min_length/max_length).

/**
 * Zod schema mirroring the Flask-RESTPlus 'Book' model.
 *
 * - id:    optional integer (source: fields.Integer, no required flag)
 * - title: required string, 1..200 chars (source: fields.String required, min/max)
 */
export const bookSchema = z.object({
  id: z
    .number()
    .int()
    .describe('Id')
    .optional(),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Book title'),
});

/**
 * Input schema for creating/updating a Book. Since the source marks only `title`
 * as required (and `id` is server-assigned), the input variant omits `id`.
 */
export const bookInputSchema = bookSchema.omit({ id: true });

export type Book = z.infer<typeof bookSchema>;
export type BookInput = z.infer<typeof bookInputSchema>;
