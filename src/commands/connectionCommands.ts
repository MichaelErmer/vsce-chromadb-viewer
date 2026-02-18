import * as vscode from 'vscode';
import { ChromaTreeProvider } from '../providers/chromaTreeProvider';

export function registerConnectionCommands(context: vscode.ExtensionContext, provider: ChromaTreeProvider) {
  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.connect', async () => {
      const cfg = vscode.workspace.getConfiguration('chromadb');
      const host = await vscode.window.showInputBox({ prompt: 'Chroma host', value: cfg.get<string>('host') || 'localhost' });
      if (!host) { return; }
      const portStr = await vscode.window.showInputBox({ prompt: 'Chroma port', value: String(cfg.get<number>('port') || 8000) });
      const port = portStr ? Number(portStr) : 8000;
      const tenant = await vscode.window.showInputBox({ prompt: 'Tenant', value: cfg.get<string>('tenant') || 'default_tenant' });
      const database = await vscode.window.showInputBox({ prompt: 'Database', value: cfg.get<string>('database') || 'default_database' });

      await provider.client.connect({ host, port, tenant, database });
      vscode.window.showInformationMessage(`Connected to ${host}:${port} (${tenant}/${database})`);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.refresh', async () => {
      provider.refresh();
      vscode.window.showInformationMessage('ChromaDB: refreshed');
    })
  );
}
