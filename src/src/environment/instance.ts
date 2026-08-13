import { config } from '../config';

/**
 * Environment-based configuration.
 *
 * MIGRATION_NOTE: The source read `PYTHON_ENV` and `PORT` directly from
 * os.environ. In this project, environment parsing is centralized in
 * `src/config.ts` (typed via Zod), so we reuse `NODE_ENV` from there instead
 * of re-reading process.env.
 *
 * MIGRATION_NOTE: The source keyed a plain dict by the env string and would
 * raise a KeyError for any env other than "development"/"production". The Zod
 * `NODE_ENV` enum also allows "test", which the original code has no entry
 * for. To preserve the original fail-loud behaviour (rather than silently
 * defaulting), we look the env up in the map and throw when it is missing.
 *
 * Per human feedback: both development and production now resolve to
 * port 8080, so environmentConfig.port is 8080 regardless of NODE_ENV.
 */

export interface EnvironmentConfig {
  port: number;
  debug: boolean;
  swaggerUrl: string | null;
}

const allEnvironments: Record<'development' | 'production', EnvironmentConfig> = {
  development: {
    port: 8080,
    debug: true,
    swaggerUrl: '/api/swagger',
  },
  production: {
    port: 8080,
    debug: false,
    swaggerUrl: null,
  },
};

function resolveEnvironmentConfig(env: string): EnvironmentConfig {
  const selected = (allEnvironments as Record<string, EnvironmentConfig | undefined>)[env];
  if (!selected) {
    // MIGRATION_NOTE: Mirrors the original dict lookup KeyError for unknown
    // environments (e.g. "test"), failing loud instead of silently defaulting.
    throw new Error(`No environment configuration defined for NODE_ENV="${env}"`);
  }
  return selected;
}

export const environmentConfig: EnvironmentConfig = resolveEnvironmentConfig(
  config.NODE_ENV,
);
