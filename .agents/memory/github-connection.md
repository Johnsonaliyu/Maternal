---
name: GitHub connector availability
description: Replit GitHub integration authorization can remain unavailable after attachment.
---

The GitHub integration reported `attached: true` after `addIntegration`, but continued to report `status: connect`; the connected-integration query showed the same state. The repository remote existed, but Git had no configured credential helper and a sanitized `git push --dry-run` failed with an invalid username/token error. The in-chat connection prompt also failed validation.

**Why:** A linked repository or a successful attachment response does not guarantee that Agent has usable GitHub write authorization.

**How to apply:** Before pushing, confirm the GitHub connector is `ready` or verify another authorized write path. If it is not ready, stop rather than repeating the push or requesting credentials in chat.
