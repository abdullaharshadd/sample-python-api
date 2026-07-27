```go
package resources

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"internal/model"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// newRouter wires a fresh BookResource onto a chi router and returns both.
func newRouter() (*BookResource, chi.Router) {
	rsc := NewBookResource()
	r := chi.NewRouter()
	rsc.RegisterRoutes(r)
	return rsc, r
}

// do fires req against handler and returns the recorder.
func do(handler http.Handler, req *http.Request) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr
}

// decodeBook unmarshals a single Book from the recorder body.
func decodeBook(t *testing.T, rr *httptest.ResponseRecorder) model.Book {
	t.Helper()
	var b model.Book
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&b))
	return b
}

// decodeBooks unmarshals a slice of Book from the recorder body.
func decodeBooks(t *testing.T, rr *httptest.ResponseRecorder) []model.Book {
	t.Helper()
	var books []model.Book
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&books))
	return books
}

// decodeString unmarshals a JSON-encoded string from the recorder body.
func decodeString(t *testing.T, rr *httptest.ResponseRecorder) string {
	t.Helper()
	var s string
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&s))
	return s
}

// jsonBody returns a *bytes.Buffer containing the JSON encoding of v.
func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return bytes.NewBuffer(b)
}

// ---------------------------------------------------------------------------
// bookStore unit tests
// ---------------------------------------------------------------------------

func TestBookStore_List(t *testing.T) {
	tests := []struct {
		name     string
		seed     []model.Book
		wantLen  int
		wantIDs  []int
	}{
		{
			name:    "seeded store returns all books",
			seed:    []model.Book{{ID: 0, Title: "War and Peace"}, {ID: 1, Title: "Python for Dummies"}},
			wantLen: 2,
			wantIDs: []int{0, 1},
		},
		{
			name:    "empty store returns empty slice",
			seed:    []model.Book{},
			wantLen: 0,
			wantIDs: []int{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := &bookStore{books: tc.seed}
			got := s.list()
			assert.Len(t, got, tc.wantLen)
			for i, id := range tc.wantIDs {
				assert.Equal(t, id, got[i].ID)
			}
		})
	}
}

func TestBookStore_Create(t *testing.T) {
	tests := []struct {
		name    string
		seed    []model.Book
		input   model.Book
		wantID  int
	}{
		{
			name:   "non-empty store: id = last id + 1",
			seed:   []model.Book{{ID: 0, Title: "A"}, {ID: 1, Title: "B"}},
			input:  model.Book{Title: "C"},
			wantID: 2,
		},
		{
			name:   "empty store: id = 0",
			seed:   []model.Book{},
			input:  model.Book{Title: "First"},
			wantID: 0,
		},
		{
			name:   "client-provided id is ignored",
			seed:   []model.Book{{ID: 5, Title: "X"}},
			input:  model.Book{ID: 999, Title: "New"},
			wantID: 6,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := &bookStore{books: tc.seed}
			got := s.create(tc.input)
			assert.Equal(t, tc.wantID, got.ID)
			assert.Equal(t, tc.input.Title, got.Title)
			// verify it was appended
			all := s.list()
			assert.Equal(t, got, all[len(all)-1])
		})
	}
}

func TestBookStore_Get(t *testing.T) {
	seed := []model.Book{{ID: 0, Title: "War and Peace"}, {ID: 1, Title: "Python for Dummies"}}

	tests := []struct {
		name   string
		id     int
		wantOK bool
		wantID int
	}{
		{"existing id 0", 0, true, 0},
		{"existing id 1", 1, true, 1},
		{"non-existing id", 99, false, 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := &bookStore{books: seed}
			b, ok := s.get(tc.id)
			assert.Equal(t, tc.wantOK, ok)
			if tc.wantOK {
				assert.Equal(t, tc.wantID, b.ID)
			}
		})
	}
}

func TestBookStore_Delete(t *testing.T) {
	tests := []struct {
		name        string
		seed        []model.Book
		id          int
		wantOK      bool
		wantDeleted model.Book
		wantLen     int
	}{
		{
			name:        "existing book is removed and returned",
			seed:        []model.Book{{ID: 0, Title: "A"}, {ID: 1, Title: "B"}},
			id:          0,
			wantOK:      true,
			wantDeleted: model.Book{ID: 0, Title: "A"},
			wantLen:     1,
		},
		{
			name:    "non-existing book returns false",
			seed:    []model.Book{{ID: 0, Title: "A"}},
			id:      99,
			wantOK:  false,
			wantLen: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := &bookStore{books: make([]model.Book, len(tc.seed))}
			copy(s.books, tc.seed)
			got, ok := s.delete(tc.id)
			assert.Equal(t, tc.wantOK, ok)
			if tc.wantOK {
				assert.Equal(t, tc.wantDeleted, got)
			}
			assert.Len(t, s.list(), tc.wantLen)
			// confirm id no longer present
			_, stillThere := s.get(tc.id)
			if tc.wantOK {
				assert.False(t, stillThere)
			}
		})
	}
}

func TestBookStore_Update(t *testing.T) {
	tests := []struct {
		name        string
		seed        []model.Book
		id          int
		payload     model.Book
		wantOK      bool
		wantUpdated model.Book
	}{
		{
			name:        "existing book is updated; id preserved",
			seed:        []model.Book{{ID: 0, Title: "Old Title"}},
			id:          0,
			payload:     model.Book{ID: 999, Title: "New Title"},
			wantOK:      true,
			wantUpdated: model.Book{ID: 0, Title: "New Title"},
		},
		{
			name:    "non-existing id returns false",
			seed:    []model.Book{{ID: 0, Title: "A"}},
			id:      42,
			payload: model.Book{Title: "X"},
			wantOK:  false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := &bookStore{books: make([]model.Book, len(tc.seed))}
			copy(s.books, tc.seed)
			got, ok := s.update(tc.id, tc.payload)
			assert.Equal(t, tc.wantOK, ok)
			if tc.wantOK {
				assert.Equal(t, tc.wantUpdated, got)
				// verify persisted
				stored, _ := s.get(tc.id)
				assert.Equal(t, tc.wantUpdated, stored)
			}
		})
	}
}

func TestBookStore_FindIndex(t *testing.T) {
	s := &bookStore{books: []model.Book{{ID: 10, Title: "A"}, {ID: 20, Title: "B"}}}

	tests := []struct {
		id   int
		want int
	}{
		{10, 0},
		{20, 1},
		{99, -1},
	}

	for _, tc := range tests {
		got := s.findIndex(tc.id)
		assert.Equal(t, tc.want, got)
	}
}

// ---------------------------------------------------------------------------
// HTTP handler tests – BookList.get  (GET /books)
// ---------------------------------------------------------------------------

func TestList(t *testing.T) {
	tests := []struct {
		name       string
		setupStore func(*bookStore)
		wantStatus int
		wantLen    int
		wantIDs    []int
	}{
		{
			name:       "default seeded store returns two books",
			setupStore: nil, // use NewBookResource defaults
			wantStatus: http.StatusOK,
			wantLen:    2,
			wantIDs:    []int{0, 1},
		},
		{
			name: "empty store returns empty list",
			setupStore: func(s *bookStore) {
				s.books = []model.Book{}
			},
			wantStatus: http.StatusOK,
			wantLen:    0,
			wantIDs:    []int{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rsc, r := newRouter()
			if tc.setupStore != nil {
				tc.setupStore(rsc.store)
			}

			req := httptest.NewRequest(http.MethodGet, "/books", nil)
			rr := do(r, req)

			assert.Equal(t, tc.wantStatus, rr.Code)
			assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))

			books := decodeBooks(t, rr)
			assert.Len(t, books, tc.wantLen)
			for i, id := range tc.wantIDs {
				assert.Equal(t, id, books[i].ID)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// HTTP handler tests – BookList.post  (POST /books)
// ---------------------------------------------------------------------------

func TestCreate(t *testing.T) {
	tests := []struct {
		name        string
		setupStore  func(*bookStore)
		body        any
		rawBody     string
		useRawBody  bool
		wantStatus  int
		wantID      int
		wantTitle   string
		wantErrBody bool
	}{
		{
			name:       "valid payload on non-empty store: id = last id + 1",
			wantStatus: http.StatusOK,
			body:       model.Book{Title: "New Book"},
			wantID:     2, // seeded last id is 1
			wantTitle:  "New Book",
		},
		{
			name: "valid payload on empty store: id = 0",
			setupStore: func(s *bookStore) {
				s.books = []model.Book{}
			},
			wantStatus: http.StatusOK,
			body:       model.Book{Title: "First Book"},
			wantID:     0,
			wantTitle:  "First Book",
		},
		{
			name:        "client-provided id is ignored",
			wantStatus:  http.StatusOK,
			body:        model.Book{ID: 999, Title: "Override Test"},
			wantID:      2,
			wantTitle:   "Override Test",
		},
		{
			name:        "malformed JSON returns 400",
			useRawBody:  true,
			rawBody:     `{bad json`,
			wantStatus:  http.StatusBadRequest,
			wantErrBody: true,
		},
		{
			name:        "invalid payload (empty title) returns 400",
			wantStatus:  http.StatusBadRequest,
			body:        model.Book{Title: ""},
			wantErrBody: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rsc, r := newRouter()
			if tc.setupStore != nil {
				tc.setupStore(rsc.store)
			}

			var buf *bytes.Buffer
			if tc.useRawBody {
				buf = bytes.NewBufferString(tc.rawBody)
			} else {
				buf = jsonBody(t, tc.body)
			}

			req := httptest.NewRequest(http.MethodPost, "/books", buf)
			req.Header.Set("Content-Type", "application/json")
			rr := do(r, req)

			assert.Equal(t, tc.wantStatus, rr.Code)
			assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))

			if !tc.wantErrBody {
				b := decodeBook(t, rr)
				assert.Equal(t, tc.wantID, b.ID)
				assert.Equal(t, tc.wantTitle, b.Title)
				// verify persisted
				stored, ok := rsc.store.get(b.ID)
				assert.True(t, ok)
				assert.Equal(t, b, stored)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// HTTP handler tests – Book.get  (GET /books/{id})
// ---------------------------------------------------------------------------

func TestGetOne(t *testing.T) {
	tests := []struct {
		name        string
		urlPath     string
		wantStatus  int
		wantID      int
		wantTitle   string
		wantErrBody bool
		wantErrMsg  string
	}{
		{
			name:       "existing id 0 returns book",
			urlPath:    "/books/0",
			wantStatus: http.StatusOK,
			wantID:     0,
			wantTitle:  "War and Peace",
		},
		{
			name:       "existing id 1 returns book",
			urlPath:    "/books/1",
			wantStatus: http.StatusOK,
			wantID:     1,
			wantTitle:  "Python for Dummies",
		},
		{
			name:        "non-existing id returns 404 with Not found",
			urlPath:     "/books/99",
			wantStatus:  http.StatusNotFound,
			wantErrBody: true,
			wantErrMsg:  "Not found",
		},
		{
			name:        "non-integer id returns 400",
			url