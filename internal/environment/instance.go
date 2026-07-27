// Package environment provides environment-based configuration by reading
// environment variables and selecting a config profile based on the current
// PYTHON_ENV value.
package environment

import (
	"fmt"
	"os"
)

// Config holds the environment-specific configuration values.
type Config struct {
	// Port is the port the application should listen on.
	Port string
	// Debug indicates whether debug mode is enabled.
	Debug bool
	// SwaggerURL is the path where Swagger docs are served. Empty means disabled.
	SwaggerURL string
}

// MIGRATION_NOTE: The source keyed configuration off the PYTHON_ENV variable.
// Deploy review flag D5 requested renaming this to APP_ENV. This has been left
// as PYTHON_ENV to preserve exact behavior; confirm with ops whether it should
// be renamed to APP_ENV before deploy.
const envVarName = "PYTHON_ENV"

// MIGRATION_NOTE: In Python, the "production" profile's port defaulted to the
// PORT env var (falling back to 8080). "development" used a hardcoded 5000.
// We resolve PORT at lookup time to match the original runtime behavior.
const defaultPort = "8080"

// getEnv returns the value of the named environment variable, or fallback if unset.
func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

// Load resolves the active configuration profile based on the environment.
// It reads the environment variable (PYTHON_ENV, defaulting to "development")
// and returns the matching Config. An error is returned if the environment
// name is not recognized.
func Load() (Config, error) {
	env := getEnv(envVarName, "development")
	return resolve(env)
}

// resolve returns the Config for the given environment name.
func resolve(env string) (Config, error) {
	switch env {
	case "development":
		return Config{
			Port:       "5000",
			Debug:      true,
			SwaggerURL: "/api/swagger",
		}, nil
	case "production":
		return Config{
			Port:       getEnv("PORT", defaultPort),
			Debug:      false,
			SwaggerURL: "",
		}, nil
	default:
		return Config{}, fmt.Errorf("unknown environment %q", env)
	}
}
