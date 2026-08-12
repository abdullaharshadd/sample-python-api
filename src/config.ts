import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://app:app@migrator-sandbox-db:5432/app?sslmode=disable'),
  JWT_SECRET: z.string().default('default_jwt_secret'),
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const config = envSchema.parse(process.env);