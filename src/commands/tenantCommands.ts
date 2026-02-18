import * as vscode from 'vscode';
import { ChromaTreeProvider } from '../providers/chromaTreeProvider';

export function registerTenantCommands(context: vscode.ExtensionContext, provider: ChromaTreeProvider) {
  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.createTenant', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'New tenant name' });
      if (!name) { return; }
      await provider.client.createTenant(name);
      vscode.window.showInformationMessage(`Tenant '${name}' created`);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.deleteTenant', async (node) => {
      const tenant = node && node.name ? node.name : await vscode.window.showInputBox({ prompt: 'Tenant to delete' });
      if (!tenant) { return; }
      const ok = await vscode.window.showWarningMessage(`Delete tenant '${tenant}'? This is irreversible.`, { modal: true }, 'Delete');
      if (ok !== 'Delete') { return; }
      await provider.client.deleteTenant(tenant);
      vscode.window.showInformationMessage(`Tenant '${tenant}' deleted`);
      provider.refresh();
    })
  );
}
