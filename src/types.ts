import * as vscode from 'vscode';

export interface WorkspaceFolderItem {
    kind: 'workspaceFolder';
    folder: vscode.WorkspaceFolder;
}

export interface FileSystemItem {
    kind: 'fileSystem';
    uri: vscode.Uri;
    type: vscode.FileType;
    parent: WorkspaceFolderItem | FileSystemItem;
}

export type TreeNode = WorkspaceFolderItem | FileSystemItem;
