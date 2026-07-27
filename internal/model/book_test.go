```go
package model_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"internal/model"
)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

func TestConstants(t *testing.T) {
	assert.Equal(t, 1, model.TitleMinLength, "TitleMinLength should be 1")
	assert.Equal(t, 200, model.TitleMaxLength, "TitleMaxLength should be 200")
}

// ---------------------------------------------------------------------------
// Book struct – field presence and types
// ---------------------------------------------------------------------------

func TestBook_Fields(t *testing.T) {
	b := model.Book{ID: 42, Title: "Go Programming"}

	assert.Equal(t, 42, b.ID)
	assert.Equal(t, "Go Programming", b.Title)
}

// ---------------------------------------------------------------------------
// JSON serialisation
// ---------------------------------------------------------------------------

func TestBook_JSONMarshal(t *testing.T) {
	tests := []struct {
		name         string
		book         model.Book
		wantIDInJSON bool
		wantTitle    string
	}{
		{
			name:         "both id and title present",
			book:         model.Book{ID: 1, Title: "Clean Code"},
			wantIDInJSON: true,
			wantTitle:    "Clean Code",
		},
		{
			name:         "id omitted (zero value) – omitempty",
			book:         model.Book{Title: "The Pragmatic Programmer"},
			wantIDInJSON: false,
			wantTitle:    "The Pragmatic Programmer",
		},
		{
			name:         "id is non-zero integer",
			book:         model.Book{ID: 99, Title: "SICP"},
			wantIDInJSON: true,
			wantTitle:    "SICP",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.book)
			require.NoError(t, err)

			var result map[string]interface{}
			require.NoError(t, json.Unmarshal(data, &result))

			// title must always be present and be a string
			titleVal, ok := result["title"]
			require.True(t, ok, "title key must be present in JSON")
			assert.Equal(t, tc.wantTitle, titleVal)

			_, idPresent := result["id"]
			assert.Equal(t, tc.wantIDInJSON, idPresent,
				"id presence in JSON should match expectation (omitempty)")

			if tc.wantIDInJSON {
				// json.Unmarshal stores numbers as float64
				idVal, ok := result["id"].(float64)
				require.True(t, ok, "id must be numeric in JSON")
				assert.Equal(t, float64(tc.book.ID), idVal)
			}
		})
	}
}

func TestBook_JSONUnmarshal(t *testing.T) {
	tests := []struct {
		name     string
		raw      string
		wantBook model.Book
		wantErr  bool
	}{
		{
			name:     "full object with id and title",
			raw:      `{"id":7,"title":"Domain-Driven Design"}`,
			wantBook: model.Book{ID: 7, Title: "Domain-Driven Design"},
		},
		{
			name:     "object without id field",
			raw:      `{"title":"Refactoring"}`,
			wantBook: model.Book{ID: 0, Title: "Refactoring"},
		},
		{
			name:    "malformed JSON",
			raw:     `{"id":1,"title":}`,
			wantErr: true,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			var b model.Book
			err := json.Unmarshal([]byte(tc.raw), &b)
			if tc.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantBook.ID, b.ID)
			assert.Equal(t, tc.wantBook.Title, b.Title)
		})
	}
}

// ---------------------------------------------------------------------------
// Book.Validate
// ---------------------------------------------------------------------------

func TestBook_Validate(t *testing.T) {
	longTitle := strings.Repeat("a", 201)
	exactMaxTitle := strings.Repeat("a", 200)

	tests := []struct {
		name    string
		book    model.Book
		wantErr bool
		errMsg  string
	}{
		// --- valid cases ---
		{
			name:    "valid book with id and title",
			book:    model.Book{ID: 1, Title: "Go Programming"},
			wantErr: false,
		},
		{
			name:    "valid book without id",
			book:    model.Book{Title: "The Go Programming Language"},
			wantErr: false,
		},
		{
			name:    "title of exactly 1 character (min length boundary)",
			book:    model.Book{Title: "A"},
			wantErr: false,
		},
		{
			name:    "title of exactly 200 characters (max length boundary)",
			book:    model.Book{Title: exactMaxTitle},
			wantErr: false,
		},
		// --- error cases ---
		{
			name:    "empty title string – required",
			book:    model.Book{Title: ""},
			wantErr: true,
			errMsg:  "title is required",
		},
		{
			name:    "title is only whitespace – treated as missing",
			book:    model.Book{Title: "   "},
			wantErr: true,
			errMsg:  "title is required",
		},
		{
			name:    "title exceeds max length of 200",
			book:    model.Book{Title: longTitle},
			wantErr: true,
			errMsg:  "title must be at most 200 characters long",
		},
		{
			name:    "title of 201 characters – one over limit",
			book:    model.Book{Title: strings.Repeat("b", 201)},
			wantErr: true,
			errMsg:  "title must be at most 200 characters long",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			err := tc.book.Validate()
			if tc.wantErr {
				require.Error(t, err)
				if tc.errMsg != "" {
					assert.Contains(t, err.Error(), tc.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Invariants – exactly two JSON fields when both present
// ---------------------------------------------------------------------------

func TestBook_ExactlyTwoFields_WhenIDPresent(t *testing.T) {
	b := model.Book{ID: 5, Title: "Structure and Interpretation"}

	data, err := json.Marshal(b)
	require.NoError(t, err)

	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &result))

	assert.Len(t, result, 2, "JSON object must have exactly two keys when ID is non-zero")
	_, hasID := result["id"]
	_, hasTitle := result["title"]
	assert.True(t, hasID, "must have 'id' key")
	assert.True(t, hasTitle, "must have 'title' key")
}

func TestBook_ExactlyOneField_WhenIDOmitted(t *testing.T) {
	b := model.Book{Title: "Effective Go"}

	data, err := json.Marshal(b)
	require.NoError(t, err)

	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &result))

	assert.Len(t, result, 1, "JSON object must have exactly one key when ID is zero (omitempty)")
	_, hasTitle := result["title"]
	assert.True(t, hasTitle, "must have 'title' key")
}

// ---------------------------------------------------------------------------
// Validate – error messages reference the actual constraint values
// ---------------------------------------------------------------------------

func TestBook_Validate_ErrorMessages(t *testing.T) {
	t.Run("min length error mentions TitleMinLength", func(t *testing.T) {
		b := model.Book{Title: ""}
		err := b.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "1",
			"error message should reference TitleMinLength (%d)", model.TitleMinLength)
	})

	t.Run("max length error mentions TitleMaxLength", func(t *testing.T) {
		b := model.Book{Title: strings.Repeat("x", 201)}
		err := b.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "200",
			"error message should reference TitleMaxLength (%d)", model.TitleMaxLength)
	})
}
```