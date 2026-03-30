import * as vscode from 'vscode';

export class TerminalService implements vscode.Disposable {
    private readonly terminals = new Map<string, vscode.Terminal>();
    private readonly disposables: vscode.Disposable[] = [];

    constructor() {
        this.disposables.push(
            vscode.window.onDidCloseTerminal(terminal => {
                for (const [key, t] of this.terminals) {
                    if (t === terminal) {
                        this.terminals.delete(key);
                        break;
                    }
                }
            })
        );
    }

    getOrCreate(folder: vscode.WorkspaceFolder): vscode.Terminal {
        return this.openAt(folder.uri, folder.name);
    }

    openAt(uri: vscode.Uri, name: string): vscode.Terminal {
        const key = uri.toString();
        const existing = this.terminals.get(key);

        if (existing) {
            existing.show(true);
            return existing;
        }

        const terminal = vscode.window.createTerminal({ name, cwd: uri });
        this.terminals.set(key, terminal);
        terminal.show(true);
        return terminal;
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
