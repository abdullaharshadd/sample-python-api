// Package model defines the data structures exchanged by the Book API.
//
// The original source declared a Flask-RESTPlus API model (api.model('Book', ...))
// which served two purposes at once: runtime request/response (de)serialization
// and Swagger/OpenAPI schema documentation. In Go these concerns are split:
//   - The Book struct below (with json + validate tags) handles (de)serialization.
//   - Swagger schema generation is handled separately by the documentation tooling
//     wired up in the server package, so it is not re-declared here.
package model

import (
	"fmt"
	"strings"
)

// Field length constraints carried over from the Flask-RESTPlus model definition
// (title: min_length=1, max_length=200).
const (
	// TitleMinLength is the minimum allowed length of a Book title.
	TitleMinLength = 1
	// TitleMaxLength is the maximum allowed length of a Book title.
	TitleMaxLength = 200
)

// Book represents a book resource.
//
// It mirrors the Flask-RESTPlus 'Book' model:
//   - ID    <- fields.Integer(description='Id')
//   - Title <- fields.String(required=True, min_length=1, max_length=200)
//
// The `omitempty` on ID reproduces the source behaviour where the id field is
// optional on input and populated by the server on output.
type Book struct {
	// ID is the unique identifier of the book. It is assigned by the server on
	// creation and is optional/omitted on input.
	ID int `json:"id,omitempty"`
	// Title is the book title. It is required and must be between
	// TitleMinLength and TitleMaxLength characters long.
	Title string `json:"title"`
}

// Validate checks that the Book satisfies the constraints declared in the
// original Flask-RESTPlus model: the title is required and its length must fall
// within [TitleMinLength, TitleMaxLength].
//
// It returns an error describing the first constraint violation encountered, or
// nil if the Book is valid.
func (b Book) Validate() error {
	title := strings.TrimSpace(b.Title)
	if len(title) < TitleMinLength {
		return fmt.Errorf("title is required and must be at least %d character(s) long", TitleMinLength)
	}
	if len(b.Title) > TitleMaxLength {
		return fmt.Errorf("title must be at most %d characters long", TitleMaxLength)
	}
	return nil
}
