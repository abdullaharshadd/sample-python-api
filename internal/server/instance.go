// Package server provides the HTTP server initialization for the Book API.
// It wires together the environment configuration, an HTTP router, and
// (optionally) Swagger/OpenAPI documentation, mirroring the original Flask +
// Flask-RESTPlus application factory.
package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"internal/environment"
)

// API metadata that mirrors the Flask-RESTPlus Api(...) configuration.
const (
	// APIVersion is the version reported by the API documentation.
	APIVersion = "1.0"
	// APITitle is the human-readable title of the API.
	APITitle = "Sample Book API"
	// APIDescription is a short description of the API.
	APIDescription = "A simple Book API"
)

// Server bundles the HTTP router and the environment configuration required to
// run the Book API. Construct it with NewServer.
type Server struct {
	router *chi.Mux
	cfg    *environment.Config
}

// NewServer builds a Server from the given environment configuration. It sets
// up the router, common middleware, and the Swagger documentation endpoint if
// one is configured. It returns an error if the configuration is nil.
//
// MIGRATION_NOTE: The original file relied on a module-level singleton
// (`server = Server()`) created at import time. Idiomatic Go avoids package
// initialization side effects, so construction is explicit via NewServer and
// the caller (cmd/server/main.go) owns the lifecycle.
func NewServer(cfg *environment.Config) (*Server, error) {
	if cfg == nil {
		return nil, fmt.Errorf("server: nil environment config")
	}

	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Recoverer)

	s := &Server{
		router: router,
		cfg:    cfg,
	}

	s.registerRoutes()
	return s, nil
}

// registerRoutes wires up the API's routes. The original file defined no
// concrete handler routes here (they lived in separate Flask-RESTPlus
// Resources); only the Swagger documentation endpoint is derived from this
// file's configuration.
//
// MIGRATION_NOTE: Flask-RESTPlus auto-generates a Swagger UI at the configured
// doc path. There is no direct Go equivalent bundled here; if Swagger docs are
// required, mount a generated OpenAPI spec (e.g. via swaggo/http-swagger) at
// cfg.SwaggerURL. When SwaggerURL is empty, docs are disabled (matching the
// Flask behavior of passing doc=False/empty).
func (s *Server) registerRoutes() {
	if s.cfg.SwaggerURL != "" {
		s.router.Get(s.cfg.SwaggerURL, s.swaggerInfoHandler)
	}
}

// swaggerInfoHandler serves basic API metadata at the configured Swagger URL.
// It is a placeholder for a full OpenAPI document; see the MIGRATION_NOTE on
// registerRoutes.
func (s *Server) swaggerInfoHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"title":%q,"version":%q,"description":%q}`,
		APITitle, APIVersion, APIDescription)
}

// Handler exposes the configured router so callers can mount it onto an
// http.Server. Returning the interface keeps the concrete router type internal.
func (s *Server) Handler() http.Handler {
	return s.router
}

// Run starts the HTTP server on the configured port and blocks until the
// provided context is cancelled, then performs a graceful shutdown. It returns
// any error encountered while serving (other than http.ErrServerClosed) or
// during shutdown.
//
// MIGRATION_NOTE: The Flask `debug` flag has no direct net/http analogue.
// cfg.Debug is preserved on the config but only affects logging/behavior at
// the application level; it does not enable an auto-reloader here.
func (s *Server) Run(ctx context.Context) error {
	addr := ":" + s.cfg.Port

	httpServer := &http.Server{
		Addr:              addr,
		Handler:           s.router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- fmt.Errorf("server: listen and serve: %w", err)
			return
		}
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutCtx); err != nil {
			return fmt.Errorf("server: graceful shutdown: %w", err)
		}
		return nil
	}
}
