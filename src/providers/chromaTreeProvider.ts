import * as vscode from 'vscode';
import { ChromaDbClient } from '../client/chromaClient';
import { TenantItem } from '../treeItems/TenantItem';
import { DatabaseItem } from '../treeItems/DatabaseItem';
import { CollectionItem } from '../treeItems/CollectionItem';
import { RecordItem } from '../treeItems/RecordItem';

export class ChromaTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  public client = new ChromaDbClient();
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // top-level: if not connected show a connect prompt instead of mock data
    if (!element) {
      if (!this.client.isConnected()) {
        const { NotConnectedItem } = await import('../treeItems/NotConnectedItem');
        return [new NotConnectedItem()];
      }

      // connected → configured tenant is the root
      const cfg = vscode.workspace.getConfiguration('chromadb');
      const tenant = cfg.get<string>('tenant') || 'default_tenant';
      return [new TenantItem(tenant)];
    }

    // tenant -> databases
    if (element instanceof TenantItem) {
      const tenantName = element.name;
      const dbs = await this.client.listDatabases(tenantName);
      return dbs.map((d: string) => new DatabaseItem(d));
    }

    // database -> collections
    if (element instanceof DatabaseItem) {
      const dbName = element.name;
      // use default tenant from settings for now
      const cfg = vscode.workspace.getConfiguration('chromadb');
      const tenant = cfg.get<string>('tenant') || 'default_tenant';
      const cols = await this.client.listCollections(tenant, dbName);
      return cols.map((c: any) => new CollectionItem(c.name, c.count || 0, dbName));
    }

    // database -> collections
    if (element instanceof DatabaseItem) {
      const dbName = element.name;
      // use default tenant from settings for now
      const cfg = vscode.workspace.getConfiguration('chromadb');
      const tenant = cfg.get<string>('tenant') || 'default_tenant';
      const cols = await this.client.listCollections(tenant, dbName);
      return cols.map((c: any) => new CollectionItem(c.name, c.count || 0, dbName));
    }

    // collection -> records
    if (element instanceof CollectionItem) {
      const cfg = vscode.workspace.getConfiguration('chromadb');
      const tenant = cfg.get<string>('tenant') || 'default_tenant';
      const database = cfg.get<string>('database') || 'default_database';
      const collName = element.name.split(' ')[0]; // name (count)
      const recs = await this.client.listRecords(tenant, database, collName, 50, 0);
      return recs.map((r: any) => new RecordItem(r.id, r.document, collName));
    }

    return [];
  }
}
