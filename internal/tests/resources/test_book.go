package resources_test

// This file migrates tests/resources/test_book.py, which verified that
// GET /books/1 returns HTTP 200 with the expected book JSON payload.
//
// The original test relied on a pytest `client` fixture (a Flask test client)
// and accessed the decoded body via `response.json`. In Go the idiomatic
// equivalent is to spin up the application handler with httptest, issue a
// real request, and decode the JSON response body explicitly.
//
// MIGRATION_NOTE: The Python test imported the resource module via a wildcard
// import (`from resources.book import *`) purely so that its route decorators
// registered the endpoints as a side effect. Go has no decorator-based route
// registration; routes are wired explicitly through
// resources.RegisterRoutes, which newTestHandler (internal/conftest.go)
// performs. We therefore call that shared helper instead of relying on any
// import side effect.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	internal "bookapi/internal"
)

// TestGetBook verifies that GET /books/1 responds with HTTP 200 and the
// expected book payload {"id": 1, "title": "Python for Dummies"}.
func TestGetBook(t *testing.T) {
	handler := internal.NewTestHandler(t)

	srv := httptest.NewServer(handler)
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/books/1", nil)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("performing request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status code = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var got struct {
		ID    int    `json:"id"`
		Title string `json:"title"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decoding response body: %v", err)
	}

	want := struct {
		ID    int
		Title string
	}{
		ID:    1,
		Title: "Python for Dummies",
	}

	if got.ID != want.ID {
		t.Errorf("id = %d, want %d", got.ID, want.ID)
	}
	if got.Title != want.Title {
		t.Errorf("title = %q, want %q", got.Title, want.Title)
	}
}
