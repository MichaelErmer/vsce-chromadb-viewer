import * as vscode from 'vscode';

export class ConnectionItem extends vscode.TreeItem {
  constructor(public readonly labelStr: string) {
    super(labelStr, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'connection';
    this.iconPath = new vscode.ThemeIcon('cloud');
    this.tooltip = `Connection: ${labelStr}`;
  }
}
