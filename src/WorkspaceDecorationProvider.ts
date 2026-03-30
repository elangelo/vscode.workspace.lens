import * as vscode from 'vscode';

function getWorkspaceHostUri(): vscode.Uri | undefined {
    const wsFile = vscode.workspace.workspaceFile;
    if (!wsFile || wsFile.scheme === 'untitled') {
        return undefined;
    }
    return vscode.Uri.joinPath(wsFile, '..');
}

function getRootUriStrings(): Set<string> {
    return new Set(
        (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.toString())
    );
}

export class WorkspaceDecorationProvider
    implements vscode.FileDecorationProvider, vscode.Disposable
{
    private readonly _onDidChangeFileDecorations =
        new vscode.EventEmitter<vscode.Uri[]>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    private readonly disposables: vscode.Disposable[] = [];

    constructor() {
        this.disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                const uris = (vscode.workspace.workspaceFolders ?? []).map(f => f.uri);
                this._onDidChangeFileDecorations.fire(uris);
            })
        );
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        const key = uri.toString();

        const hostUri = getWorkspaceHostUri();
        if (hostUri && hostUri.toString() === key) {
            return new vscode.FileDecoration(
                undefined,
                'Contains the workspace file',
                new vscode.ThemeColor('workspaceLens.workspaceFileFolderForeground')
            );
        }

        if (getRootUriStrings().has(key)) {
            return new vscode.FileDecoration(
                undefined,
                'Workspace root folder',
                new vscode.ThemeColor('workspaceLens.rootFolderForeground')
            );
        }

        return undefined;
    }

    dispose(): void {
        this._onDidChangeFileDecorations.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
