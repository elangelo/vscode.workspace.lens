/*---------------------------------------------------------------------------------------------
 *  Minimal subset of the vscode.git extension API types needed by Workspace Lens.
 *  Sourced from: https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts
 *--------------------------------------------------------------------------------------------*/

import { Uri, Event, Disposable } from 'vscode';

export interface UpstreamRef {
    readonly remote: string;
    readonly name: string;
    readonly commit?: string;
}

export interface Ref {
    readonly name?: string;
    readonly commit?: string;
}

export interface Branch extends Ref {
    readonly upstream?: UpstreamRef;
    readonly ahead?: number;
    readonly behind?: number;
}

export interface Change {
    readonly uri: Uri;
}

export interface RepositoryState {
    readonly HEAD: Branch | undefined;
    readonly indexChanges: Change[];
    readonly workingTreeChanges: Change[];
    readonly untrackedChanges: Change[];
    readonly onDidChange: Event<void>;
}

export interface Repository {
    readonly rootUri: Uri;
    readonly state: RepositoryState;
}

export type APIState = 'uninitialized' | 'initialized';

export interface API {
    readonly state: APIState;
    readonly onDidChangeState: Event<APIState>;
    readonly repositories: Repository[];
    readonly onDidOpenRepository: Event<Repository>;
    readonly onDidCloseRepository: Event<Repository>;
    getRepository(uri: Uri): Repository | null;
}

export interface GitExtension {
    readonly enabled: boolean;
    readonly onDidChangeEnablement: Event<boolean>;
    getAPI(version: 1): API;
}
