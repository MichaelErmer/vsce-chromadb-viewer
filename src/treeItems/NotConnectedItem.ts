import * as vscode from 'vscode';

export class NotConnectedItem extends vscode.TreeItem {
  constructor() {
    super('Not connected — click to connect', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'notConnected';
    this.iconPath = new vscode.ThemeIcon('plug');
    this.command = { command: 'chromadb.connect', title: 'Connect' };
  }
}
