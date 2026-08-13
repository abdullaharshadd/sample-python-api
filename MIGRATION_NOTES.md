# Migration Notes

**Overall confidence:** 0%  
**Recommendation:** REVIEW RECOMMENDED

---

## What was migrated

- `src/environment/instance.py` → `src/src/environment/instance.ts` (70% confidence) ⚠️ needs review
- `src/server/instance.py` → `src/src/server/instance.ts` (78% confidence) ⚠️ needs review
- `conftest.py` → `src/conftest.ts` (49% confidence) ⚠️ needs review
- `src/models/book.py` → `src/src/models/book.ts` (82% confidence) ⚠️ needs review
- `src/resources/book.py` → `src/src/resources/book.ts` (56% confidence) ⚠️ needs review
- `src/main.py` → `src/src/main.ts` (58% confidence) ⚠️ needs review
- `tests/resources/test_book.py` → `src/tests/resources/test_book.ts` (85% confidence) ⚠️ needs review

## Components that could not be automatically migrated

These components require manual implementation. The migrated code contains
`MIGRATION_NOTE` comments at the relevant locations.

### `Api (flask_restplus)` in `src/server/instance.py`
**Reason:** flask_restplus is Flask-specific and deprecated/unmaintained; its Api/Resource/Swagger abstractions have no 1:1 equivalent in Django.
**Suggestion:** In Django, use Django REST Framework with routers/viewsets and drf-spectacular (or drf-yasg) for Swagger/OpenAPI docs. In FastAPI, use built-in OpenAPI. If staying in Flask, migrate to flask-restx.

### `Server.run` in `src/server/instance.py`
**Reason:** Uses Flask's built-in development server which does not exist in Django (Django uses manage.py runserver / WSGI/ASGI).
**Suggestion:** Replace with the target framework's runtime: Django's manage.py/wsgi.py+asgi.py served by gunicorn/uvicorn, driven by settings and env vars for debug/port.

### `from resources.book import *` in `src/main.py`
**Reason:** Wildcard import relies on module-level side effects (route/resource registration). The actual routes and business logic live in resources/book.py, not in this file, so this file alone cannot be fully migrated without that module.
**Suggestion:** Migrate resources/book.py separately and replace implicit wildcard registration with explicit route/controller registration in the target framework.

### `server (server.instance)` in `src/main.py`
**Reason:** The server instance's configuration and framework binding are defined in an external module and are not visible here.
**Suggestion:** Analyze and migrate server/instance.py to reconstruct the app initialization and run configuration in the target stack.

## Observer agent findings

The Observer agent monitored the migration and identified these patterns:

- **After 3 modules:** Could not parse observer output
- **After 6 modules:** Could not parse observer output

## Files requiring manual review

These files were migrated but scored below the confidence threshold.
Review them carefully before merging.

### `src/environment/instance.py`
Confidence: 70%
Issues:
  - [info] The migrated ternary silently defaults any non-'production' value (including 'test') to development, whereas the original dict lookup raises KeyError on unknown envs. The Target Expert correctly diagnosed this and proposed a fail-loud fix, but the code has not actually been changed yet, and the MIGRATION_NOTE still inaccurately claims intentional two-branch parity.
  - [info] Number(config.PORT) unconditionally coerces to number, changing the type from the original string-in-common-case and introducing a silent-NaN path if PORT is a Zod string. The Expert conceded this and outlined conditional fixes, but the resolution is explicitly deferred pending a read of config.ts, so nothing is fixed yet.

### `src/server/instance.py`
Confidence: 78%

### `conftest.py`
Confidence: 49%
Issues:
  - [warning] The type of server.app in ./src/server/instance remains unverified. The Application return annotation is an unchecked assertion; if instance.ts types server (or server.app) loosely, an http.Server or wrapper mismatch would compile silently and break supertest semantics.

### `src/models/book.py`
Confidence: 82%
Issues:
  - [warning] The Target Expert concedes the issue and describes the exact fix, but the response is a proposed change, not confirmed applied code. The expert previously agreed but failed to actually change the code, so the deletion should be verified in the file.

### `src/resources/book.py`
Confidence: 56%
Issues:
  - [warning] The Expert conceded the deviation and provided a correct fix, but did not confirm the fix was actually applied to src/resources/book.py. The analysis is sound (routing-layer 404, precedence before validation), yet the reviewed code still shows the 200 marshalled-null branches.

### `src/main.py`
Confidence: 58%
Issues:
  - [critical] The Python code registered book routes via the import side-effect of `from resources.book import *`. The TS version drops this import on the unverified assumption that `instance.ts` mounts the book router. If it does not, every book endpoint silently 404s with no error.
  - [info] Python's `server.run()` used Flask's implicit default port 5000; the TS code passes `environmentConfig.port` explicitly, which may resolve to a different default (e.g. 3000), causing a silent behavioral regression.

### `tests/resources/test_book.py`
Confidence: 85%
