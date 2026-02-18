import * as vscode from 'vscode';

export class TenantItem extends vscode.TreeItem {
  constructor(public readonly name: string) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'tenant';
    this.iconPath = new vscode.ThemeIcon('organization');
  }
}
