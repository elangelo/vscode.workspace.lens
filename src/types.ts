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

export interface BookmarksGroupItem {
    kind: 'bookmarksGroup';
}

export interface BookmarkItem {
    kind: 'bookmark';
    uri: vscode.Uri;
}

export type TreeNode =
    | WorkspaceFolderItem
    | FileSystemItem
    | BookmarksGroupItem
    | BookmarkItem;
