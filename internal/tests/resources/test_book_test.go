```go
package resources_test

// This file contains table-driven tests for the GET /books/1 endpoint,
// validating the behavioral specs defined for the book resource.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	internal "bookapi/internal"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// bookResponse mirrors the JSON shape returned by the books endpoint.
type bookResponse struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
}

// TestGetBook_TableDriven validates GET /books/{id} against every behavioral
// spec described in the migration notes.
func TestGetBook_TableDriven(t *testing.T) {
	tests := []struct {
		name           string
		path           string
		wantStatusCode int
		wantID         int
		wantTitle      string
		// When wantValidJSON is false we only assert the status code.
		wantValidJSON bool
	}{
		{
			name:           "GET /books/1 returns 200 with correct book payload",
			path:           "/books/1",
			wantStatusCode: http.StatusOK,
			wantID:         1,
			wantTitle:      "Python for Dummies",
			wantValidJSON:  true,
		},
	}

	for _, tc := range tests {
		tc := tc // capture range variable
		t.Run(tc.name, func(t *testing.T) {
			// Arrange – spin up the real application handler via the shared
			// test helper (mirrors conftest.py / the pytest `client` fixture).
			handler := internal.NewTestHandler(t)
			srv := httptest.NewServer(handler)
			defer srv.Close()

			req, err := http.NewRequest(http.MethodGet, srv.URL+tc.path, nil)
			require.NoError(t, err, "building request must not fail")

			// Act
			resp, err := srv.Client().Do(req)
			require.NoError(t, err, "performing request must not fail")
			defer resp.Body.Close()

			// Assert – HTTP status code invariant
			assert.Equal(t, tc.wantStatusCode, resp.StatusCode,
				"status code must match expected value")

			if !tc.wantValidJSON {
				return
			}

			// Assert – response body is valid JSON (global invariant)
			var got bookResponse
			err = json.NewDecoder(resp.Body).Decode(&got)
			require.NoError(t, err, "response body must be valid JSON")

			// Assert – id field matches the requested book ID
			assert.Equal(t, tc.wantID, got.ID,
				"returned 'id' must match the requested book ID")

			// Assert – title field is present and correct
			assert.Equal(t, tc.wantTitle, got.Title,
				"returned 'title' must match the expected value")
		})
	}
}

// TestGetBook_StatusCode_Invariant validates in isolation that a successful
// response always carries HTTP 200 (spec invariant: "A successful response has
// status code 200").
func TestGetBook_StatusCode_Invariant(t *testing.T) {
	tests := []struct {
		name           string
		path           string
		wantStatusCode int
	}{
		{
			name:           "existing book returns 200",
			path:           "/books/1",
			wantStatusCode: http.StatusOK,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			handler := internal.NewTestHandler(t)
			srv := httptest.NewServer(handler)
			defer srv.Close()

			req, err := http.NewRequest(http.MethodGet, srv.URL+tc.path, nil)
			require.NoError(t, err)

			resp, err := srv.Client().Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			assert.Equal(t, tc.wantStatusCode, resp.StatusCode)
		})
	}
}

// TestGetBook_JSONBody_Invariant validates that the response body is valid JSON
// (global invariant: "The book endpoint returns data serialized as JSON").
func TestGetBook_JSONBody_Invariant(t *testing.T) {
	tests := []struct {
		name string
		path string
	}{
		{
			name: "response body is valid JSON for /books/1",
			path: "/books/1",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			handler := internal.NewTestHandler(t)
			srv := httptest.NewServer(handler)
			defer srv.Close()

			req, err := http.NewRequest(http.MethodGet, srv.URL+tc.path, nil)
			require.NoError(t, err)

			resp, err := srv.Client().Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			require.Equal(t, http.StatusOK, resp.StatusCode)

			var got map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&got)
			assert.NoError(t, err, "response body must be valid JSON")
		})
	}
}

// TestGetBook_IDMatchesRequest validates the invariant
// "The returned object's 'id' field matches the requested book ID".
func TestGetBook_IDMatchesRequest(t *testing.T) {
	tests := []struct {
		name   string
		path   string
		wantID int
	}{
		{
			name:   "id field equals 1 for /books/1",
			path:   "/books/1",
			wantID: 1,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			handler := internal.NewTestHandler(t)
			srv := httptest.NewServer(handler)
			defer srv.Close()

			req, err := http.NewRequest(http.MethodGet, srv.URL+tc.path, nil)
			require.NoError(t, err)

			resp, err := srv.Client().Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			require.Equal(t, http.StatusOK, resp.StatusCode)

			var got bookResponse
			require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))

			assert.Equal(t, tc.wantID, got.ID,
				"'id' in response must equal the path parameter")
		})
	}
}

// TestGetBook_TitleFieldPresent validates the invariant
// "The returned object contains a 'title' field".
func TestGetBook_TitleFieldPresent(t *testing.T) {
	tests := []struct {
		name      string
		path      string
		wantTitle string
	}{
		{
			name:      "title field is non-empty for /books/1",
			path:      "/books/1",
			wantTitle: "Python for Dummies",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			handler := internal.NewTestHandler(t)
			srv := httptest.NewServer(handler)
			defer srv.Close()

			req, err := http.NewRequest(http.MethodGet, srv.URL+tc.path, nil)
			require.NoError(t, err)

			resp, err := srv.Client().Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			require.Equal(t, http.StatusOK, resp.StatusCode)

			var raw map[string]interface{}
			require.NoError(t, json.NewDecoder(resp.Body).Decode(&raw))

			title, exists := raw["title"]
			assert.True(t, exists, "'title' key must be present in the response JSON")
			assert.Equal(t, tc.wantTitle, title,
				"'title' value must match the expected string")
		})
	}
}

// TestGetBook_ReadOnly validates the global invariant:
// "Retrieving an existing book by ID is a read-only operation with no
// observable state changes."
//
// We issue the same request twice and assert that both responses are identical,
// demonstrating idempotency / no state mutation.
func TestGetBook_ReadOnly(t *testing.T) {
	tests := []struct {
		name string
		path string
	}{
		{
			name: "repeated GET /books/1 produces identical results",
			path: "/books/1",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			handler := internal.NewTestHandler(t)
			srv := httptest.NewServer(handler)
			defer srv.Close()

			doRequest := func() bookResponse {
				req, err := http.NewRequest(http.MethodGet, srv.URL+tc.path, nil)
				require.NoError(t, err)

				resp, err := srv.Client().Do(req)
				require.NoError(t, err)
				defer resp.Body.Close()

				require.Equal(t, http.StatusOK, resp.StatusCode)

				var got bookResponse
				require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
				return got
			}

			first := doRequest()
			second := doRequest()

			assert.Equal(t, first, second,
				"repeated GET requests must return identical payloads (read-only invariant)")
		})
	}
}
```