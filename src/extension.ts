import * as vscode from 'vscode';
import { ChromaTreeProvider } from './providers/chromaTreeProvider';
import { registerConnectionCommands } from './commands/connectionCommands';
import { registerCollectionCommands } from './commands/collectionCommands';
import { registerRecordCommands } from './commands/recordCommands';
import { registerTenantCommands } from './commands/tenantCommands';
import { registerDatabaseCommands } from './commands/databaseCommands';

export async function activate(context: vscode.ExtensionContext) {
  const provider = new ChromaTreeProvider(context);
  const view = vscode.window.createTreeView('chromadbViewer', { treeDataProvider: provider });

  // connection webview (placed above the tree)
  const connectionView = new (await import('./providers/connectionViewProvider')).ConnectionViewProvider(context, provider);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('chromadbConnection', connectionView));

  registerConnectionCommands(context, provider);
  registerTenantCommands(context, provider);
  registerDatabaseCommands(context, provider);
  registerCollectionCommands(context, provider);
  registerRecordCommands(context, provider);

  context.subscriptions.push(view);
  vscode.window.setStatusBarMessage('ChromaDB Viewer ready', 3000);
}

export function deactivate() {}
