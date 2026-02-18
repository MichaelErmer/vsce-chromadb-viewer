import * as vscode from 'vscode';

export class CollectionItem extends vscode.TreeItem {
  constructor(public readonly name: string, public readonly count: number, public readonly parentDatabaseName?: string) {
    super(`${name} (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'collection';
    this.iconPath = new vscode.ThemeIcon('symbol-structure');
  }
}
