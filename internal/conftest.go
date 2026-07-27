// Package internal provides shared test helpers for the Book API test suite.
//
// The original source was a pytest conftest.py that exposed a single `app`
// fixture returning the shared application instance (server.app). In Go there
// is no pytest fixture mechanism; the idiomatic equivalent is a helper
// constructor that each test calls (or passes to httptest.NewServer) to obtain
// a ready-to-use http.Handler backed by a freshly loaded environment.
//
// MIGRATION_NOTE: pytest's `app` fixture returned a *module-level singleton*
// (server.app was created once at import time and shared across tests). Sharing
// mutable state across Go tests is discouraged because `go test` may run tests
// in parallel and because the in-memory book store in internal/resources is
// mutable. newTestHandler therefore builds a fresh Server per call so each test
// starts from a clean, isolated state. If a test genuinely needs the shared
// singleton semantics of the original fixture, call it once in TestMain and
// reuse the returned handler.
package internal

import (
	"fmt"
	"net/http"

	"internal/environment"
	"internal/server"
)

// newTestHandler builds a fresh HTTP handler for the Book API, mirroring the
// pytest `app` fixture that exposed server.app to the test suite.
//
// It loads the environment configuration, constructs a new Server, and returns
// its http.Handler. Unlike the original module-level singleton, each call
// produces an isolated instance so tests do not share mutable state.
func newTestHandler() (http.Handler, error) {
	cfg, err := environment.Load()
	if err != nil {
		return nil, fmt.Errorf("loading test environment: %w", err)
	}

	srv, err := server.NewServer(cfg)
	if err != nil {
		return nil, fmt.Errorf("creating test server: %w", err)
	}

	return srv.Handler(), nil
}
