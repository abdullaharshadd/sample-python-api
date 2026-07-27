```go
package environment

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		fallback string
		envVal   string
		setEnv   bool
		want     string
	}{
		{
			name:     "returns env var when set to non-empty value",
			key:      "TEST_GET_ENV_VAR",
			fallback: "fallback",
			envVal:   "actualvalue",
			setEnv:   true,
			want:     "actualvalue",
		},
		{
			name:     "returns fallback when env var not set",
			key:      "TEST_GET_ENV_VAR_MISSING",
			fallback: "fallback",
			setEnv:   false,
			want:     "fallback",
		},
		{
			name:     "returns fallback when env var is empty string",
			key:      "TEST_GET_ENV_VAR_EMPTY",
			fallback: "fallback",
			envVal:   "",
			setEnv:   true,
			want:     "fallback",
		},
		{
			name:     "returns env var value of 0",
			key:      "TEST_GET_ENV_VAR_ZERO",
			fallback: "8080",
			envVal:   "0",
			setEnv:   true,
			want:     "0",
		},
		{
			name:     "returns env var port value 3000",
			key:      "PORT",
			fallback: "8080",
			envVal:   "3000",
			setEnv:   true,
			want:     "3000",
		},
		{
			name:     "PORT not set returns default 8080",
			key:      "PORT",
			fallback: "8080",
			setEnv:   false,
			want:     "8080",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setEnv {
				t.Setenv(tt.key, tt.envVal)
			} else {
				os.Unsetenv(tt.key)
			}

			got := getEnv(tt.key, tt.fallback)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestResolve(t *testing.T) {
	tests := []struct {
		name        string
		env         string
		portEnvVal  string
		setPortEnv  bool
		wantConfig  Config
		wantErr     bool
		errContains string
	}{
		{
			name: "development environment returns correct config",
			env:  "development",
			wantConfig: Config{
				Port:       "5000",
				Debug:      true,
				SwaggerURL: "/api/swagger",
			},
			wantErr: false,
		},
		{
			name:       "production environment with PORT set",
			env:        "production",
			portEnvVal: "3000",
			setPortEnv: true,
			wantConfig: Config{
				Port:       "3000",
				Debug:      false,
				SwaggerURL: "",
			},
			wantErr: false,
		},
		{
			name:       "production environment without PORT set uses default 8080",
			env:        "production",
			setPortEnv: false,
			wantConfig: Config{
				Port:       "8080",
				Debug:      false,
				SwaggerURL: "",
			},
			wantErr: false,
		},
		{
			name:        "unknown environment returns error",
			env:         "staging",
			wantConfig:  Config{},
			wantErr:     true,
			errContains: `unknown environment "staging"`,
		},
		{
			name:        "empty string environment returns error",
			env:         "",
			wantConfig:  Config{},
			wantErr:     true,
			errContains: `unknown environment ""`,
		},
		{
			name:        "mixed case environment returns error",
			env:         "Development",
			wantConfig:  Config{},
			wantErr:     true,
			errContains: `unknown environment "Development"`,
		},
		{
			name:        "Production uppercase returns error",
			env:         "Production",
			wantConfig:  Config{},
			wantErr:     true,
			errContains: `unknown environment "Production"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Unsetenv("PORT")
			if tt.setPortEnv {
				t.Setenv("PORT", tt.portEnvVal)
			}

			got, err := resolve(tt.env)

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errContains)
				assert.Equal(t, Config{}, got)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.wantConfig, got)
			}
		})
	}
}

func TestLoad(t *testing.T) {
	tests := []struct {
		name           string
		pythonEnvVal   string
		setPythonEnv   bool
		portEnvVal     string
		setPortEnv     bool
		wantConfig     Config
		wantErr        bool
		errContains    string
	}{
		{
			name:         "PYTHON_ENV set to development",
			pythonEnvVal: "development",
			setPythonEnv: true,
			wantConfig: Config{
				Port:       "5000",
				Debug:      true,
				SwaggerURL: "/api/swagger",
			},
			wantErr: false,
		},
		{
			name:         "PYTHON_ENV set to production with PORT set",
			pythonEnvVal: "production",
			setPythonEnv: true,
			portEnvVal:   "3000",
			setPortEnv:   true,
			wantConfig: Config{
				Port:       "3000",
				Debug:      false,
				SwaggerURL: "",
			},
			wantErr: false,
		},
		{
			name:         "PYTHON_ENV set to production without PORT set",
			pythonEnvVal: "production",
			setPythonEnv: true,
			setPortEnv:   false,
			wantConfig: Config{
				Port:       "8080",
				Debug:      false,
				SwaggerURL: "",
			},
			wantErr: false,
		},
		{
			name:         "PYTHON_ENV not set defaults to development",
			setPythonEnv: false,
			wantConfig: Config{
				Port:       "5000",
				Debug:      true,
				SwaggerURL: "/api/swagger",
			},
			wantErr: false,
		},
		{
			name:         "PYTHON_ENV set to unrecognized value returns error",
			pythonEnvVal: "staging",
			setPythonEnv: true,
			wantConfig:   Config{},
			wantErr:      true,
			errContains:  `unknown environment "staging"`,
		},
		{
			name:         "PYTHON_ENV set to empty string defaults to development",
			pythonEnvVal: "",
			setPythonEnv: true,
			wantConfig: Config{
				Port:       "5000",
				Debug:      true,
				SwaggerURL: "/api/swagger",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Unsetenv(envVarName)
			os.Unsetenv("PORT")

			if tt.setPythonEnv {
				t.Setenv(envVarName, tt.pythonEnvVal)
			}
			if tt.setPortEnv {
				t.Setenv("PORT", tt.portEnvVal)
			}

			got, err := Load()

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errContains)
				assert.Equal(t, Config{}, got)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.wantConfig, got)
			}
		})
	}
}

func TestDevelopmentConfigInvariants(t *testing.T) {
	t.Run("development debug is always true", func(t *testing.T) {
		cfg, err := resolve("development")
		require.NoError(t, err)
		assert.True(t, cfg.Debug, "development config must have Debug=true")
	})

	t.Run("development swagger-url is always /api/swagger", func(t *testing.T) {
		cfg, err := resolve("development")
		require.NoError(t, err)
		assert.Equal(t, "/api/swagger", cfg.SwaggerURL, "development config must have SwaggerURL=/api/swagger")
	})

	t.Run("development port is always 5000 regardless of PORT env var", func(t *testing.T) {
		t.Setenv("PORT", "9999")
		cfg, err := resolve("development")
		require.NoError(t, err)
		assert.Equal(t, "5000", cfg.Port, "development port must be 5000 regardless of PORT env var")
	})
}

func TestProductionConfigInvariants(t *testing.T) {
	t.Run("production debug is always false", func(t *testing.T) {
		os.Unsetenv("PORT")
		cfg, err := resolve("production")
		require.NoError(t, err)
		assert.False(t, cfg.Debug, "production config must have Debug=false")
	})

	t.Run("production swagger-url is always empty", func(t *testing.T) {
		os.Unsetenv("PORT")
		cfg, err := resolve("production")
		require.NoError(t, err)
		assert.Equal(t, "", cfg.SwaggerURL, "production config must have SwaggerURL=''")
	})

	t.Run("production port reflects PORT env var", func(t *testing.T) {
		t.Setenv("PORT", "3000")
		cfg, err := resolve("production")
		require.NoError(t, err)
		assert.Equal(t, "3000", cfg.Port)
	})

	t.Run("production port defaults to 8080 when PORT not set", func(t *testing.T) {
		os.Unsetenv("PORT")
		cfg, err := resolve("production")
		require.NoError(t, err)
		assert.Equal(t, "8080", cfg.Port)
	})
}

func TestRecognizedEnvironmentsExactly(t *testing.T) {
	tests := []struct {
		name    string
		env     string
		isValid bool
	}{
		{"development is recognized", "development", true},
		{"production is recognized", "production", true},
		{"staging is not recognized", "staging", false},
		{"test is not recognized", "test", false},
		{"dev is not recognized", "dev", false},
		{"prod is not recognized", "prod", false},
		{"empty string is not recognized", "", false},
		{"DEVELOPMENT uppercase is not recognized", "DEVELOPMENT", false},
		{"PRODUCTION uppercase is not recognized", "PRODUCTION", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := resolve(tt.env)
			if tt.isValid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestEnvVarName(t *testing.T) {
	t.Run("environment variable name is PYTHON_ENV", func(t *testing.T) {
		assert.Equal(t, "PYTHON_ENV", envVarName)
	})
}

func TestDefaultPort(t *testing.T) {
	t.Run("default port is 8080", func(t *testing.T) {
		assert.Equal(t, "8080", defaultPort)
	})
}

func TestPortEnvVarPreservedAsString(t *testing.T) {
	tests := []struct {
		name     string
		portVal  string
		wantPort string
	}{
		{
			name:     "PORT 3000 preserved as string",
			portVal:  "3000",
			wantPort: "3000",
		},
		{
			name:     "PORT 443 preserved as string",
			portVal:  "443",
			wantPort: "443",
		},
		{
			name:     "PORT 80 preserved as string",
			portVal:  "80",
			wantPort: "80",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("PORT", tt.portVal)
			cfg, err := resolve("production")
			require.NoError(t, err)
			assert.Equal(t, tt.wantPort, cfg.Port, "PORT env var value must be preserved as string without type conversion")
		})
	}
}
```