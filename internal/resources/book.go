// Package resources implements the HTTP handlers for the Book API.
//
// The original source was a Flask-RESTPlus module that declared two Resource
// classes (BookList and Book) bound to routes via @api.route decorators and
// backed by an in-memory list (books_db). This file preserves that behavior:
//   - An in-memory, mutex-protected store replaces the module-level books_db list.
//   - Each Flask verb method becomes an http.HandlerFunc.
//   - Flask-RESTPlus @api.marshal_with / @api.marshal_list_with (which shape the
//     JSON response) are realized by encoding model.Book values as JSON.
//   - @api.expect(book, validate=True) becomes explicit JSON decoding plus
//     model.Book.Validate().
//
// buildRouter wires all routes onto a chi router so that the existing
// cmd/server/main.go entry point can serve the API.
package resources

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"internal/model"
)

// bookStore is an in-memory, concurrency-safe collection of books.
//
// MIGRATION_NOTE: The Python source used a bare module-level list (books_db)
// with no locking, which is unsafe under Flask's threaded server. The Go net/http
// server handles each request in its own goroutine, so access is guarded by a
// sync.Mutex here. This is a correctness improvement over the source, not a
// behavioral change to the API contract.
type bookStore struct {
	mu    sync.Mutex
	books []model.Book
}

// newBookStore returns a bookStore seeded with the same two entries as the
// original books_db list.
//
// MIGRATION_NOTE (G-review seedTitle2): the seed values below mirror the source
// exactly: id 0 = "War and Peace", id 1 = "Python for Dummies".
func newBookStore() *bookStore {
	return &bookStore{
		books: []model.Book{
			{ID: 0, Title: "War and Peace"},
			{ID: 1, Title: "Python for Dummies"},
		},
	}
}

// findIndex returns the slice index of the book with the given id, or -1 if no
// such book exists. Callers must hold s.mu.
func (s *bookStore) findIndex(id int) int {
	for i := range s.books {
		if s.books[i].ID == id {
			return i
		}
	}
	return -1
}

// list returns a copy of all books, mirroring BookList.get.
func (s *bookStore) list() []model.Book {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]model.Book, len(s.books))
	copy(out, s.books)
	return out
}

// create appends a new book, auto-assigning an id derived from the last book
// (last id + 1, or 0 when the store is empty), mirroring BookList.post.
func (s *bookStore) create(b model.Book) model.Book {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.books) > 0 {
		b.ID = s.books[len(s.books)-1].ID + 1
	} else {
		b.ID = 0
	}
	s.books = append(s.books, b)
	return b
}

// get returns the book with the given id and true, or the zero value and false
// if it does not exist, mirroring Book.find_one.
func (s *bookStore) get(id int) (model.Book, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := s.findIndex(id)
	if i < 0 {
		return model.Book{}, false
	}
	return s.books[i], true
}

// delete removes the book with the given id and returns it. The returned bool
// reports whether a book was found; when false the returned Book is the zero
// value, mirroring Book.delete returning the (possibly None) match.
func (s *bookStore) delete(id int) (model.Book, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := s.findIndex(id)
	if i < 0 {
		return model.Book{}, false
	}
	deleted := s.books[i]
	s.books = append(s.books[:i], s.books[i+1:]...)
	return deleted, true
}

// update applies the given payload to an existing book, forcing the id to remain
// unchanged, mirroring Book.put. It returns the updated book and true, or the
// zero value and false if no book with the id exists.
func (s *bookStore) update(id int, payload model.Book) (model.Book, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := s.findIndex(id)
	if i < 0 {
		return model.Book{}, false
	}
	payload.ID = id
	s.books[i] = payload
	return s.books[i], true
}

// BookResource holds the handler dependencies (the in-memory store) for the
// Book API endpoints. It replaces the Flask-RESTPlus BookList and Book Resource
// classes.
type BookResource struct {
	store *bookStore
}

// NewBookResource returns a BookResource backed by a freshly seeded in-memory
// store.
func NewBookResource() *BookResource {
	return &BookResource{store: newBookStore()}
}

// writeJSON encodes v as JSON to w with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes a plain error message with the given status code.
//
// MIGRATION_NOTE (G2 not-found shape): the Flask source returned the bare tuple
// ("Not found", 404) for a missing book. Flask-RESTPlus serializes that as the
// JSON string "Not found" with a 404 status. To preserve the response shape we
// emit the JSON string "Not found" for the GET-not-found case; see List/GetOne.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, msg)
}

// List handles GET /books and returns all books.
func (rsc *BookResource) List(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, rsc.store.list())
}

// Create handles POST /books. It decodes and validates the request body,
// auto-assigns an id, stores the new book, and returns it.
func (rsc *BookResource) Create(w http.ResponseWriter, r *http.Request) {
	var b model.Book
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		// MIGRATION_NOTE (writeMalformedJSON): Flask-RESTPlus rejects an
		// unparseable body with a 400. We do the same explicitly here.
		writeError(w, http.StatusBadRequest, "malformed JSON")
		return
	}
	if err := b.Validate(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	created := rsc.store.create(b)
	writeJSON(w, http.StatusOK, created)
}

// parseID extracts and parses the {id} URL parameter as an int.
func parseID(r *http.Request) (int, error) {
	raw := chi.URLParam(r, "id")
	id, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("invalid id %q: %w", raw, err)
	}
	return id, nil
}

// GetOne handles GET /books/{id}. It returns the matching book, or the string
// "Not found" with status 404 when no book has the given id.
func (rsc *BookResource) GetOne(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	b, ok := rsc.store.get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "Not found")
		return
	}
	writeJSON(w, http.StatusOK, b)
}

// Delete handles DELETE /books/{id}. It removes and returns the deleted book.
//
// MIGRATION_NOTE (deleteNotFound): the Flask source filtered books_db and
// returned the match, which is None when the id is absent — Flask-RESTPlus would
// marshal that into an empty/null body with a 200. To make the not-found case
// explicit and useful we return a 404 with "Not found" here; confirm whether
// clients depended on the original 200-with-null behavior.
func (rsc *BookResource) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	deleted, ok := rsc.store.delete(id)
	if !ok {
		writeError(w, http.StatusNotFound, "Not found")
		return
	}
	writeJSON(w, http.StatusOK, deleted)
}

// Update handles PUT /books/{id}. It validates the payload, applies it to the
// existing book (forcing the id to remain unchanged), and returns the result.
//
// MIGRATION_NOTE (putNotFound): the Flask source returned None when the id was
// absent (marshalled to an empty/null 200 body). We return a 404 with
// "Not found" instead to make the missing-resource case explicit; confirm
// whether clients relied on the original behavior.
func (rsc *BookResource) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var payload model.Book
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "malformed JSON")
		return
	}
	if err := payload.Validate(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	updated, ok := rsc.store.update(id, payload)
	if !ok {
		writeError(w, http.StatusNotFound, "Not found")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// RegisterRoutes mounts the Book API endpoints onto the given chi.Router.
func (rsc *BookResource) RegisterRoutes(r chi.Router) {
	r.Get("/books", rsc.List)
	r.Post("/books", rsc.Create)
	r.Get("/books/{id}", rsc.GetOne)
	r.Delete("/books/{id}", rsc.Delete)
	r.Put("/books/{id}", rsc.Update)
}

// buildRouter constructs the fully-wired HTTP handler for the application.
// It is called directly by cmd/server/main.go, so the name and signature must
// remain exactly func buildRouter() http.Handler.
func buildRouter() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "ok")
	})

	books := NewBookResource()
	books.RegisterRoutes(r)

	return r
}
