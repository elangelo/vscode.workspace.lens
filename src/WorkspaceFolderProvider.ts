import * as vscode from 'vscode';
import type {
    TreeNode,
    WorkspaceFolderItem,
    FileSystemItem,
    BookmarksGroupItem,
    BookmarkItem,
} from './types';
import type { GitService } from './GitService';

export class WorkspaceFolderProvider
    implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable
{
    private static readonly bookmarksStateKey = 'workspaceLens.bookmarks';

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<
        TreeNode | undefined | void
    >();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly disposables: vscode.Disposable[] = [];
    private readonly bookmarksGroup: BookmarksGroupItem = { kind: 'bookmarksGroup' };

    constructor(
        private readonly git: GitService,
        private readonly workspaceState: vscode.Memento
    ) {
        this.disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                this._onDidChangeTreeData.fire();
            })
        );
    }

    refresh(item?: TreeNode): void {
        this._onDidChangeTreeData.fire(item);
    }

    getTreeItem(node: TreeNode): vscode.TreeItem {
        if (node.kind === 'workspaceFolder') {
            return this.buildWorkspaceFolderItem(node);
        }
        if (node.kind === 'bookmarksGroup') {
            return this.buildBookmarksGroupItem();
        }
        if (node.kind === 'bookmark') {
            return this.buildBookmarkItem(node);
        }
        return this.buildFileSystemItem(node);
    }

    async getChildren(node?: TreeNode): Promise<TreeNode[]> {
        if (!node) {
            return this.getRootNodes();
        }
        if (node.kind === 'bookmarksGroup') {
            return this.getBookmarkNodes();
        }
        if (node.kind === 'workspaceFolder') {
            return this.readDirectory(node.folder.uri, node);
        }
        if (node.kind === 'fileSystem' && node.type === vscode.FileType.Directory) {
            return this.readDirectory(node.uri, node);
        }
        return [];
    }

    private getRootNodes(): TreeNode[] {
        const folders = vscode.workspace.workspaceFolders ?? [];
        return [
            this.bookmarksGroup,
            ...folders.map(folder => ({ kind: 'workspaceFolder' as const, folder })),
        ];
    }

    private bookmarkUris(): vscode.Uri[] {
        const values = this.workspaceState.get<string[]>(
            WorkspaceFolderProvider.bookmarksStateKey,
            []
        );
        return values.map(value => vscode.Uri.parse(value));
    }

    private async getBookmarkNodes(): Promise<BookmarkItem[]> {
        const items = await Promise.all(
            this.bookmarkUris().map(async uri => {
                try {
                    const stat = await vscode.workspace.fs.stat(uri);
                    if (stat.type !== vscode.FileType.File) {
                        return undefined;
                    }
                    return { kind: 'bookmark' as const, uri };
                } catch {
                    return undefined;
                }
            })
        );

        return items
            .filter((item): item is BookmarkItem => item !== undefined)
            .sort((a, b) => a.uri.path.localeCompare(b.uri.path));
    }

    async addBookmark(uri: vscode.Uri): Promise<boolean> {
        const current = this.bookmarkUris().map(item => item.toString());
        const key = uri.toString();
        if (current.includes(key)) {
            return false;
        }

        await this.workspaceState.update(WorkspaceFolderProvider.bookmarksStateKey, [
            ...current,
            key,
        ]);
        this.refresh();
        return true;
    }

    async removeBookmark(uri: vscode.Uri): Promise<boolean> {
        const current = this.bookmarkUris().map(item => item.toString());
        const next = current.filter(item => item !== uri.toString());
        if (next.length === current.length) {
            return false;
        }

        await this.workspaceState.update(WorkspaceFolderProvider.bookmarksStateKey, next);
        this.refresh();
        return true;
    }

    isBookmarked(uri: vscode.Uri): boolean {
        const key = uri.toString();
        return this.bookmarkUris().some(item => item.toString() === key);
    }

    private buildBookmarksGroupItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(
            'Bookmarks',
            vscode.TreeItemCollapsibleState.Expanded
        );
        item.contextValue = 'bookmarksGroup';
        item.iconPath = new vscode.ThemeIcon('bookmark');
        item.description = `${this.bookmarkUris().length}`;
        item.tooltip = 'Quick access to your bookmarked files';
        return item;
    }

    private buildBookmarkItem(node: BookmarkItem): vscode.TreeItem {
        const item = new vscode.TreeItem(
            node.uri,
            vscode.TreeItemCollapsibleState.None
        );
        item.contextValue = 'bookmarkItem';
        item.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [node.uri],
        };
        item.iconPath = new vscode.ThemeIcon('bookmark');
        item.description = vscode.workspace.asRelativePath(node.uri, true);
        return item;
    }

    private async readDirectory(
        dirUri: vscode.Uri,
        parent: WorkspaceFolderItem | FileSystemItem
    ): Promise<FileSystemItem[]> {
        let entries: [string, vscode.FileType][];
        try {
            entries = await vscode.workspace.fs.readDirectory(dirUri);
        } catch {
            return [];
        }

        // Directories first, then files, both sorted alphabetically
        entries.sort(([nameA, typeA], [nameB, typeB]) => {
            const aIsDir = typeA === vscode.FileType.Directory ? 0 : 1;
            const bIsDir = typeB === vscode.FileType.Directory ? 0 : 1;
            if (aIsDir !== bIsDir) {
                return aIsDir - bIsDir;
            }
            return nameA.localeCompare(nameB);
        });

        return entries.map(([name, type]) => ({
            kind: 'fileSystem' as const,
            uri: vscode.Uri.joinPath(dirUri, name),
            type,
            parent,
        }));
    }

    private isWorkspaceHost(folder: vscode.WorkspaceFolder): boolean {
        const wsFile = vscode.workspace.workspaceFile;
        if (!wsFile || wsFile.scheme === 'untitled') {
            return false;
        }
        return vscode.Uri.joinPath(wsFile, '..').toString() === folder.uri.toString();
    }

    private activeWorkspaceName(): string | undefined {
        const wsFile = vscode.workspace.workspaceFile;
        if (!wsFile || wsFile.scheme === 'untitled') {
            return undefined;
        }
        // Strip the .code-workspace extension for a compact label
        const base = wsFile.path.split('/').pop() ?? '';
        return base.replace(/\.code-workspace$/, '');
    }

    private buildWorkspaceFolderItem(node: WorkspaceFolderItem): vscode.TreeItem {
        const info = this.git.getBranchInfo(node.folder.uri);
        const isHost = this.isWorkspaceHost(node.folder);
        const tooltip = this.git.formatTooltip(node.folder.uri, info, isHost);

        const gitDesc = this.git.formatDescription(info);
        const wsName = isHost ? this.activeWorkspaceName() : undefined;
        const description = [gitDesc, wsName ? `ws:${wsName}` : undefined]
            .filter(Boolean)
            .join('  ') || undefined;

        const item = new vscode.TreeItem(
            node.folder.name,
            vscode.TreeItemCollapsibleState.Collapsed
        );

        item.description = description;
        item.tooltip = tooltip;
        item.contextValue = isHost ? 'workspaceFolderHost' : 'workspaceFolder';
        item.iconPath = new vscode.ThemeIcon(
            isHost ? 'home' : 'root-folder',
            info.isDirty
                ? new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')
                : undefined
        );
        item.resourceUri = node.folder.uri;

        return item;
    }

    private buildFileSystemItem(node: FileSystemItem): vscode.TreeItem {
        const isDir = node.type === vscode.FileType.Directory;
        const isWorkspaceFile =
            !isDir && node.uri.path.endsWith('.code-workspace');

        const item = new vscode.TreeItem(
            node.uri,
            isDir
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        if (isWorkspaceFile) {
            const isActive =
                vscode.workspace.workspaceFile?.toString() === node.uri.toString();
            item.contextValue = isActive ? 'workspaceFileActive' : 'workspaceFile';
            item.iconPath = new vscode.ThemeIcon(
                'multiple-windows',
                isActive
                    ? new vscode.ThemeColor('workspaceLens.activeWorkspaceFileForeground')
                    : undefined
            );
            item.description = isActive ? '● active' : undefined;
            item.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [node.uri],
            };
        } else if (isDir) {
            item.contextValue = 'fileSystemDirectory';
        } else {
            item.contextValue = 'fileSystemFile';
            item.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [node.uri],
            };
        }

        return item;
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
