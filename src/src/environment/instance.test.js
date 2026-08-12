```typescript
import { jest } from '@jest/globals';

/**
 * Tests for src/environment/instance.ts
 *
 * Because the module resolves its configuration once at import time, we must
 * reset the module registry and re-import it for every scenario that requires
 * a different environment.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Re-imports the environment/instance module (and its config dependency) with
 * a fresh module registry so that the module-level code runs again under the
 * provided environment variables.
 */
async function loadEnvironmentConfig(env: Record<string, string | undefined>): Promise<{
  environmentConfig: import('./instance').EnvironmentConfig;
}> {
  // Snapshot original env
  const originalEnv = { ...process.env };

  // Clear relevant keys first
  delete process.env.NODE_ENV;
  delete process.env.PORT;

  // Apply the supplied overrides
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  // Reset module registry so both config.ts and instance.ts are re-evaluated
  jest.resetModules();

  try {
    const mod = await import('./instance');
    return { environmentConfig: mod.environmentConfig };
  } finally {
    // Restore environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('environment/instance – environmentConfig', () => {
  afterEach(() => {
    jest.resetModules();
  });

  // -------------------------------------------------------------------------
  // Development / default scenarios
  // -------------------------------------------------------------------------

  describe("when NODE_ENV is unset (falls back to 'development')", () => {
    it('should expose the development config', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: undefined,
        PORT: undefined,
      });

      expect(environmentConfig).toEqual({
        port: 5000,
        debug: true,
        swaggerUrl: '/api/swagger',
      });
    });

    it('development config port is always 5000', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: undefined,
        PORT: undefined,
      });
      expect(environmentConfig.port).toBe(5000);
    });

    it('development config debug is always true', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: undefined,
        PORT: undefined,
      });
      expect(environmentConfig.debug).toBe(true);
    });

    it("development config swaggerUrl is always '/api/swagger'", async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: undefined,
        PORT: undefined,
      });
      expect(environmentConfig.swaggerUrl).toBe('/api/swagger');
    });
  });

  describe("when NODE_ENV is 'development'", () => {
    it('should expose the development config', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'development',
        PORT: undefined,
      });

      expect(environmentConfig).toEqual({
        port: 5000,
        debug: true,
        swaggerUrl: '/api/swagger',
      });
    });

    it('production PORT value is ignored for the development config', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'development',
        PORT: '9999',
      });

      // Port must remain 5000 regardless of PORT env var
      expect(environmentConfig.port).toBe(5000);
    });
  });

  // -------------------------------------------------------------------------
  // Production scenarios
  // -------------------------------------------------------------------------

  describe("when NODE_ENV is 'production' and PORT is unset", () => {
    it('should expose the production config with the default port 8080', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'production',
        PORT: undefined,
      });

      expect(environmentConfig.debug).toBe(false);
      expect(environmentConfig.swaggerUrl).toBeNull();
      // Default port when PORT is not set should be 8080
      expect(environmentConfig.port).toBe(8080);
    });

    it('debug is false in production', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'production',
        PORT: undefined,
      });
      expect(environmentConfig.debug).toBe(false);
    });

    it('swaggerUrl is null in production', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'production',
        PORT: undefined,
      });
      expect(environmentConfig.swaggerUrl).toBeNull();
    });
  });

  describe("when NODE_ENV is 'production' and PORT is set", () => {
    it("should use the PORT value from the environment (e.g. '3000')", async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'production',
        PORT: '3000',
      });

      // The migrated code does Number(config.PORT) so the port will be 3000
      expect(environmentConfig.port).toBe(3000);
      expect(environmentConfig.debug).toBe(false);
      expect(environmentConfig.swaggerUrl).toBeNull();
    });

    it('should reflect an arbitrary PORT value set in the environment', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'production',
        PORT: '4242',
      });

      expect(environmentConfig.port).toBe(4242);
    });
  });

  // -------------------------------------------------------------------------
  // Invariants
  // -------------------------------------------------------------------------

  describe('invariants', () => {
    it('development config always has port 5000', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'development',
      });
      expect(environmentConfig.port).toBe(5000);
    });

    it("development config always has swaggerUrl '/api/swagger'", async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'development',
      });
      expect(environmentConfig.swaggerUrl).toBe('/api/swagger');
    });

    it('development config always has debug true', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'development',
      });
      expect(environmentConfig.debug).toBe(true);
    });

    it('production config always has debug false', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'production',
        PORT: '8080',
      });
      expect(environmentConfig.debug).toBe(false);
    });

    it('production config always has swaggerUrl null', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'production',
        PORT: '8080',
      });
      expect(environmentConfig.swaggerUrl).toBeNull();
    });

    it('configuration is resolved once at module load time', async () => {
      // Import once with a specific config
      const { environmentConfig: config1 } = await loadEnvironmentConfig({
        NODE_ENV: 'development',
      });

      // The returned object should be stable (same reference would be checked
      // within the same import; we simply assert the values are consistent).
      expect(config1.port).toBe(5000);
      expect(config1.debug).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Error / unrecognized environment scenario
  //
  // MIGRATION_NOTE: The original Python code raised a KeyError for unrecognised
  // PYTHON_ENV values. The migrated TypeScript code uses NODE_ENV, which is
  // validated by Zod and only accepts 'development', 'production', and 'test'.
  // An unrecognised value (e.g. 'staging') causes Zod validation to throw at
  // config parse time, which is equivalent to the original "module load fails"
  // behaviour.
  // -------------------------------------------------------------------------

  describe("when NODE_ENV is an unrecognized value (e.g. 'staging')", () => {
    it('should throw / fail to load the module at import time', async () => {
      await expect(
        loadEnvironmentConfig({ NODE_ENV: 'staging', PORT: undefined }),
      ).rejects.toThrow();
    });

    it('should throw for any other unrecognized environment value', async () => {
      await expect(
        loadEnvironmentConfig({ NODE_ENV: 'qa', PORT: undefined }),
      ).rejects.toThrow();
    });

    it('should throw for an empty string NODE_ENV', async () => {
      await expect(
        loadEnvironmentConfig({ NODE_ENV: '', PORT: undefined }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 'test' environment – falls back to development branch
  // -------------------------------------------------------------------------

  describe("when NODE_ENV is 'test' (allowed by Zod enum, falls back to development)", () => {
    it('should expose the development config for test environment', async () => {
      const { environmentConfig } = await loadEnvironmentConfig({
        NODE_ENV: 'test',
        PORT: undefined,
      });

      // Per migration note: any non-production env falls back to development
      expect(environmentConfig).toEqual({
        port: 5000,
        debug: true,
        swaggerUrl: '/api/swagger',
      });
    });
  });
});
```