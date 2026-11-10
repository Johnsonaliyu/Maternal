---
name: Baileys runtime dependencies
description: Runtime packaging constraints learned while wiring Baileys into the workspace API service.
---

When Baileys is bundled with the workspace server, runtime packages that the bundler externalizes must be direct dependencies of the API package, not only transitive workspace packages.

**Why:** The first server restart compiled successfully but failed at runtime because the externalized `protobufjs` package was not resolvable from the API package.

**How to apply:** When adding or upgrading Baileys, inspect the bundle's externalized runtime imports and declare each required package in `artifacts/api-server/package.json`; install with a package filter targeting that package.