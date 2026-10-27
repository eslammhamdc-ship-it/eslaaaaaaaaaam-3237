# Midway MVP
- Approved custom Arabic RTL web design, no templates or integrations.
- No pre-existing project. Managed template initialized; infrastructure inspected.
- Decision: local IndexedDB prototype to avoid exposing confidential uploads behind unauthenticated API; disclose browser-only persistence.
- Build Phase 1 first, then lightweight Phase 2 using shared dataset.
- Next: domain/repository, UI, verification of creation/status/attachment/filter/RTL/mobile/persistence, build and deliver.

## Completed and verified
- Phase 1: custom RTL dashboard, manual create/edit requests, lifecycle history, searchable/filterable/paginated requests, local document upload and preview.
- Phase 2: client CRUD with duplicate prevention, employee directory and workload comparison, report charts, financial summaries by currency, CSV export.
- Browser tests: employee creates attached request, manager sees it, completed status persists after reload, attachment persists/reads, company create succeeds.
- KPI reconciliation checked against IndexedDB records; statuses are exclusive; employee and empty-search filters update cards and charts.
- Desktop/tablet/mobile checks; mobile drawer/form; no viewport overflow or JS page errors.
- Production build and lint passed. Build notes bundle-size advisory only.
- Limitation: local browser IndexedDB only, no real authorization, no synchronized backend or live integrations; stated prominently in UI.
