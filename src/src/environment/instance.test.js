```typescript
// src/src/environment/instance.test.ts

/**
 * Because instance.ts executes at module load time (top-level statements),
 * we must use jest.resetModules() + dynamic require() to re-evaluate the
 * module under different environment-variable combinations.
 */

describe('environment_config – module-level configuration selection', () => {
  // Store original env vars so we can restore them after each test.
  const originalEnv = process.env;

  beforeEach(() => {
    // Give every test a clean, isolated copy of process.env.
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ---------------------------------------------------------------------------
  // Helper: load the module fresh under the current process.env
  // ---------------------------------------------------------------------------
  function loadModule() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./instance') as typeof import('./instance');
  }

  // ---------------------------------------------------------------------------
  // Scenario: PYTHON_ENV is unset → defaults to 'development'
  // ---------------------------------------------------------------------------
  it('defaults to development config when PYTHON_ENV is unset', () => {
    delete process.env.PYTHON_ENV;
    delete process.env.PORT;

    const { environmentConfig } = loadModule();

    expect(environmentConfig).toEqual({
      port: 5000,
      debug: true,
      swaggerUrl: '/api/swagger',
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario: PYTHON_ENV is 'development'
  // ---------------------------------------------------------------------------
  it("returns development config when PYTHON_ENV is 'development'", () => {
    process.env.PYTHON_ENV = 'development';
    delete process.env.PORT;

    const { environmentConfig } = loadModule();

    expect(environmentConfig).toEqual({
      port: 5000,
      debug: true,
      swaggerUrl: '/api/swagger',
    });
  });

  // Development invariants
  it('always has port 5000, debug true, and swaggerUrl /api/swagger in development', () => {
    process.env.PYTHON_ENV = 'development';
    // Even if PORT is set, development config ignores it
    process.env.PORT = '9999';

    const { environmentConfig } = loadModule();

    expect(environmentConfig.port).toBe(5000);
    expect(environmentConfig.debug).toBe(true);
    expect(environmentConfig.swaggerUrl).toBe('/api/swagger');
  });

  // ---------------------------------------------------------------------------
  // Scenario: PYTHON_ENV is 'production' and PORT is unset → port defaults to 8080
  // ---------------------------------------------------------------------------
  it("returns production config with port 8080 when PYTHON_ENV is 'production' and PORT is unset", () => {
    process.env.PYTHON_ENV = 'production';
    delete process.env.PORT;

    const { environmentConfig } = loadModule();

    expect(environmentConfig).toEqual({
      port: 8080,
      debug: false,
      swaggerUrl: null,
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario: PYTHON_ENV is 'production' and PORT is set to a string value
  // The migrated code performs parseInt, so the port should be the numeric value.
  // ---------------------------------------------------------------------------
  it("returns production config with parsed numeric port when PYTHON_ENV is 'production' and PORT is set", () => {
    process.env.PYTHON_ENV = 'production';
    process.env.PORT = '3000';

    const { environmentConfig } = loadModule();

    // The migrated TypeScript code parses PORT to a number.
    expect(environmentConfig.port).toBe(3000);
    expect(typeof environmentConfig.port).toBe('number');
    expect(environmentConfig.debug).toBe(false);
    expect(environmentConfig.swaggerUrl).toBeNull();
  });

  it("returns production config with port 4567 when PORT is '4567'", () => {
    process.env.PYTHON_ENV = 'production';
    process.env.PORT = '4567';

    const { environmentConfig } = loadModule();

    expect(environmentConfig.port).toBe(4567);
  });

  // Production invariants
  it('always has debug false and swaggerUrl null in production', () => {
    process.env.PYTHON_ENV = 'production';
    delete process.env.PORT;

    const { environmentConfig } = loadModule();

    expect(environmentConfig.debug).toBe(false);
    expect(environmentConfig.swaggerUrl).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Scenario: PYTHON_ENV is set to an unrecognized value (e.g. 'staging')
  // The migrated code throws an Error (analogous to a KeyError in Python).
  // ---------------------------------------------------------------------------
  it("throws an error when PYTHON_ENV is set to an unrecognized value like 'staging'", () => {
    process.env.PYTHON_ENV = 'staging';
    delete process.env.PORT;

    expect(() => loadModule()).toThrow(/Unknown environment "staging"/);
  });

  it('throws an error for any other unrecognised PYTHON_ENV value', () => {
    process.env.PYTHON_ENV = 'test-unknown-env';
    delete process.env.PORT;

    expect(() => loadModule()).toThrow(/Unknown environment/);
  });

  // ---------------------------------------------------------------------------
  // Error case: PORT is set to a non-numeric string in production
  // ---------------------------------------------------------------------------
  it('throws an error when PORT is not a valid number in production', () => {
    process.env.PYTHON_ENV = 'production';
    process.env.PORT = 'not-a-number';

    expect(() => loadModule()).toThrow(/Invalid PORT environment variable/);
  });

  // ---------------------------------------------------------------------------
  // Global invariant: config is resolved once at import time
  // Changing process.env AFTER import should not affect the exported value.
  // ---------------------------------------------------------------------------
  it('resolves config once at import time; later env changes have no effect', () => {
    process.env.PYTHON_ENV = 'development';
    delete process.env.PORT;

    const { environmentConfig: configBefore } = loadModule();

    // Mutate env after the module has been loaded
    process.env.PYTHON_ENV = 'production';
    process.env.PORT = '9999';

    // Re-importing within the same require cache should return the same object
    // (module is cached); to confirm resolution-at-import-time we simply verify
    // the already-imported value hasn't changed.
    expect(configBefore.port).toBe(5000);
    expect(configBefore.debug).toBe(true);
    expect(configBefore.swaggerUrl).toBe('/api/swagger');
  });

  // ---------------------------------------------------------------------------
  // Global invariant: config object has exactly the keys port, debug, swaggerUrl
  // ---------------------------------------------------------------------------
  it.each([
    ['development', undefined],
    ['production', undefined],
    ['production', '3000'],
  ])(
    'config object has exactly the expected keys for PYTHON_ENV=%s PORT=%s',
    (pythonEnv, portValue) => {
      process.env.PYTHON_ENV = pythonEnv;
      if (portValue !== undefined) {
        process.env.PORT = portValue;
      } else {
        delete process.env.PORT;
      }

      const { environmentConfig } = loadModule();
      const keys = Object.keys(environmentConfig).sort();

      expect(keys).toEqual(['debug', 'port', 'swaggerUrl']);
    }
  );

  // ---------------------------------------------------------------------------
  // Named export and default export are the same object
  // ---------------------------------------------------------------------------
  it('default export equals named environmentConfig export', () => {
    process.env.PYTHON_ENV = 'development';
    delete process.env.PORT;

    const mod = loadModule();

    expect(mod.default).toBe(mod.environmentConfig);
  });

  // ---------------------------------------------------------------------------
  // Error message contains the list of valid environments
  // ---------------------------------------------------------------------------
  it('error message for unknown env lists supported environments', () => {
    process.env.PYTHON_ENV = 'unknown-env';
    delete process.env.PORT;

    expect(() => loadModule()).toThrow(/development/);
    jest.resetModules();
    expect(() => loadModule()).toThrow(/production/);
  });
});
```