---
name: Orval request-body schema naming
description: Why importing a component-schema name for a request body/param from @workspace/api-zod can fail to compile.
---

When an OpenAPI path uses `requestBody`/`parameters` with a `$ref` to a component schema (e.g. `AlertInput`), Orval's Zod generator does NOT export a value named after that component schema for use in route handlers. Instead it derives the exported const name from the operation's `operationId` (e.g. `operationId: createAlert` -> exported const `CreateAlertBody`; a path param schema becomes `<OperationId>Params`, e.g. `DeleteAlertParams`).

The component schema name (`AlertInput`) still exists in `generated/types/*` but only as a TypeScript `interface`/`type`, not a runtime Zod value — importing it and calling `.parse()` on it fails with "only refers to a type, but is being used as a value" (TS2693).

**Why:** Orval's react-query/zod generators name request-body and param schemas by operation, mirroring the per-endpoint client function names, not by the referenced component schema.

**How to apply:** When writing an Express route handler after adding an OpenAPI path, grep the generated `lib/api-spec/src/generated/api.ts` (or equivalent zod output) for the actual exported const name tied to that operationId before importing from `@workspace/api-zod` — don't assume the component schema name is importable as a value.
