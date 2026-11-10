---
name: WhatsApp pairing reset
description: Baileys logout and manual pairing-reset behavior in the Materna service.
---

When resetting WhatsApp pairing, clear the auth directory and start a fresh socket, but ignore connection and message events from any socket that is no longer the active global socket.

**Why:** A deliberate logout can emit its close event after the replacement connection has already started. Without socket identity guards, both the reset path and the stale close handler reconnect and create competing QR sessions.

**How to apply:** Capture the socket created by each `connect()` call, compare it with the active socket at the start of event handlers, and suppress stale events before changing status or scheduling reconnects.