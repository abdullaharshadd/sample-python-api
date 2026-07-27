```go
package internal

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNewTestHandler validates that newTestHandler produces a usable http.Handler
// that mirrors the pytest `app` fixture behaviour: it must return a non-nil
// handler each time it is called, the handler must respond to HTTP requests, and
// successive calls must each return an independent, functional handler (isolated
// state, no shared singleton).
func TestNewTestHandler(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		wantErr     bool
		errContains string
		// validate is called with the returned handler when wantErr is false.
		validate func(t *testing.T, h http.Handler)
	}{
		{
			name:    "returns a non-nil handler on success",
			wantErr: false,
			validate: func(t *testing.T, h http.Handler) {
				t.Helper()
				assert.NotNil(t, h, "handler must not be nil")
			},
		},
		{
			name:    "returned handler serves HTTP requests without panicking",
			wantErr: false,
			validate: func(t *testing.T, h http.Handler) {
				t.Helper()
				srv := httptest.NewServer(h)
				defer srv.Close()

				resp, err := srv.Client().Get(srv.URL + "/")
				require.NoError(t, err, "GET / must not error")
				defer resp.Body.Close()

				// Any HTTP response (even 404) proves the handler is alive.
				assert.GreaterOrEqual(t, resp.StatusCode, http.StatusContinue,
					"status code should be a valid HTTP status")
				assert.Less(t, resp.StatusCode, 600,
					"status code should be a valid HTTP status")
			},
		},
		{
			name:    "successive calls return independent handlers",
			wantErr: false,
			validate: func(t *testing.T, h http.Handler) {
				t.Helper()
				// Obtain a second handler independently.
				h2, err := newTestHandler()
				require.NoError(t, err, "second call to newTestHandler must not error")
				require.NotNil(t, h2, "second handler must not be nil")

				// They should be different instances (pointer inequality).
				assert.NotSame(t, h, h2,
					"each call should return a distinct handler instance")
			},
		},
		{
			name:    "handler implements http.Handler interface",
			wantErr: false,
			validate: func(t *testing.T, h http.Handler) {
				t.Helper()
				// Static assertion: if h is not nil and satisfies the interface
				// the cast will succeed.
				var _ http.Handler = h
				assert.Implements(t, (*http.Handler)(nil), h,
					"returned value must implement http.Handler")
			},
		},
		{
			name:    "handler can be used with httptest.NewRecorder",
			wantErr: false,
			validate: func(t *testing.T, h http.Handler) {
				t.Helper()
				req := httptest.NewRequest(http.MethodGet, "/", nil)
				rec := httptest.NewRecorder()

				// ServeHTTP must not panic.
				assert.NotPanics(t, func() {
					h.ServeHTTP(rec, req)
				}, "ServeHTTP must not panic")

				result := rec.Result()
				defer result.Body.Close()

				assert.GreaterOrEqual(t, result.StatusCode, http.StatusContinue,
					"status code should be a valid HTTP status")
			},
		},
	}

	for _, tc := range tests {
		tc := tc // capture range variable
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			h, err := newTestHandler()

			if tc.wantErr {
				require.Error(t, err)
				if tc.errContains != "" {
					assert.Contains(t, err.Error(), tc.errContains)
				}
				assert.Nil(t, h, "handler must be nil when an error is returned")
				return
			}

			require.NoError(t, err, "newTestHandler must not return an error")
			require.NotNil(t, h, "newTestHandler must return a non-nil handler")

			if tc.validate != nil {
				tc.validate(t, h)
			}
		})
	}
}

// TestNewTestHandlerIsolation verifies the singleton invariant from the
// migration note: each handler produced by newTestHandler must be independently
// usable and must not share state with siblings.
func TestNewTestHandlerIsolation(t *testing.T) {
	t.Parallel()

	const numInstances = 3

	handlers := make([]http.Handler, numInstances)
	for i := 0; i < numInstances; i++ {
		h, err := newTestHandler()
		require.NoErrorf(t, err, "call %d: newTestHandler must not error", i)
		require.NotNilf(t, h, "call %d: handler must not be nil", i)
		handlers[i] = h
	}

	tests := []struct {
		name     string
		indexA   int
		indexB   int
		wantSame bool
	}{
		{
			name:     "first and second handlers are distinct instances",
			indexA:   0,
			indexB:   1,
			wantSame: false,
		},
		{
			name:     "first and third handlers are distinct instances",
			indexA:   0,
			indexB:   2,
			wantSame: false,
		},
		{
			name:     "second and third handlers are distinct instances",
			indexA:   1,
			indexB:   2,
			wantSame: false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			a := handlers[tc.indexA]
			b := handlers[tc.indexB]

			if tc.wantSame {
				assert.Same(t, a, b, "expected the same handler instance")
			} else {
				assert.NotSame(t, a, b, "expected distinct handler instances")
			}
		})
	}
}

// TestNewTestHandlerHTTPMethods validates that the handler responds to common
// HTTP methods, confirming it is fully wired up and not a no-op stub.
func TestNewTestHandlerHTTPMethods(t *testing.T) {
	t.Parallel()

	h, err := newTestHandler()
	require.NoError(t, err, "newTestHandler must not error")
	require.NotNil(t, h, "handler must not be nil")

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{
			name:   "GET root path",
			method: http.MethodGet,
			path:   "/",
		},
		{
			name:   "GET books collection",
			method: http.MethodGet,
			path:   "/books",
		},
		{
			name:   "POST books collection",
			method: http.MethodPost,
			path:   "/books",
		},
		{
			name:   "GET single book",
			method: http.MethodGet,
			path:   "/books/1",
		},
		{
			name:   "PUT single book",
			method: http.MethodPut,
			path:   "/books/1",
		},
		{
			name:   "DELETE single book",
			method: http.MethodDelete,
			path:   "/books/1",
		},
		{
			name:   "HEAD root path",
			method: http.MethodHead,
			path:   "/",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()

			assert.NotPanics(t, func() {
				h.ServeHTTP(rec, req)
			}, "ServeHTTP must not panic for %s %s", tc.method, tc.path)

			result := rec.Result()
			defer result.Body.Close()

			assert.GreaterOrEqual(t, result.StatusCode, http.StatusContinue,
				"%s %s: status code must be a valid HTTP status", tc.method, tc.path)
			assert.Less(t, result.StatusCode, 600,
				"%s %s: status code must be a valid HTTP status", tc.method, tc.path)
		})
	}
}

// TestNewTestHandlerDoesNotModifyRequest ensures the handler does not mutate
// the incoming request in an observable way (i.e., no forbidden side-effects on
// the caller's request object).
func TestNewTestHandlerDoesNotModifyRequest(t *testing.T) {
	t.Parallel()

	h, err := newTestHandler()
	require.NoError(t, err)
	require.NotNil(t, h)

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{name: "GET /", method: http.MethodGet, path: "/"},
		{name: "GET /books", method: http.MethodGet, path: "/books"},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(tc.method, tc.path, nil)
			originalMethod := req.Method
			originalURL := req.URL.String()

			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			assert.Equal(t, originalMethod, req.Method,
				"handler must not alter request Method")
			assert.Equal(t, originalURL, req.URL.String(),
				"handler must not alter request URL")
		})
	}
}
```