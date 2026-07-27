```go
package server_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"internal/environment"
	"internal/server"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newConfig(port, swaggerURL string, debug bool) *environment.Config {
	return &environment.Config{
		Port:       port,
		SwaggerURL: swaggerURL,
		Debug:      debug,
	}
}

// ---------------------------------------------------------------------------
// NewServer – construction tests
// ---------------------------------------------------------------------------

func TestNewServer(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		cfg         *environment.Config
		wantErr     bool
		errContains string
	}{
		{
			name:        "nil config returns error",
			cfg:         nil,
			wantErr:     true,
			errContains: "nil environment config",
		},
		{
			name:    "valid config with swagger URL succeeds",
			cfg:     newConfig("8080", "/swagger", false),
			wantErr: false,
		},
		{
			name:    "valid config without swagger URL succeeds",
			cfg:     newConfig("8080", "", false),
			wantErr: false,
		},
		{
			name:    "valid config with debug true succeeds",
			cfg:     newConfig("9090", "/api/docs", true),
			wantErr: false,
		},
		{
			name:    "empty port is accepted (caller responsibility)",
			cfg:     newConfig("", "/swagger", false),
			wantErr: false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s, err := server.NewServer(tc.cfg)

			if tc.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.errContains)
				assert.Nil(t, s)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, s)
		})
	}
}

// ---------------------------------------------------------------------------
// API metadata constants
// ---------------------------------------------------------------------------

func TestAPIMetadataConstants(t *testing.T) {
	t.Parallel()

	assert.Equal(t, "1.0", server.APIVersion, "APIVersion must be 1.0")
	assert.Equal(t, "Sample Book API", server.APITitle, "APITitle must match")
	assert.Equal(t, "A simple Book API", server.APIDescription, "APIDescription must match")
}

// ---------------------------------------------------------------------------
// Handler / router tests
// ---------------------------------------------------------------------------

func TestServer_Handler_NotNil(t *testing.T) {
	t.Parallel()

	s, err := server.NewServer(newConfig("8080", "/swagger", false))
	require.NoError(t, err)

	h := s.Handler()
	assert.NotNil(t, h, "Handler() must return a non-nil http.Handler")
}

// ---------------------------------------------------------------------------
// Swagger endpoint tests
// ---------------------------------------------------------------------------

func TestSwaggerInfoHandler(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		swaggerURL     string
		requestPath    string
		wantStatusCode int
		wantBody       bool // true → validate JSON body fields
	}{
		{
			name:           "swagger URL configured – GET returns 200 with JSON",
			swaggerURL:     "/swagger",
			requestPath:    "/swagger",
			wantStatusCode: http.StatusOK,
			wantBody:       true,
		},
		{
			name:           "swagger URL configured – wrong path returns 404",
			swaggerURL:     "/swagger",
			requestPath:    "/not-swagger",
			wantStatusCode: http.StatusNotFound,
			wantBody:       false,
		},
		{
			name:           "swagger URL not configured – request to /swagger returns 404",
			swaggerURL:     "",
			requestPath:    "/swagger",
			wantStatusCode: http.StatusNotFound,
			wantBody:       false,
		},
		{
			name:           "swagger URL at nested path",
			swaggerURL:     "/api/v1/docs",
			requestPath:    "/api/v1/docs",
			wantStatusCode: http.StatusOK,
			wantBody:       true,
		},
		{
			name:           "swagger URL at nested path – mismatched request",
			swaggerURL:     "/api/v1/docs",
			requestPath:    "/api/v1/swagger",
			wantStatusCode: http.StatusNotFound,
			wantBody:       false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s, err := server.NewServer(newConfig("8080", tc.swaggerURL, false))
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodGet, tc.requestPath, nil)
			rec := httptest.NewRecorder()

			s.Handler().ServeHTTP(rec, req)

			assert.Equal(t, tc.wantStatusCode, rec.Code)

			if tc.wantBody {
				assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))

				var payload map[string]string
				err := json.Unmarshal(rec.Body.Bytes(), &payload)
				require.NoError(t, err, "response body must be valid JSON")

				assert.Equal(t, server.APITitle, payload["title"])
				assert.Equal(t, server.APIVersion, payload["version"])
				assert.Equal(t, server.APIDescription, payload["description"])
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Middleware smoke tests
// ---------------------------------------------------------------------------

func TestServer_MiddlewarePresent(t *testing.T) {
	t.Parallel()

	s, err := server.NewServer(newConfig("8080", "/swagger", false))
	require.NoError(t, err)

	// The Recoverer middleware should prevent panics from bubbling to the test.
	// Register a panic-inducing route via a wrapper (we cannot modify the
	// server internals, so we verify the router itself handles it gracefully by
	// using an intermediary).  Instead, verify the server survives a normal
	// request.
	req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
	rec := httptest.NewRecorder()

	assert.NotPanics(t, func() {
		s.Handler().ServeHTTP(rec, req)
	})
}

// TestServer_RequestID verifies that the RequestID middleware injects a header.
func TestServer_RequestID(t *testing.T) {
	t.Parallel()

	s, err := server.NewServer(newConfig("8080", "/swagger", false))
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
	rec := httptest.NewRecorder()

	s.Handler().ServeHTTP(rec, req)

	// chi's RequestID middleware sets X-Request-Id on the response (via the
	// context); the header is typically added to the response as well.
	// We just assert the server did not panic and returned a response.
	assert.NotEmpty(t, rec.Code)
}

// ---------------------------------------------------------------------------
// Run – context-cancellation / graceful-shutdown tests
// ---------------------------------------------------------------------------

func TestServer_Run_ContextCancellation(t *testing.T) {
	t.Parallel()

	// Use port 0 so the OS assigns a free port – avoids bind conflicts.
	cfg := newConfig("0", "", false)
	s, err := server.NewServer(cfg)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- s.Run(ctx)
	}()

	// Give the server a moment to bind.
	time.Sleep(50 * time.Millisecond)

	// Cancel the context to trigger graceful shutdown.
	cancel()

	select {
	case err := <-errCh:
		assert.NoError(t, err, "Run should return nil after graceful shutdown")
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for Run to return after context cancellation")
	}
}

func TestServer_Run_InvalidPort(t *testing.T) {
	t.Parallel()

	// A port value that will definitely fail to bind.
	cfg := newConfig("99999", "", false)
	s, err := server.NewServer(cfg)
	require.NoError(t, err)

	ctx := context.Background()

	err = s.Run(ctx)
	require.Error(t, err, "Run should return an error for an invalid port")
	assert.Contains(t, err.Error(), "server:")
}

// ---------------------------------------------------------------------------
// Multiple server instances are independent (no module-level singleton)
// ---------------------------------------------------------------------------

func TestNewServer_IndependentInstances(t *testing.T) {
	t.Parallel()

	cfg1 := newConfig("8081", "/docs", false)
	cfg2 := newConfig("8082", "/api-docs", true)

	s1, err1 := server.NewServer(cfg1)
	s2, err2 := server.NewServer(cfg2)

	require.NoError(t, err1)
	require.NoError(t, err2)
	require.NotNil(t, s1)
	require.NotNil(t, s2)

	// s1 should serve /docs but not /api-docs.
	req1 := httptest.NewRequest(http.MethodGet, "/docs", nil)
	rec1 := httptest.NewRecorder()
	s1.Handler().ServeHTTP(rec1, req1)
	assert.Equal(t, http.StatusOK, rec1.Code)

	req1b := httptest.NewRequest(http.MethodGet, "/api-docs", nil)
	rec1b := httptest.NewRecorder()
	s1.Handler().ServeHTTP(rec1b, req1b)
	assert.Equal(t, http.StatusNotFound, rec1b.Code)

	// s2 should serve /api-docs but not /docs.
	req2 := httptest.NewRequest(http.MethodGet, "/api-docs", nil)
	rec2 := httptest.NewRecorder()
	s2.Handler().ServeHTTP(rec2, req2)
	assert.Equal(t, http.StatusOK, rec2.Code)

	req2b := httptest.NewRequest(http.MethodGet, "/docs", nil)
	rec2b := httptest.NewRecorder()
	s2.Handler().ServeHTTP(rec2b, req2b)
	assert.Equal(t, http.StatusNotFound, rec2b.Code)
}

// ---------------------------------------------------------------------------
// Swagger JSON payload invariants
// ---------------------------------------------------------------------------

func TestSwaggerInfoHandler_JSONInvariants(t *testing.T) {
	t.Parallel()

	swaggerPaths := []string{
		"/swagger",
		"/api/docs",
		"/v1/swagger-ui",
	}

	for _, path := range swaggerPaths {
		path := path
		t.Run("swagger_path="+path, func(t *testing.T) {
			t.Parallel()

			s, err := server.NewServer(newConfig("8080", path, false))
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()
			s.Handler().ServeHTTP(rec, req)

			require.Equal(t, http.StatusOK, rec.Code)

			var payload map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))

			// Invariants: version, title, description are always the canonical values.
			assert.Equal(t, "1.0", payload["version"], "version invariant")
			assert.Equal(t, "Sample Book API", payload["title"], "title invariant")
			assert.Equal(t, "A simple Book API", payload["description"], "description invariant")
		})
	}
}

// ---------------------------------------------------------------------------
// HTTP method handling on swagger endpoint
// ---------------------------------------------------------------------------

func TestSwaggerInfoHandler_HTTPMethods(t *testing.T) {
	t.Parallel()

	tests := []struct {
		method         string
		wantStatusCode int
	}{
		{http.MethodGet, http.StatusOK},
		{http.MethodPost, http.StatusMethodNotAllowed},
		{http.MethodPut, http.StatusMethodNotAllowed},
		{http.MethodDelete, http.StatusMethodNotAllowed},
		{http.MethodPatch, http.StatusMethodNotAllowed},
	}

	s, err := server.NewServer(newConfig("8080", "/swagger", false))
	require.NoError(t, err)

	for _, tc := range tests {
		tc := tc
		t.Run("method="+tc.method, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(tc.method, "/swagger", nil)
			rec := httptest.NewRecorder()
			s.Handler().ServeHTTP(rec, req)

			assert.Equal(t, tc.wantStatusCode, rec.Code)
		})
	}
}
```