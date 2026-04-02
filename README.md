# Workspace Lens

A Visual Studio Code extension that makes multi-root workspaces actually usable.

The built-in Explorer gives no visual differentiation between workspace roots and their children, shows no git information per folder, and provides no quick way to open a terminal scoped to a specific root. Workspace Lens fixes all of that.

## Features

### Dedicated Activity Bar panel

A custom panel lists all workspace root folders at the top level. Expand any root to browse its files and sub-folders with full file-icon-theme support.

### Git status per root folder

Each root folder row shows its current branch and status inline:

```
vscode.workspace.lens [main * ↑2 ↓1]
```

| Indicator | Meaning |
|---|---|
| `[branch]` | Current branch name |
| `*` | Uncommitted changes (dirty working tree) |
| `↑N` | N commits ahead of remote |
| `↓N` | N commits behind remote |

Status updates live as you commit, stage, or switch branches — no manual refresh needed.

### Visual distinction between root folders and children

Root folder rows are colored distinctly (teal by default) so they remain easy to spot when the tree is fully expanded. Both colors are themeable via `workbench.colorCustomizations`:

| Color ID | Purpose |
|---|---|
| `workspaceLens.rootFolderForeground` | All root workspace folders |
| `workspaceLens.workspaceFileFolderForeground` | The folder that contains the `.code-workspace` file |
| `workspaceLens.activeWorkspaceFileForeground` | The currently loaded `.code-workspace` file |

### Workspace host folder

The folder containing your `.code-workspace` file is marked with a `$(home)` icon. Its row also shows which workspace file is currently loaded:

```
ai-workspace  [main]  ws:ps-workspace
```

### Active workspace indicator

`.code-workspace` files in the tree are rendered with a distinct `$(multiple-windows)` icon. The currently loaded workspace file is highlighted in green and marked `● active`.

### Bookmarks panel

At the top of the tree, a dedicated **Bookmarks** section gives quick access to frequently used files.

- Add bookmarks from file context menus with **Add Bookmark**
- Remove entries directly from the bookmark item with **Remove Bookmark**
- Use the view title button **Bookmark Active File** to pin the currently open editor file

Bookmarks are persisted in workspace state and restored automatically.

### Terminal launcher with reuse

Right-click any root folder or sub-directory and choose **Open Terminal Here**. The terminal opens at that folder's path. If a terminal for that folder is already open, it is focused instead of creating a duplicate.

### Switch workspace

Right-click any `.code-workspace` file in the tree and choose **Switch to This Workspace** to reopen VS Code in that workspace.

## Context menu actions

| Item type | Available actions |
|---|---|
| Root folder | Open Terminal, Copy Path, Copy Relative Path, Reveal in File Manager |
| Sub-directory | Open Terminal Here, Cut, Copy, Copy Path, Copy Relative Path, Reveal in File Manager, Add to Copilot Chat |
| File | Open to the Side, Cut, Copy, Copy Path, Copy Relative Path, Open Timeline, Reveal in File Manager, Add to Copilot Chat, Add Bookmark |
| `.code-workspace` file | Switch to This Workspace, Open to the Side, Cut, Copy, Copy Path, Copy Relative Path, Open Timeline, Reveal in File Manager, Add to Copilot Chat, Add Bookmark |
| Bookmark item | Open File, Remove Bookmark |

## Requirements

- VS Code `^1.85.0`
- The built-in `vscode.git` extension must be enabled (it is by default)

## Extension settings

No settings yet. Color customization is available via standard `workbench.colorCustomizations` in your `settings.json`:

```json
"workbench.colorCustomizations": {
    "workspaceLens.rootFolderForeground": "#4EC9B0",
    "workspaceLens.workspaceFileFolderForeground": "#FFD602",
    "workspaceLens.activeWorkspaceFileForeground": "#89D185"
}
```

## Development

```bash
git clone https://github.com/elangelo/vscode.workspace.lens
cd vscode.workspace.lens
npm install
npm run compile
```

Press `F5` to launch an Extension Development Host with the extension loaded. Open a `.code-workspace` file with multiple folders to test.

```bash
npm run watch   # incremental compilation
```
