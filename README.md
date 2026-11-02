# pure-schematic

> A diagramming starter for humans and AI. AI native workflows allow seamless prompt-to-diagram edits, while retaining a cohesive human editing interface. Keep diagrams as code, fully version-controlled in Git, with sharing capabilities including websites, portable files, or presentation-ready images.

### 1. Prerequisites

---

- macOS or Linux on ARM64 or x86-64, as configured in `flake.nix`.
- Install [Nix](https://nix.dev/install-nix).
- Windows: use WSL2, follow the [Nix WSL2 installation instructions](https://nix.dev/install-nix), and run the Linux commands inside WSL.
- Network access for uncached toolchains and dependencies.

Run the commands below from the repository root.

Optional shortcut: configure `ub` as an alias for `./universal-build`:

- Zsh/Bash: add `alias ub='./universal-build'` to `~/.zshrc` or `~/.bashrc`.
- Windows PowerShell: add `function ub { wsl -- bash -lc 'exec ./universal-build "$@"' ub @args }` to `$PROFILE` (uses the default WSL distribution with Nix installed).

Restart your terminal after saving.

### 2. Build and Test

---

#### Universal Build Contract

Universal Build expects:

- `universal-build` at the project root.
- Any version of Nix on `PATH`.
- `flake.nix` at the project root.
- `flake.lock` at the project root, except for `clean` and initial `update-toolchain-lock`.
- A flake input named `nixpkgs`.
- A development shell named `buildtime`.
- `buildtime.BUILD_COMMAND` must contain the shell command to run for `build`.
- `BUILD_COMMAND` must resolve dependencies and enforce dependency locks.
- `BUILD_COMMAND` must compile the application as needed.
- `BUILD_COMMAND` must run tests and checks.
- `BUILD_COMMAND` must stage all deployable files to `build/release/idiomatic-artifacts/`.
- `buildtime.RELEASE_TYPE` set to `container` or `static`.
- `buildtime.UPDATE_IDIOMATIC_LOCK_COMMAND` must contain the shell command to refresh dependency locks for `update-idiomatic-lock`.
- `buildtime.IDE_PATH_VARS` listing space-separated environment variable names for `ide-paths`.
- Each variable listed in `IDE_PATH_VARS` to be defined in `buildtime`.
- A root `Dockerfile` for container releases.
- A flake package named `runtime` for container releases.
- The runtime package to provide executable named `ignite`.
- The runtime package to include all runtime dependencies and environment variables.
- `ignite` to accept the idiomatic artifacts directory as its first argument.
- `ignite` to execute the software's main() entrypoint based on the language being used.

For `build`, Universal Build recreates `build/release/` and archives its contents as `build/release-artifact.tar.gz`:

- `idiomatic-artifacts/`.
- `Dockerfile` for container releases.
- `runtime-artifacts/` for container releases.
- `symlink-to-absolute-ignite-script` pointing to the runtime package for container releases.

#### Everyday Commands

| Goal | Command |
| --- | --- |
| Build, test, check, and package | `./universal-build build` |
| Remove build outputs | `./universal-build clean` |
| Print IDE toolchain paths | `./universal-build ide-paths` |
| Update toolchain lock | `./universal-build update-toolchain-lock` |
| Refresh application dependency locks | `./universal-build update-idiomatic-lock` |

#### Outputs

- Test results: `build/quality-reports/tests/junit.xml`.
- Coverage: `build/quality-reports/coverage/index.html` and `build/quality-reports/coverage/lcov.info`.
- Deployable website: `build/release/idiomatic-artifacts/`.
- Release archive: `build/release-artifact.tar.gz`.

### 3. Development Workflows

---

#### Run the Local Editor

After the first build, run the editor inside the pinned toolchain:

```sh
nix --extra-experimental-features 'nix-command flakes' develop --no-update-lock-file .#buildtime --command pnpm dev
```

Open the local URL printed in the terminal. Keep that command running while editing;
stop it with Ctrl+C when finished. To preview the production build, substitute `pnpm preview`.
The production build shows `diagrams/example.json` as a static viewer; publishing is P1
and will be connected through the materializer.

#### Edit and Save a Diagram

1. In **Diagram file**, select or type a filename from the project's `diagrams/` folder, then click **Open**.
2. Click **Add node**, drag nodes to arrange them, and drag from one connection handle to another to connect them.
3. Select a node or connection, edit **Label**, then click **Apply label**. **Cancel** discards the pending label edit.
4. Use **Delete selected** or Backspace/Delete to remove selected nodes or connections. Removing a node also removes its connections.
5. Click **Save**. This overwrites the named JSON file in the repository. The status distinguishes unsaved edits from the saved file.
6. Open the file again to verify its content and saved view. **Fit View** shows the whole diagram on demand.
7. Run `./universal-build build`, review `git diff`, then commit and push when ready. Saving itself does not commit, push, or publish.

Files use React Flow's native JSON. Selection and measurement state are omitted from
saved files, while content, layout, supported styling, and additional metadata remain.
Use plain filenames such as `service-map.json`; nested paths and symlinks are not supported.
If another tab or an external editor changed the file, Save refuses to replace it. Keep
your current tab open and compare it with a freshly opened copy before deciding what to keep.
Opening another diagram prompts before discarding unsaved work, and leaving the page
warns about unsaved changes. There is no automatic browser-storage backup; commit saved
work to Git for recovery. Undo/redo and additional recovery tools remain P1.

#### Create a Diagram

Enter an unused filename ending in `.json` in **Diagram file**, then click **New**.
Add, label, connect, and arrange nodes, then **Save** to create the file in `diagrams/`.
An existing filename is never overwritten by a new diagram. Until the first successful
Save, changing the filename retargets the draft without discarding its contents. Reopen the new file and
verify it, then build, review the Git diff, and commit or push.

#### Start a Project

Copy this template into your own repository, then clone that repository and run
`./universal-build build`. Set your project name in `package.json`, the README heading,
`src/main/index.html`, and the heading in `src/main/App.tsx`; update the package lock
with `./universal-build update-idiomatic-lock` if package metadata requires it.
Replace `diagrams/example.json` with your project diagram, run the local editor, and
verify it. Finish with `./universal-build build`, review the diff, and commit or push.
The [license](LICENSE) and dependencies are documented below and in `package.json`.

#### Make an AI Edit

Give the AI the repository, the exact `diagrams/<name>.json` file, and the requested change.
Ask it to preserve unrelated IDs, node positions, styling, and unknown metadata, and use
only React Flow's native format. Supported node types are `default`, `input`, `output`,
and `group`; supported edges are `default`, `straight`, `step`, `smoothstep`, and
`simplebezier`. Labels are text or numbers; custom node components require a separate code change.

The workflow is **edit → build → render → inspect → review**:

1. Make the targeted JSON edit. Nodes need unique string IDs, positions and data; edges must reference existing nodes. Group parents must appear before their children in the nodes array.
2. Run `./universal-build build`. The build validates project diagram files as well as the application.
3. Start the local editor, open that exact filename, and inspect the rendered result. Check clipping, overlap, labels and connection meaning; use Fit View when useful.
4. Include before/after screenshots for meaningful visual changes, or state clearly if visual inspection was unavailable.
5. Review the diagram and Git diff together, then commit or push. Reopen browser tabs after external edits before making further changes there.

#### Dependency Management

Edit `package.json`:

- Add: declare the package and version in `dependencies` or `devDependencies` (see appendix).
- Remove: delete the declaration and its usages.
- Upgrade/pin: change the version or version range.

Refresh locks after adding, removing, or updating dependencies:

```sh
./universal-build update-idiomatic-lock
```

#### Toolchain Changes

| Change | Files and steps |
| --- | --- |
| Node version | Change `chosenNode` in the buildtime shell in `flake.nix`. Review `@types/node` and TypeScript configuration together. |
| Add a CLI tool | Add its Nix package to the development shell's `packages` in `flake.nix`. |
| Nix package set | Change `inputs.nixpkgs.url` in `flake.nix`, then run `./universal-build update-toolchain-lock`. Review and commit `flake.nix` and `flake.lock`. |
| pnpm version | Change `chosenPnpm` in `flake.nix`; `flake.lock` pins the exact release. |

After toolchain changes, run `./universal-build build`, then run `./universal-build ide-paths` and update the IDE's Node and pnpm paths.

### 4. IDE Setup

---

Print the pinned Node and pnpm locations:

```sh
./universal-build ide-paths
```

Use `NODE_BINARY` for Node and `PNPM_BINARY` for pnpm. The TypeScript SDK becomes available after the first `./universal-build build`, at the repository's `node_modules/typescript/lib` directory; use its absolute path.

Configure your IDE using these paths:

- [IntelliJ IDEA Ultimate setup](https://app.notion.com/p/f4c0a2b7875583b79fa5015d58412fea)
- [Visual Studio Code setup](https://app.notion.com/p/4fd0a2b787558204a6c001d0b034f698)

Reprint the toolchain paths after Nix/toolchain changes.

### 5. Concepts

---

- [Product Release Pipelines Across Repositories](https://app.notion.com/p/3f90a2b7875581ef953bca201941e0dd)
- [Deployment Testing and Promotion](https://app.notion.com/p/3f90a2b7875581de812ffaddc1e44b83)
- [Shutdown Concepts](https://app.notion.com/p/4080a2b78755818a93b6c7ffa13a809d)

### 6. Appendix

---

#### Dependency Declarations

| `package.json` field | Use |
| --- | --- |
| `dependencies` | Runtime dependencies |
| `devDependencies` | Build, test, and editor tools |
| `optionalDependencies` | Dependencies whose installation may fail |
| `peerDependencies` | Compatibility requirements for a consuming application's dependencies |

Reference: [pnpm package.json](https://pnpm.io/10.x/package_json).

### License

---

All rights reserved. See [LICENSE](LICENSE).
