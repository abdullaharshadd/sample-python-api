// MIGRATION_NOTE: The Python source read PYTHON_ENV/PORT env vars and selected a
// per-environment config dictionary. This is migrated to an idiomatic typed
// config module. The source's PYTHON_ENV variable name and its
// development/production configs are preserved.
//
// Per human feedback: the development config reads the PORT env var too, instead
// of hardcoding a port. Both development and production use the same `port` value
// computed from process.env.PORT (falling back to 8080, with NaN validation), so
// PORT from the environment is authoritative in both.

export interface EnvironmentConfig {
  port: number;
  debug: boolean;
  swaggerUrl: string | null;
}

const env: string = process.env.PYTHON_ENV ?? 'development';

// In the source, `port` defaults to the number 8080, but env vars are always
// strings. We parse it so `port` is a number, falling back to 8080.
const rawPort: string | undefined = process.env.PORT;
const port: number = rawPort !== undefined ? Number.parseInt(rawPort, 10) : 8080;

if (Number.isNaN(port)) {
  throw new Error(`Invalid PORT environment variable: "${rawPort}"`);
}

const allEnvironments: Record<string, EnvironmentConfig> = {
  development: { port, debug: true, swaggerUrl: '/api/swagger' },
  production: { port, debug: false, swaggerUrl: null },
};

const selected = allEnvironments[env];

if (selected === undefined) {
  throw new Error(
    `Unknown environment "${env}". Expected one of: ${Object.keys(allEnvironments).join(', ')}`
  );
}

export const environmentConfig: EnvironmentConfig = selected;

export default environmentConfig;
