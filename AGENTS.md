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
- `src/types.ts`
  - Tree node discriminated unions used by provider + command handlers.
- `src/git.d.ts`
  - Minimal local typing for git extension API surface used by this project.

## Tree and command behavior

The custom view ID is `workspaceLens.foldersView` under the activity container `workspace-lens`.

Node kinds:
- `bookmarksGroup`
- `bookmark`
- `workspaceFolder`
- `fileSystem` (file or directory)

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

When adding a new command:
1. Add it in `package.json` contributions (`commands` and menu placements if needed).
2. Register it in `activate`.
3. Set/extend node `contextValue` where required.

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
