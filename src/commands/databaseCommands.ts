import * as vscode from 'vscode';
import { ChromaTreeProvider } from '../providers/chromaTreeProvider';

export function registerDatabaseCommands(context: vscode.ExtensionContext, provider: ChromaTreeProvider) {
  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.createDatabase', async (node) => {
      const cfg = vscode.workspace.getConfiguration('chromadb');
      let tenant: string;
      if (node && (node as any).contextValue === 'connection') {
        // connection root selected — fall back to configured tenant
        tenant = (cfg.get('tenant') as string) || 'default_tenant';
      } else if (node && (node as any).name) {
        // tenant node or programmatic call with { name }
        tenant = (node as any).name;
      } else {
        tenant = (cfg.get('tenant') as string) || 'default_tenant';
      }
      const name = await vscode.window.showInputBox({ prompt: `Create database under tenant '${tenant}'`, placeHolder: 'database-name' });
      if (!name) { return; }
      await provider.client.createDatabase(tenant, name);
      vscode.window.showInformationMessage(`Database '${name}' created in tenant '${tenant}'`);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.deleteDatabase', async (node) => {
      const db = node && node.name ? node.name : await vscode.window.showInputBox({ prompt: 'Database to delete' });
      if (!db) { return; }
      const tenant = vscode.workspace.getConfiguration('chromadb').get('tenant') as string || 'default_tenant';
      const ok = await vscode.window.showWarningMessage(`Delete database '${db}' in tenant '${tenant}'?`, { modal: true }, 'Delete');
      if (ok !== 'Delete') { return; }
      await provider.client.deleteDatabase(tenant, db);
      vscode.window.showInformationMessage(`Database '${db}' deleted`);
      provider.refresh();
    })
  );
}
