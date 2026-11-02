# User stories and acceptance criteria

## Goal

Make a free, polished diagramming starter that can be reused like other Pure templates: easy for a person to open, edit, share and export, and reliable for an AI to update without destroying human work. The diagram should be a useful project artifact, not an exercise in running a development environment.

**Non-goals for the first version:** Real-time multiplayer, accounts, a hosted database, paid services, an embedded AI agent, or a general-purpose design suite. Reading or editing a diagram must not depend on these services.

## End-to-end workflows

Build and review one complete workflow at a time, using React Flow's built-in capabilities and native JSON format. These priorities define the target workflows, not their current implementation status.

### P0 — Local authoring

P0 covers editing, starting a project, creating a diagram and AI edits. Each workflow ends with source saved in the repository, checked in a local preview and ready to commit or push. Pushing source does not require publishing.

1. **Edit and save:** Clone the repository → run locally → select the diagram JSON in the project → edit visually → Save overwrites that file → reopen it and verify the result → review the Git diff → commit or push the source.
2. **Start a new project:** Use the template → clone → change the project identity and example diagram → build and run locally → verify the local preview → commit or push the project.
3. **Create a diagram:** Open the local editor → start a blank diagram → add, label, connect and arrange nodes → save to the project's diagram JSON → close and reopen it with the same content and layout → commit or push the source.
4. **Make an AI change:** Give an AI the repository and a prompt → it edits the same diagram JSON while preserving human decisions → builds, renders and visually inspects the local result → you review the diagram and Git diff → commit or push the source.

### P1 — Publishing, sharing and extended recovery

Publishing waits for the materializer. It will consume the project's built site artifact; building the project or pushing source does not publish anything by itself.

1. **Publish the project site:** Commit and push the source → the materializer selects and builds the pinned project revision → the publishing stage deploys the full site → verify the GitHub Pages link against that revision.
2. **View a shared diagram:** Open the published link → the complete diagram fits the browser → pan, zoom and read without installing tools or signing in.
3. **Share a standalone viewer:** Export HTML → send the file → the recipient opens it directly in a browser → views and navigates the diagram without a server or account.
4. **Use a diagram in a document:** Export Image → get a crisp image of the whole diagram → include it in a document or presentation.
5. **Recover earlier work:** Undo or redo while editing; for a saved revision, restore the diagram JSON from Git → open it with the same content and layout → commit or push the restored source. Republishing is a separate materializer workflow.
6. **Embed an interactive diagram:** Publish the diagram through the materializer → copy its embed code → paste it into an existing webpage → publish that page → visitors view, pan and zoom within it. Republishing the source diagram updates the embedded view at the same URL.

## User stories and acceptance criteria

### 1. Open and understand a diagram immediately (P1)

**As a reader, I want to open a shared diagram without installing tools or starting a development server.**

- A shared project-site link opens a complete, legible diagram in a supported browser, with no terminal, package install or account required to view it.
- The initial view fits the diagram; labels are readable and no content is clipped.
- Opening the portable viewing artifact also requires no local server. If it differs from the editable document, both are clearly named and their purposes explained.

### 2. Start another project from the template (P0)

**As a project owner, I want to reuse the starter without rebuilding its diagram workflow.**

- A clean copy includes a working example, concise getting-started instructions and an obvious place for project diagrams.
- Replacing the example and project identity does not require editing the diagramming engine.
- The template documents its license and dependencies; the core workflow requires no paid service or API key.

### 3. Edit visually (P0)

**As a human editor, I want to move, connect and label things directly.**

- I can add, move, connect, rename and delete nodes and connections using the visible editor.
- The local editor fits the loaded diagram initially, with readable labels and no clipped content.
- Canceling an edit leaves the document unchanged. Repeated actions do not create accidental duplicates or corrupt connections.

### 4. Know what is saved (P0)

**As an editor, I want predictable saving and reopening, with no silent loss.**

- In the local editing workflow, Save overwrites the selected diagram JSON in the cloned repository. The user grants access to that file; Save does not silently choose another file or substitute a download.
- The interface distinguishes unsaved work, browser-local recovery and the saved repository file. Saving does not commit, push or publish; those are deliberate Git and CI/CD steps.
- Saving, closing and reopening preserves labels, connections, positions and supported styling.
- Storage failures and malformed files produce actionable errors without overwriting the last valid document.
- Replacing work requires a clear recovery path or explicit confirmation; interruption and retry are tested.

### 5. Share a link or standalone viewer (P1)

**As an author, I want someone else to view and navigate my diagram through a link or standalone HTML file.**

- A recipient can view the published link or exported HTML without the sender's browser storage, a local server, installation or an account.
- The standalone viewer includes the complete diagram and supports pan and zoom without a network connection.
- Instructions clearly distinguish a published diagram from a private local draft. Local edits are not silently uploaded or implied to appear at a shared link.

### 6. Export a presentation-quality image (P1)

**As an author, I want a crisp image for documents and presentations.**

- Export includes the whole diagram, regardless of current pan/zoom, with complete labels, arrowheads and styling.
- Output resolution or vector support keeps the agreed representative diagrams readable at their intended presentation size.
- The image is visually compared with the editor. Export failure is reported, and the editable source remains intact.

### 7. Let AI edit without erasing human decisions (P0)

**As a human–AI collaborator, I want a stable, inspectable document format.**

- The diagram uses React Flow's native JSON format with stable node/connection IDs and explicit layout coordinates. Preserve IDs and human layout during edits; add no separate diagram schema without a demonstrated need.
- A targeted AI label or connection edit preserves unrelated IDs, human positioning and metadata, including unknown fields that can safely be retained.
- Invalid references and unsupported changes are rejected clearly, not silently dropped. Read–save–reopen round trips preserve the agreed document semantics.

### 8. Judge AI changes visually, not just as code (P0)

**As a reviewer, I want AI to render and inspect its changes before handing them back.**

- The documented workflow is edit → validate → render → inspect → iterate, with the exact document under review identified.
- Review covers clipping, overlap, label readability and connection meaning; a passing schema check alone is not called a visual pass.
- Before/after renders accompany meaningful visual changes, or any inability to inspect is stated explicitly.

### 9. Keep diagram source reviewable in Git (P0)

**As a maintainer, I want normal version history without vendor lock-in.**

- Editable diagrams and template source can live in the project repository; meaningful content changes produce understandable diffs rather than regenerated IDs or editor-state noise.
- Browser storage is not the only copy, and generated viewing/image artifacts are clearly distinguished from the editable source of truth.

### 10. Publish the full project site through the materializer (P1)

**As a project owner, I want diagrams to belong to the project site and its existing delivery workflow.**

- Publishing is deferred until the materializer is ready. The materializer selects a pinned project revision, invokes its normal build and passes the resulting full-site artifact to the publishing stage.
- The publishing stage deploys the complete React project site to GitHub Pages. The project build itself does not deploy, and a push alone is not a publication guarantee.
- Diagram validation and applicable tests run alongside the project's normal checks; a diagram-only pipeline does not replace them.
- Project-subpath assets and direct entry links work on the deployed site. Deployment identifies the source commit and is verified against it.
- Publishing instructions identify which bundled diagrams become accessible and any hosting/account constraints before deployment is enabled.

### 11. Embed an interactive diagram in a webpage (P1)

**As a website author, I want to embed a published diagram in an existing webpage so readers can explore it there.**

- A published diagram provides copyable embed code for use in an existing webpage.
- The embedded diagram initially fits its container, keeps labels readable and supports pan and zoom.
- Visitors can use the embed without installing tools, starting a server or signing in.
- Republishing changes to the diagram updates the embedded view at the same URL.
- The workflow is verified in a host webpage, including container resizing and project-subpath URLs.

### 12. Recover earlier work (P1)

**As an editor, I want to undo changes or restore a saved revision without losing the diagram.**

- Undo and redo restore moves, deletions and replacements; any history limits are visible or documented.
- Restoring a diagram JSON revision from Git restores its content and layout in the local editor.
- Publishing a restored revision is a separate materializer workflow.
