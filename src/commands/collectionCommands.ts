import * as vscode from 'vscode';
import { ChromaTreeProvider } from '../providers/chromaTreeProvider';

export function registerCollectionCommands(context: vscode.ExtensionContext, provider: ChromaTreeProvider) {
  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.createCollection', async (node) => {
      const cfg = vscode.workspace.getConfiguration('chromadb');
      const tenant = cfg.get<string>('tenant') || 'default_tenant';
      // accept DatabaseItem.name OR TreeItem.label as fallback
      const nodeDb = (node && (node as any).name) ? (node as any).name : (node && (node as any).label ? String((node as any).label) : undefined);
      const database = nodeDb ? String(nodeDb).split(' ')[0] : cfg.get<string>('database') || 'default_database';
      const name = await vscode.window.showInputBox({ prompt: `Create collection in database '${database}'`, placeHolder: 'collection-name' });
      if (!name) { return; }
      await provider.client.createCollection(tenant, database, name);
      vscode.window.showInformationMessage(`Collection '${name}' created in database '${database}'`);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.deleteCollection', async (node) => {
      if (!node) { return; }
      const name = node.name?.split(' ')[0] || node.label;
      const cfg = vscode.workspace.getConfiguration('chromadb');
      const tenant = cfg.get<string>('tenant') || 'default_tenant';
      // prefer parentDatabaseName when available on the CollectionItem
      const database = (node && (node as any).parentDatabaseName) ? (node as any).parentDatabaseName : (cfg.get<string>('database') || 'default_database');
      const ok = await vscode.window.showWarningMessage(`Delete collection '${name}' from database '${database}'?`, { modal: true }, 'Delete');
      if (ok !== 'Delete') { return; }
      await provider.client.deleteCollection(tenant, database, name);
      vscode.window.showInformationMessage(`Collection '${name}' deleted from '${database}'`);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.renameCollection', async (node) => {
      if (!node) { return; }
      const oldName = node.name?.split(' ')[0] || node.label;
      const cfg = vscode.workspace.getConfiguration('chromadb');
      const tenant = cfg.get<string>('tenant') || 'default_tenant';
      const database = (node && (node as any).parentDatabaseName) ? (node as any).parentDatabaseName : (cfg.get<string>('database') || 'default_database');
      const newName = await vscode.window.showInputBox({ prompt: `Rename collection '${oldName}' in '${database}'`, value: oldName });
      if (!newName || newName === oldName) { return; }
      await provider.client.renameCollection(tenant, database, oldName, newName);
      vscode.window.showInformationMessage(`Collection '${oldName}' renamed to '${newName}'`);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chromadb.queryCollection', async (node) => {
      const cfg = vscode.workspace.getConfiguration('chromadb');
      const tenant = cfg.get<string>('tenant') || 'default_tenant';
      const database = cfg.get<string>('database') || 'default_database';
      const collection = node && node.name ? node.name.split(' ')[0] : await vscode.window.showInputBox({ prompt: 'Collection name' });
      if (!collection) { return; }
      const q = await vscode.window.showInputBox({ prompt: 'Query text' });
      if (!q) { return; }
      const res = await provider.client.queryCollection(tenant, database, collection, { queryTexts: [q], nResults: 5 });
      // try to normalize results
      const items: vscode.QuickPickItem[] = [];
      if (res?.ids && Array.isArray(res.ids)) {
        const docs = res.documents || [];
        for (let i = 0; i < res.ids.length; i++) {
          items.push({ label: String(res.ids[i]), description: (docs[i] || '').slice(0, 120) });
        }
      } else if (Array.isArray(res)) {
        for (const r of res) { items.push({ label: String(r.id || r.ids || ''), description: JSON.stringify(r).slice(0, 120) }); }
      } else {
        items.push({ label: 'Results', description: JSON.stringify(res).slice(0, 120) });
      }
      const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Query results' });
      if (pick) { vscode.window.showInformationMessage(`Picked: ${pick.label}`); }
    })
  );
}
