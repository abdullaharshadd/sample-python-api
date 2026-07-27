# Migration Notes

**Overall confidence:** 0%  
**Recommendation:** REVIEW RECOMMENDED

---

## What was migrated

- `src/environment/instance.py` → `internal/environment/instance.go` (66% confidence) ⚠️ needs review
- `src/server/instance.py` → `internal/server/instance.go` (78% confidence) ⚠️ needs review
- `src/models/book.py` → `internal/model/book.go` (78% confidence) ⚠️ needs review
- `src/resources/book.py` → `internal/resources/book.go` (61% confidence) ⚠️ needs review
- `conftest.py` → `internal/conftest.go` (78% confidence) ⚠️ needs review
- `src/main.py` → `internal/main/main.go` (20% confidence) ⚠️ needs review
- `tests/resources/test_book.py` → `internal/tests/resources/test_book.go` (82% confidence) ⚠️ needs review
## Observer agent findings

The Observer agent monitored the migration and identified these patterns:

- **After 3 modules:** Could not parse observer output
- **After 6 modules:** Could not parse observer output

## Files requiring manual review

These files were migrated but scored below the confidence threshold.
Review them carefully before merging.

### `src/environment/instance.py`
Confidence: 66%
Issues:
  - [warning] The Target Expert correctly diagnosed the divergence and proposed the right fix (removing the `&& v != ""` guard to match os.environ.get semantics), but the response is an explanation of an intended change, not confirmation that the code was actually updated. Until the `&& v != ""` guard is removed in the committed code, the divergence remains.

### `src/server/instance.py`
Confidence: 78%
Issues:
  - [info] The Target Expert concedes the concern but has not actually applied the fix; the misleading MIGRATION_NOTE claiming cfg.Debug 'affects logging/behavior at the application level' still stands as written since only a proposed replacement was offered.

### `src/models/book.py`
Confidence: 78%
Issues:
  - [info] Flask-RESTPlus measures string length in Unicode code points (Python len(str)), but the fixed Go code uses len(b.Title) which counts bytes. A multi-byte title could be accepted by Python but rejected by Go (or vice versa) at the 200-char boundary.

### `src/resources/book.py`
Confidence: 61%
Issues:
  - [warning] The original returns the (possibly None) match with HTTP 200 even when the book does not exist (the filter is a no-op and marshalling None yields a null/empty 200 body). The migration returns 404 'Not found' for the not-found case, changing the observable status code and body.
  - [warning] The original returns None (null/empty 200 body) when the id does not exist. The migration returns 404 'Not found', changing the observable status code for the missing-resource case.

### `conftest.py`
Confidence: 78%

### `src/main.py`
Confidence: 20%
Issues:
  - [critical] The migration fabricated a route-registration contract (srv.Handler() type-asserted to chi.Router, then resources.RegisterRoutes(router)) without verifying the real signatures of the already-migrated server and resources packages. The Target Expert concedes this is a guess and that it may be entirely redundant or wrong.
  - [warning] Route registration is startup-deterministic; the type-assertion-with-error helper turns a build-time programming error into a runtime error return. Still present in the current code pending the fix.
  - [info] The var _ http.Handler = (chi.Router)(nil) line and manufactured net/http import add nothing and exist only to justify an import; still present pending the fix.

### `tests/resources/test_book.py`
Confidence: 82%
