// Package main is the entry point for the Book API server.
//
// The original source (src/main.py) was a Flask/Flask-RESTPlus bootstrap module.
// Its entire job was to:
//   1. Import the shared server instance (server.instance.server).
//   2. Perform a wildcard import of resources.book purely for its side effect of
//      registering the Book routes on the server via @api.route decorators.
//   3. Under the __main__ guard, call server.run() to start serving HTTP.
//
// In Go there is no import-for-side-effect route registration; route wiring is
// explicit. So instead of relying on package-level decorator magic, this file:
//   - Loads configuration via environment.Load.
//   - Constructs the server via server.NewServer.
//   - Explicitly registers the Book routes via resources.RegisterRoutes on the
//     server's HTTP handler (replacing the Python wildcard-import side effect).
//   - Runs the server, propagating a cancellable context for graceful shutdown.
//
// MIGRATION_NOTE: The Python __main__ guard has no Go equivalent — Go binaries
// are invoked through func main directly, so the guard is simply dropped.
//
// MIGRATION_NOTE: The debate flagged confirming there are no additional
// middleware/error handlers affecting response shapes. The source contained
// none (only the wildcard resource import), so none are added here; all
// response shaping lives in internal/resources/book.go.
//
// MIGRATION_NOTE: This file assumes the exact signatures of the already-migrated
// symbols:
//   - environment.Load() (*environment.Config, error)
//   - server.NewServer(*environment.Config) (*server.Server, error)
//   - (*server.Server).Handler() http.Handler
//   - (*server.Server).Run(context.Context) error
//   - resources.RegisterRoutes(chi.Router) or an http-mux-compatible target
// If any of these differ (e.g. Handler returns a concrete *chi.Mux, or
// RegisterRoutes takes a different type), adjust the wiring below accordingly.
package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"migrated-app/internal/environment"
	"migrated-app/internal/resources"
	"migrated-app/internal/server"
)

func main() {
	if err := run(); err != nil {
		log.Error().Err(err).Msg("server exited with error")
		os.Exit(1)
	}
}

// run bootstraps and runs the Book API server, returning any fatal error.
//
// It is separated from main so that all error paths can be handled explicitly
// (returning error rather than calling os.Exit or panicking), which keeps the
// logic testable and idiomatic.
func run() error {
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	// Establish a context that is cancelled on SIGINT/SIGTERM so the server can
	// shut down gracefully. The original Flask server.run() had no explicit
	// signal handling; this is an idiomatic Go improvement.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Load configuration (replaces implicit Flask app config).
	cfg, err := environment.Load()
	if err != nil {
		return err
	}

	// Construct the shared server instance (replaces server.instance.server).
	srv, err := server.NewServer(cfg)
	if err != nil {
		return err
	}

	// Explicitly register the Book routes. This replaces the Python
	// `from resources.book import *` wildcard import whose sole purpose was to
	// trigger route registration as an import side effect.
	//
	// MIGRATION_NOTE: RegisterRoutes is expected to accept a chi.Router. The
	// server exposes its underlying handler via Handler(); we assert it to a
	// chi.Router to attach the routes. If server.Handler() already has the Book
	// routes registered internally, this block is redundant and should be
	// removed — but per the source, registration was the responsibility of this
	// entry point, so it is performed explicitly here.
	if err := registerRoutes(srv); err != nil {
		return err
	}

	log.Info().Msg("starting Book API server")
	return srv.Run(ctx)
}

// registerRoutes wires the Book resource routes onto the server's HTTP handler.
//
// It isolates the type assertion on the server's handler so that a mismatch
// between the handler's concrete type and what resources.RegisterRoutes expects
// surfaces as a clear, explicit error rather than a panic.
func registerRoutes(srv *server.Server) error {
	h := srv.Handler()

	router, ok := h.(chi.Router)
	if !ok {
		return errors.New("server handler is not a chi.Router; cannot register Book routes (see MIGRATION_NOTE in internal/main.go)")
	}

	resources.RegisterRoutes(router)
	return nil
}

// ensure the net/http import is retained for callers that reference the handler
// type in adjustments; kept explicit to document the handler contract.
var _ http.Handler = (chi.Router)(nil)
