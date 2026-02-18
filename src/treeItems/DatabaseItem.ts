import * as vscode from 'vscode';

export class DatabaseItem extends vscode.TreeItem {
  constructor(public readonly name: string) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'database';
    this.iconPath = new vscode.ThemeIcon('database');
  }
}
