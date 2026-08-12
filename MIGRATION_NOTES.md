# Migration Notes

**Overall confidence:** 0%  
**Recommendation:** REVIEW RECOMMENDED

---

## What was migrated

- `src/environment/instance.py` → `src/src/environment/instance.ts` (78% confidence) ⚠️ needs review
- `src/server/instance.py` → `src/src/server/instance.ts` (78% confidence) ⚠️ needs review
- `conftest.py` → `src/conftest.ts` (70% confidence) ⚠️ needs review
- `src/models/book.py` → `src/src/models/book.ts` (78% confidence) ⚠️ needs review
- `src/resources/book.py` → `src/src/resources/book.ts` (78% confidence) ⚠️ needs review
- `src/main.py` → `src/src/main.ts` (76% confidence) ⚠️ needs review
- `tests/resources/test_book.py` → `src/tests/resources/test_book.ts` (92% confidence)

## Components that could not be automatically migrated

These components require manual implementation. The migrated code contains
`MIGRATION_NOTE` comments at the relevant locations.

### `Server.run` in `src/server/instance.py`
**Reason:** Flask's built-in development server (app.run) has no direct Django equivalent; Django uses manage.py runserver for development and a WSGI/ASGI server for production.
**Suggestion:** Do not port this method. Configure a Django project with wsgi.py/asgi.py and use runserver or gunicorn/uvicorn. Move port/debug config into Django settings and deployment configuration.

### `Server (Flask-RESTPlus Api wrapper)` in `src/server/instance.py`
**Reason:** Flask-RESTPlus Api object and its Swagger auto-documentation model are Flask-specific and do not translate 1:1 to Django.
**Suggestion:** Replace with Django REST Framework and add drf-spectacular or drf-yasg for OpenAPI/Swagger docs. Set title/version/description in the schema configuration within settings.py. Alternatively, if a faster/async framework is desired, consider FastAPI which has built-in Swagger and a closer conceptual match to Flask-RESTPlus.

### `server.run() bootstrap` in `src/main.py`
**Reason:** The concept of a single-file server.run() entrypoint does not map 1:1 to Django, which uses wsgi.py/asgi.py plus manage.py and urls.py for routing and startup.
**Suggestion:** Manually recreate the entrypoint using the target framework's conventions (e.g., FastAPI app + uvicorn, or Django wsgi.py/asgi.py) and register resource routers explicitly instead of relying on wildcard side-effect imports.

## Observer agent findings

The Observer agent monitored the migration and identified these patterns:

- **After 3 modules:** Could not parse observer output
- **After 6 modules:** Could not parse observer output

## Files requiring manual review

These files were migrated but scored below the confidence threshold.
Review them carefully before merging.

### `src/environment/instance.py`
Confidence: 78%

### `src/server/instance.py`
Confidence: 78%

### `conftest.py`
Confidence: 70%

### `src/models/book.py`
Confidence: 78%

### `src/resources/book.py`
Confidence: 78%
Issues:
  - [info] Source returns bare string 'Not found', migration returns JSON { error: 'Not found' }. Status code is preserved but the response body differs. The expert acknowledges this as an intentional normalization rather than a fix.

### `src/main.py`
Confidence: 76%
