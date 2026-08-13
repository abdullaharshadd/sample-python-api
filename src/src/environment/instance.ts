import { config } from '../config';

/**
 * Environment-based configuration.
 *
 * MIGRATION_NOTE: The source read `PYTHON_ENV` and `PORT` directly from
 * os.environ. In this project, environment parsing is centralized in
 * `src/config.ts` (typed via Zod), so we reuse `NODE_ENV` and `PORT` from
 * there instead of re-reading process.env.
 *
 * MIGRATION_NOTE: The source used the value "development" as the default env
 * and keyed a dictionary by it. The Zod `NODE_ENV` enum also allows "test";
 * for any non-"production" environment we fall back to the development config,
 * preserving the original two-branch behaviour.
 */

export interface EnvironmentConfig {
  port: number;
  debug: boolean;
  swaggerUrl: string | null;
}

const port = Number(config.PORT);

const allEnvironments: Record<'development' | 'production', EnvironmentConfig> = {
  development: {
    port: 5000,
    debug: true,
    swaggerUrl: '/api/swagger',
  },
  production: {
    // MIGRATION_NOTE: Source used the runtime PORT env var here (defaulting to
    // 8080 in Python). We mirror that by using the parsed config.PORT value.
    port,
    debug: false,
    swaggerUrl: null,
  },
};

export const environmentConfig: EnvironmentConfig =
  config.NODE_ENV === 'production'
    ? allEnvironments.production
    : allEnvironments.development;