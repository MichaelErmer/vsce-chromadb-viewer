import * as vscode from 'vscode';

export class RecordItem extends vscode.TreeItem {
  constructor(public readonly id: string, public readonly doc?: string, public readonly parentCollectionName?: string) {
    super(id, vscode.TreeItemCollapsibleState.None);
    this.description = doc ? (doc.length > 60 ? doc.slice(0, 57) + '...' : doc) : '';
    this.contextValue = 'record';
    this.iconPath = new vscode.ThemeIcon('symbol-field');
  }
}
