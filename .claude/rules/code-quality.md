---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,py,rb,go,rs,java,kt,cs,php,vue,svelte,sql}"
---

# Code quality

## Design

* Follow the framework's conventions and the existing local patterns before introducing a new structure.
* Prefer small, focused functions and modules. Split when a unit has multiple responsibilities, is difficult to test, or is difficult to read.
* Treat functions above approximately 40 lines and files above approximately 500 lines as review signals, not automatic violations.
* Keep one primary responsibility per module. Avoid god files.
* Prefer early returns and shallow control flow. Avoid deeply nested branches.

## Naming and types

* Use specific domain names. Avoid vague names such as `data`, `handler`, `manager`, or `utils` when a clearer name exists.
* Keep types explicit at public boundaries.
* Avoid untyped escapes such as `any`, broad dictionaries, and unchecked casts. When unavoidable, isolate and justify them.

## Duplication and errors

* Remove duplicated business logic.
* Extract shared code when repetition is real and the abstraction improves clarity. Do not abstract merely similar code prematurely.
* Error messages must include actionable context and the expected shape when useful.
* Never expose secrets, credentials, tokens, or personally identifiable information in errors or logs.

## Comments and documentation

* Preserve useful intent and provenance comments during refactors. Update or remove stale comments.
* Explain why, not obvious mechanics.
* Document public APIs and non-obvious domain behavior.
* Add usage examples when they clarify contracts, edge cases, or surprising behavior.
* Reference issue numbers or commit SHAs only when a line exists because of a specific bug or upstream constraint.

## Tests

* Test observable behavior and public contracts rather than private implementation details.
* Bug fixes require regression tests.
* Mock network, database, filesystem, and other external I/O.
* Prefer named fakes for reused or complex behavior. Inline stubs are acceptable for trivial one-off cases.
* Tests should be fast, independent, repeatable, self-validating, and timely.
* Use the project-specific commands documented in `docs/STACK.md`.

## Dependencies

* Inject side-effectful, replaceable, or externally controlled dependencies through parameters or constructors.
* Direct imports are acceptable for pure and stable utilities.
* Wrap third-party libraries when they are central, volatile, side-effectful, or expensive to replace or mock.
* Do not create wrappers around trivial stable utilities without a concrete reason.

## Structure and formatting

* Prefer predictable paths and small modules aligned with the framework.
* Use the formatter and linter configured by the project.
* Do not spend implementation time debating formatting already handled automatically.

## Logging

* Prefer structured logs for backend services and observability pipelines.
* Use plain text for human-facing CLI output.
* Never log secrets, credentials, authentication tokens, or personally identifiable information.
