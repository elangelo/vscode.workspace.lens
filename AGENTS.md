# AI Agent Guide: Workspace Lens

## Repository purpose

Workspace Lens is a Visual Studio Code extension that improves multi-root workspace navigation.

Core user value:
- Shows workspace roots in a dedicated tree view.
- Displays per-root git branch and status indicators.
- Distinguishes workspace host folder and active `.code-workspace` file.
- Adds quick actions (open terminal, switch workspace, copy paths, bookmarks, add file to Copilot Chat).

## Runtime model

- Entry point: `src/extension.ts`.
- Extension host runtime: Node.js process managed by VS Code.
- Build output: TypeScript in `src/` compiles to `out/` with `tsc`.
- Required dependency: built-in `vscode.git` extension (declared in `package.json`).

## Project map

- `src/extension.ts`
  - Wires services/providers.
  - Registers all commands.
  - Creates tree view and file decoration provider.
- `src/WorkspaceFolderProvider.ts`
  - Main tree data provider.
  - Builds root nodes, filesystem nodes, and bookmark nodes.
  - Persists bookmarks in workspace state (`workspaceLens.bookmarks`).
- `src/GitService.ts`
  - Connects to `vscode.git` API.
  - Watches repository state changes and triggers refresh.
  - Computes branch/dirty/ahead/behind for workspace roots.
- `src/TerminalService.ts`
  - Opens terminals scoped to folder paths.
  - Reuses one terminal per URI.
- `src/WorkspaceDecorationProvider.ts`
  - Applies color decorations to workspace root folders and workspace host folder.
  - Also decorates the active `.code-workspace` file URI (`workspaceFileActive`) with `workspaceLens.activeWorkspaceFileForeground`.
  - If you add a new visual state that needs row-level color, add a new `ThemeColor` ID here, declare it in `package.json` under `contributes.colors`, and apply it via `provideFileDecoration`.
- `src/types.ts`
  - Tree node discriminated unions used by provider + command handlers.
- `src/git.d.ts`
  - Minimal local typing for git extension API surface used by this project.
  - **Manually maintained** — do not try to `npm install` these types. They are a hand-trimmed subset copied from `microsoft/vscode` → `extensions/git/src/api/git.d.ts`. Only extend this file if a new git API surface is needed.

## Tree and command behavior

The custom view ID is `workspaceLens.foldersView` under the activity container `workspace-lens`.

Node kinds and their **`contextValue`** strings (used in `package.json` `when` clauses):

| Node kind | `contextValue` | Description |
|---|---|---|
| `bookmarksGroup` | `bookmarksGroup` | The static Bookmarks header |
| `bookmark` | `bookmarkItem` | A single bookmarked file |
| `workspaceFolder` | `workspaceFolder` | A regular root folder |
| `workspaceFolder` | `workspaceFolderHost` | The root folder that contains the `.code-workspace` file |
| `fileSystem` (dir) | `fileSystemDirectory` | A sub-directory inside a root |
| `fileSystem` (file) | `fileSystemFile` | A regular file |
| `fileSystem` (file) | `workspaceFile` | A `.code-workspace` file (not currently loaded) |
| `fileSystem` (file) | `workspaceFileActive` | The currently loaded `.code-workspace` file |

When clauses in `package.json` use regex prefix matching (`viewItem =~ /^workspaceFolder/`) to match both `workspaceFolder` and `workspaceFolderHost` in one rule. Use the same pattern when adding new commands that apply to both.

Important command IDs:
- `workspaceLens.refresh`
- `workspaceLens.openTerminal`
- `workspaceLens.openTerminalAtPath`
- `workspaceLens.switchWorkspace`
- `workspaceLens.openToSide`
- `workspaceLens.copyPath`
- `workspaceLens.copyRelativePath`
- `workspaceLens.revealInOS`
- `workspaceLens.cut`
- `workspaceLens.copyFile`
- `workspaceLens.openTimeline`
- `workspaceLens.addToChat`
- `workspaceLens.bookmarkAdd`
- `workspaceLens.bookmarkRemove`
- `workspaceLens.bookmarkAddActiveEditor`
- `workspaceLens.deleteFile`
- `workspaceLens.newFile`
- `workspaceLens.newFolder`

When adding a new command:
1. Add it in `package.json` contributions (`commands` and menu placements if needed).
2. Register it in `activate`.
3. Set/extend node `contextValue` where required.

## Host folder label format

The workspace host folder row shows a compound description built in `WorkspaceFolderProvider.buildWorkspaceFolderItem`:

```
[branch * ↑N ↓M]  ws:workspace-name
```

- The git part (`[branch...]`) comes from `GitService.formatDescription()`.
- The `ws:name` suffix is the active `.code-workspace` filename with the extension stripped, produced by `WorkspaceFolderProvider.activeWorkspaceName()`.
- Only shown on the host folder row (`isHost === true`); other roots show only the git part.

## Data flow summary

1. `WorkspaceFolderProvider.getChildren()` builds tree nodes from workspace folders and filesystem reads.
2. `GitService` watches git API/repository events and requests provider refresh.
3. `WorkspaceDecorationProvider` colors root + host folders using theme color IDs.
4. Command handlers receive typed node payloads from context menus and operate on VS Code APIs.

## Development workflow

Install/build:

```bash
npm install
npm run compile
```

During development:

```bash
npm run watch
```

Launch extension host:
- Press `F5` in VS Code.

## Validation checklist for agents

After making code changes:
1. Run `npm run compile` and fix TypeScript errors.
2. Verify command IDs and `when` clauses still match node `contextValue` values.
3. If tree behavior changed, smoke test:
   - Multi-root workspace listing.
   - Git label updates after branch/working-tree changes.
   - Terminal reuse behavior.
   - Bookmark add/remove persistence.
4. If UI labels/icons changed, ensure README feature text still matches behavior.

## Common pitfalls

- Forgetting to update both `package.json` contribution points and runtime command registration.
- Using unstable Copilot Chat command signatures; this code intentionally tries multiple payload shapes.
- Breaking root item context values, which silently hides context menu actions.
- Introducing assumptions that all workspaces have a `workspaceFile`; untitled workspaces are supported.

## Safe extension points

Low-risk additions:
- New context menu commands for existing node kinds.
- Additional tooltip fields.
- New bookmark actions.

Higher-risk changes:
- Git API subscription lifecycle.
- Tree node typing and `contextValue` conventions.
- Cross-command behavior that depends on `uri` presence.
