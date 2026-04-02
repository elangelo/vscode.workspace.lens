import * as vscode from 'vscode';
import { GitService } from './GitService';
import { TerminalService } from './TerminalService';
import { WorkspaceFolderProvider } from './WorkspaceFolderProvider';
import { WorkspaceDecorationProvider } from './WorkspaceDecorationProvider';
import type { WorkspaceFolderItem } from './types';

async function addUriToCopilotChat(uri: vscode.Uri): Promise<void> {
    const copilotChat = vscode.extensions.getExtension('github.copilot-chat');
    if (!copilotChat) {
        throw new Error('Copilot Chat extension is not installed');
    }

    if (!copilotChat.isActive) {
        await copilotChat.activate();
    }

    // Prefer chat-open APIs because command IDs for "include" changed across versions.
    const primaryAttempts: Array<() => Thenable<void>> = [
        () =>
            vscode.commands.executeCommand('workbench.action.chat.open', {
                attachFiles: [uri],
            }),
        () =>
            vscode.commands.executeCommand('workbench.action.chat.open', {
                mode: 'ask',
                attachFiles: [uri],
            }),
        () =>
            vscode.commands.executeCommand('workbench.action.chat.open', {
                mode: 'agent',
                attachFiles: [uri],
            }),
    ];

    for (const attempt of primaryAttempts) {
        try {
            await attempt();
            return;
        } catch {
            // try next signature
        }
    }

    const availableCommands = await vscode.commands.getCommands(true);
    const knownIncludeCommands = [
        'github.copilot.chat.include',
        'github.copilot.chat.attachFile',
    ];

    const includeCommand = knownIncludeCommands.find(cmd => availableCommands.includes(cmd));
    if (!includeCommand) {
        throw new Error('No compatible Copilot Chat include command found');
    }

    const includeAttempts: Array<() => Thenable<void>> = [
        () => vscode.commands.executeCommand(includeCommand, uri),
        () => vscode.commands.executeCommand(includeCommand, [uri]),
        () => vscode.commands.executeCommand(includeCommand, { uri }),
        () => vscode.commands.executeCommand(includeCommand, { uris: [uri] }),
    ];

    for (const attempt of includeAttempts) {
        try {
            await attempt();
            return;
        } catch {
            // try next payload shape
        }
    }

    throw new Error('Copilot Chat command rejected all known argument shapes');
}

export function activate(context: vscode.ExtensionContext): void {
    const gitService = new GitService();
    const terminalService = new TerminalService();
    const provider = new WorkspaceFolderProvider(gitService, context.workspaceState);
    const decorationProvider = new WorkspaceDecorationProvider();

    // Wire git refresh back into the tree provider (full refresh — small tree, no overhead)
    gitService.init(() => provider.refresh());

    const treeView = vscode.window.createTreeView('workspaceLens.foldersView', {
        treeDataProvider: provider,
        showCollapseAll: true,
    });

    const refreshCommand = vscode.commands.registerCommand(
        'workspaceLens.refresh',
        () => provider.refresh()
    );

    const openTerminalCommand = vscode.commands.registerCommand(
        'workspaceLens.openTerminal',
        (node: WorkspaceFolderItem | undefined) => {
            if (!node || node.kind !== 'workspaceFolder') {
                return;
            }
            terminalService.getOrCreate(node.folder);
        }
    );

    const switchWorkspaceCommand = vscode.commands.registerCommand(
        'workspaceLens.switchWorkspace',
        (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }
            vscode.commands.executeCommand('vscode.openFolder', uri);
        }
    );

    const openToSideCommand = vscode.commands.registerCommand(
        'workspaceLens.openToSide',
        (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }
            vscode.commands.executeCommand('vscode.open', uri, vscode.ViewColumn.Beside);
        }
    );

    const copyPathCommand = vscode.commands.registerCommand(
        'workspaceLens.copyPath',
        (node: { uri?: vscode.Uri; folder?: vscode.WorkspaceFolder } | undefined) => {
            const uri = node?.uri ?? node?.folder?.uri;
            if (!uri) {
                return;
            }
            vscode.env.clipboard.writeText(uri.fsPath);
        }
    );

    const revealInOsCommand = vscode.commands.registerCommand(
        'workspaceLens.revealInOS',
        (node: { uri?: vscode.Uri; folder?: vscode.WorkspaceFolder } | undefined) => {
            const uri = node?.uri ?? node?.folder?.uri;
            if (!uri) {
                return;
            }
            vscode.commands.executeCommand('revealFileInOS', uri);
        }
    );

    const openTerminalAtPathCommand = vscode.commands.registerCommand(
        'workspaceLens.openTerminalAtPath',
        (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }
            const name = uri.path.split('/').pop() ?? uri.fsPath;
            terminalService.openAt(uri, name);
        }
    );

    const copyRelativePathCommand = vscode.commands.registerCommand(
        'workspaceLens.copyRelativePath',
        (node: { uri?: vscode.Uri; folder?: vscode.WorkspaceFolder } | undefined) => {
            const uri = node?.uri ?? node?.folder?.uri;
            if (!uri) {
                return;
            }
            vscode.env.clipboard.writeText(vscode.workspace.asRelativePath(uri, true));
        }
    );

    const cutCommand = vscode.commands.registerCommand(
        'workspaceLens.cut',
        async (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }
            await vscode.commands.executeCommand('revealInExplorer', uri);
            await vscode.commands.executeCommand('filesExplorer.cut');
        }
    );

    const copyFileCommand = vscode.commands.registerCommand(
        'workspaceLens.copyFile',
        async (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }
            await vscode.commands.executeCommand('revealInExplorer', uri);
            await vscode.commands.executeCommand('filesExplorer.copy');
        }
    );

    const openTimelineCommand = vscode.commands.registerCommand(
        'workspaceLens.openTimeline',
        async (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }
            await vscode.commands.executeCommand('vscode.open', uri);
            await vscode.commands.executeCommand('timeline.focus');
        }
    );

    const addToChatCommand = vscode.commands.registerCommand(
        'workspaceLens.addToChat',
        async (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }
            try {
                await addUriToCopilotChat(uri);
            } catch {
                vscode.window.showErrorMessage(
                    'Could not add to Copilot Chat. Ensure GitHub Copilot Chat is installed and enabled.'
                );
            }
        }
    );

    const bookmarkAddCommand = vscode.commands.registerCommand(
        'workspaceLens.bookmarkAdd',
        async (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }

            const added = await provider.addBookmark(uri);
            if (!added) {
                vscode.window.showInformationMessage('File is already bookmarked.');
            }
        }
    );

    const bookmarkRemoveCommand = vscode.commands.registerCommand(
        'workspaceLens.bookmarkRemove',
        async (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }

            const removed = await provider.removeBookmark(uri);
            if (!removed) {
                vscode.window.showInformationMessage('File is not bookmarked.');
            }
        }
    );

    const bookmarkAddActiveEditorCommand = vscode.commands.registerCommand(
        'workspaceLens.bookmarkAddActiveEditor',
        async () => {
            const uri = vscode.window.activeTextEditor?.document.uri;
            if (!uri || uri.scheme !== 'file') {
                vscode.window.showInformationMessage('Open a file editor to add a bookmark.');
                return;
            }

            const added = await provider.addBookmark(uri);
            if (!added) {
                vscode.window.showInformationMessage('File is already bookmarked.');
            }
        }
    );

    const deleteFileCommand = vscode.commands.registerCommand(
        'workspaceLens.deleteFile',
        async (node: { uri?: vscode.Uri } | undefined) => {
            const uri = node?.uri;
            if (!uri) {
                return;
            }
            const name = uri.path.split('/').pop() ?? uri.fsPath;
            const answer = await vscode.window.showWarningMessage(
                `Are you sure you want to delete '${name}'? This cannot be undone.`,
                { modal: true },
                'Delete'
            );
            if (answer !== 'Delete') {
                return;
            }
            await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
            provider.refresh();
        }
    );

    const newFileCommand = vscode.commands.registerCommand(
        'workspaceLens.newFile',
        async (node: { uri?: vscode.Uri; folder?: vscode.WorkspaceFolder } | undefined) => {
            const dirUri = node?.uri ?? node?.folder?.uri;
            if (!dirUri) {
                return;
            }
            const name = await vscode.window.showInputBox({
                prompt: 'Enter the new file name',
                placeHolder: 'filename.ext',
                validateInput: value => (value.trim() ? undefined : 'File name cannot be empty'),
            });
            if (!name) {
                return;
            }
            const target = vscode.Uri.joinPath(dirUri, name.trim());
            await vscode.workspace.fs.writeFile(target, new Uint8Array());
            provider.refresh();
            await vscode.commands.executeCommand('vscode.open', target);
        }
    );

    const newFolderCommand = vscode.commands.registerCommand(
        'workspaceLens.newFolder',
        async (node: { uri?: vscode.Uri; folder?: vscode.WorkspaceFolder } | undefined) => {
            const dirUri = node?.uri ?? node?.folder?.uri;
            if (!dirUri) {
                return;
            }
            const name = await vscode.window.showInputBox({
                prompt: 'Enter the new folder name',
                placeHolder: 'folder-name',
                validateInput: value => (value.trim() ? undefined : 'Folder name cannot be empty'),
            });
            if (!name) {
                return;
            }
            const target = vscode.Uri.joinPath(dirUri, name.trim());
            await vscode.workspace.fs.createDirectory(target);
            provider.refresh();
        }
    );

    context.subscriptions.push(
        treeView,
        provider,
        gitService,
        terminalService,
        decorationProvider,
        vscode.window.registerFileDecorationProvider(decorationProvider),
        refreshCommand,
        openTerminalCommand,
        switchWorkspaceCommand,
        openToSideCommand,
        copyPathCommand,
        copyRelativePathCommand,
        revealInOsCommand,
        openTerminalAtPathCommand,
        cutCommand,
        copyFileCommand,
        openTimelineCommand,
        addToChatCommand,
        bookmarkAddCommand,
        bookmarkRemoveCommand,
        bookmarkAddActiveEditorCommand,
        deleteFileCommand,
        newFileCommand,
        newFolderCommand
    );
}

export function deactivate(): void {
    // Nothing to do — everything is registered in context.subscriptions
}
