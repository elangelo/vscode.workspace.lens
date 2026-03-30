import * as vscode from 'vscode';
import type { API as GitAPI, GitExtension, Repository } from './git';

export interface BranchInfo {
    branch?: string;
    isDirty: boolean;
    ahead?: number;
    behind?: number;
}

export class GitService implements vscode.Disposable {
    private api: GitAPI | undefined;
    private readonly disposables: vscode.Disposable[] = [];
    private onRefresh: (() => void) | undefined;

    init(onRefresh: () => void): void {
        this.onRefresh = onRefresh;

        const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
        if (!ext) {
            return;
        }

        const gitExtension = ext.exports;

        const setup = () => {
            if (!gitExtension.enabled) {
                return;
            }
            this.api = gitExtension.getAPI(1);
            this.subscribeToApi(this.api);
        };

        if (gitExtension.enabled) {
            setup();
        }

        this.disposables.push(
            gitExtension.onDidChangeEnablement(() => {
                this.api = undefined;
                if (gitExtension.enabled) {
                    setup();
                } else {
                    this.onRefresh?.();
                }
            })
        );
    }

    private subscribeToApi(api: GitAPI): void {
        // When git finishes its initial scan, refresh the whole tree
        if (api.state === 'uninitialized') {
            this.disposables.push(
                api.onDidChangeState(state => {
                    if (state === 'initialized') {
                        this.onRefresh?.();
                    }
                })
            );
        }

        // Subscribe to repos that are already open
        for (const repo of api.repositories) {
            this.watchRepo(repo);
        }

        this.disposables.push(
            api.onDidOpenRepository(repo => {
                this.watchRepo(repo);
                // A new repo was discovered — refresh so git info appears
                this.onRefresh?.();
            }),
            api.onDidCloseRepository(() => {
                this.onRefresh?.();
            })
        );
    }

    private watchRepo(repo: Repository): void {
        // Any state change (branch switch, commit, stage, etc.) → refresh tree
        this.disposables.push(
            repo.state.onDidChange(() => {
                this.onRefresh?.();
            })
        );
    }

    getBranchInfo(folderUri: vscode.Uri): BranchInfo {
        if (!this.api) {
            return { isDirty: false };
        }

        const repo = this.api.getRepository(folderUri);
        if (!repo) {
            return { isDirty: false };
        }

        const { HEAD, indexChanges, workingTreeChanges, untrackedChanges } = repo.state;

        const isDirty =
            indexChanges.length > 0 ||
            workingTreeChanges.length > 0 ||
            untrackedChanges.length > 0;

        return {
            branch: HEAD?.name,
            isDirty,
            ahead: HEAD?.ahead,
            behind: HEAD?.behind,
        };
    }

    formatDescription(info: BranchInfo): string | undefined {
        if (!info.branch) {
            return undefined;
        }

        let label = info.branch;

        const parts: string[] = [];
        if (info.isDirty) {
            parts.push('*');
        }
        if (info.ahead !== undefined && info.ahead > 0) {
            parts.push(`↑${info.ahead}`);
        }
        if (info.behind !== undefined && info.behind > 0) {
            parts.push(`↓${info.behind}`);
        }

        if (parts.length > 0) {
            label += ' ' + parts.join(' ');
        }

        return `[${label}]`;
    }

    formatTooltip(folderUri: vscode.Uri, info: BranchInfo, isWorkspaceHost = false): vscode.MarkdownString {
        const md = new vscode.MarkdownString('', true);
        md.supportThemeIcons = true;

        const folderIcon = isWorkspaceHost ? '$(home)' : '$(folder)';
        md.appendMarkdown(`**${folderIcon} ${folderUri.fsPath}**\n\n`);

        if (isWorkspaceHost) {
            const wsFile = vscode.workspace.workspaceFile;
            const wsName = wsFile ? wsFile.path.split('/').pop() : undefined;
            md.appendMarkdown(`$(file-code) Active workspace: \`${wsName ?? 'unknown'}\`\n\n`);
        }

        if (info.branch) {
            md.appendMarkdown(`$(git-branch) Branch: \`${info.branch}\`\n\n`);

            if (info.ahead !== undefined || info.behind !== undefined) {
                const ahead = info.ahead ?? 0;
                const behind = info.behind ?? 0;
                md.appendMarkdown(`$(git-commit) Ahead: **${ahead}** &nbsp; Behind: **${behind}**\n\n`);
            }

            if (info.isDirty) {
                md.appendMarkdown(`$(warning) Uncommitted changes\n\n`);
            }
        } else {
            md.appendMarkdown(`$(circle-slash) Not a git repository\n\n`);
        }

        return md;
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
