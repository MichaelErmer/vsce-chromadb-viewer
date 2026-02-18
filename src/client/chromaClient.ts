function generateId() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

export type ChromaRecord = { id: string; document?: string; metadata?: any; embedding?: number[] };

export class ChromaDbClient {
  private connected = false;
  private config: any = {};
  private mockData: any;

  constructor() {
    // keep mock data as fallback and for initial UI
    this.mockData = {
      tenants: [
        {
          name: 'default_tenant',
          databases: [
            {
              name: 'default_database',
              collections: [
                {
                  name: 'example_collection',
                  records: [
                    { id: 'r1', document: 'Hello world', metadata: { source: 'demo' }, embedding: [0.1, 0.2] },
                    { id: 'r2', document: 'Sample doc', metadata: { source: 'demo' }, embedding: [0.3, 0.4] },
                    { id: 'r3', document: 'Another doc', metadata: { source: 'demo' }, embedding: [0.5, 0.6] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
  }

  private baseApiPath() {
    const cfg = this.config || {};
    let host = cfg.host || 'localhost';
    if (!host.startsWith('http')) {
      const proto = cfg.ssl ? 'https' : 'http';
      const port = cfg.port ? `:${cfg.port}` : '';
      host = `${proto}://${host}${port}`;
    }
    // ensure no trailing slash
    host = host.replace(/\/$/, '');
    return `${host}/api/v2`;
  }

  private async request(path: string, method = 'GET', body?: any) {
    const url = `${this.baseApiPath()}${path}`;
    const headers: any = { 'content-type': 'application/json' };
    if (this.config?.apiKey) { headers['x-chroma-token'] = this.config.apiKey; }
    const fetchFn: any = (globalThis as any).fetch;
    if (!fetchFn) { throw new Error('fetch is not available in this runtime'); }
    const res = await fetchFn(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`${method} ${url} -> ${res.status} ${res.statusText} ${txt}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return res.json();
    }
    return res.text();
  }

  async connect(cfg: { host?: string; port?: number; ssl?: boolean; tenant?: string; database?: string; apiKey?: string }) {
    this.config = cfg || {};
    // quick health check against /version to validate connection
    try {
      await this.request('/version', 'GET');
      this.connected = true;
      return true;
    } catch (err) {
      // don't throw — keep mock available; caller can check isConnected()
      this.connected = false;
      return false;
    }
  }

  isConnected() {
    return this.connected;
  }

  async listTenants() {
    if (!this.connected) { return this.mockData.tenants.map((t: any) => t.name); }
    try {
      const json = await this.request('/tenants', 'GET');
      if (Array.isArray(json)) { return json.map((t: any) => (typeof t === 'string' ? t : t.name || t.id)); }
      if (json?.tenants) { return json.tenants.map((t: any) => t.name || t); }
      return [this.config.tenant || 'default_tenant'];
    } catch (err) {
      return [this.config.tenant || 'default_tenant'];
    }
  }

  async listDatabases(tenant?: string) {
    if (!this.connected) {
      const t = this.mockData.tenants.find((x: any) => x.name === tenant) || this.mockData.tenants[0];
      return (t?.databases || []).map((d: any) => d.name);
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    try {
      const json = await this.request(`/tenants/${tName}/databases`, 'GET');
      if (Array.isArray(json)) { return json.map((d: any) => (typeof d === 'string' ? d : d.name)); }
      if (json?.databases) { return json.databases.map((d: any) => d.name || d.id || d); }
      return [];
    } catch (err) {
      return [];
    }
  }

  async listCollections(tenant?: string, database?: string) {
    if (!this.connected) {
      const t = this.mockData.tenants.find((x: any) => x.name === tenant) || this.mockData.tenants[0];
      const d = (t?.databases || []).find((x: any) => x.name === database) || (t?.databases || [])[0];
      return (d?.collections || []).map((c: any) => ({ id: c.id || c.name, name: c.name, count: (c.records || []).length }));
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    try {
      const json = await this.request(`/tenants/${tName}/databases/${dbName}/collections`, 'GET');
      if (!Array.isArray(json)) { return []; }
      // normalize to { id, name, count }
      return json.map((c: any) => ({ id: c.id ?? c.name ?? c, name: c.name ?? c.id ?? c, count: c.count ?? 0 }));
    } catch (err) {
      return [];
    }
  }

  private async resolveCollectionId(tenant: string | undefined, database: string | undefined, collectionOrId: string) {
    if (!this.connected) { return collectionOrId; }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    try {
      const list = await this.request(`/tenants/${tName}/databases/${dbName}/collections`, 'GET');
      if (!Array.isArray(list)) { return collectionOrId; }
      for (const item of list) {
        if (typeof item === 'string') {
          if (item === collectionOrId) return item;
        } else if (item && (item.id === collectionOrId || item.name === collectionOrId)) {
          return item.id ?? item.name;
        } else if (item && item.name === collectionOrId && item.id) {
          return item.id;
        }
      }
    } catch (err) {
      // ignore and fallback
    }
    return collectionOrId;
  }

  async createCollection(tenant: string | undefined, database: string | undefined, name: string) {
    if (!this.connected) {
      const t = this.mockData.tenants[0];
      const d = t.databases[0];
      d.collections.push({ name, records: [] });
      return true;
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    try {
      await this.request(`/tenants/${tName}/databases/${dbName}/collections`, 'POST', { name });
      return true;
    } catch (err) {
      throw err;
    }
  }

  async deleteCollection(tenant: string | undefined, database: string | undefined, name: string) {
    if (!this.connected) {
      const t = this.mockData.tenants[0];
      const d = t.databases[0];
      d.collections = d.collections.filter((c: any) => c.name !== name);
      return true;
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    const colName = encodeURIComponent(name);
    try {
      await this.request(`/tenants/${tName}/databases/${dbName}/collections/${colName}`, 'DELETE');
      return true;
    } catch (err) {
      throw err;
    }
  }

  async listRecords(tenant: string | undefined, database: string | undefined, collection: string, limit = 50, offset = 0) {
    if (!this.connected) {
      const t = this.mockData.tenants[0];
      const d = t.databases[0];
      const c = d.collections.find((x: any) => x.name === collection) || d.collections[0];
      return (c.records || []).slice(offset, offset + limit) as ChromaRecord[];
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    const resolved = await this.resolveCollectionId(tenant, database, collection);
    const colName = encodeURIComponent(resolved);
    try {
      // use /get for listing (more widely supported)
      const json = await this.request(`/tenants/${tName}/databases/${dbName}/collections/${colName}/get`, 'POST', { limit, offset, include: ['documents', 'metadatas', 'embeddings'] });
      if (!json) { return []; }
      const ids = json.ids || json.data?.ids || [];
      const docs = json.documents || json.data?.documents || [];
      const metas = json.metadatas || json.data?.metadatas || [];
      const embs = json.embeddings || json.data?.embeddings || [];
      const out: ChromaRecord[] = [];
      for (let i = 0; i < ids.length; i++) {
        out.push({ id: ids[i], document: docs[i], metadata: metas[i], embedding: embs[i] });
      }
      return out;
    } catch (err) {
      return [];
    }
  }

  async addRecord(tenant: string | undefined, database: string | undefined, collection: string, record: Partial<ChromaRecord>) {
    if (!this.connected) {
      const t = this.mockData.tenants[0];
      const d = t.databases[0];
      const c = d.collections.find((x: any) => x.name === collection);
      const id = record.id || generateId();
      const mockEmbedding = (Array.isArray(record.embedding) && record.embedding.length > 0) ? record.embedding : [0.0];
      c.records.push({ id, document: record.document || '', metadata: record.metadata || {}, embedding: mockEmbedding });
      return id;
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    const resolved = await this.resolveCollectionId(tenant, database, collection);
    const colName = encodeURIComponent(resolved);
    const id = record.id || generateId();
    // include embeddings field (server requires at least one-dimension embedding); default to [0.0] when not provided
    const embeddingToSend = (Array.isArray(record.embedding) && record.embedding.length > 0) ? record.embedding : [0.0];
    const body: any = { ids: [id], documents: [record.document || ''], metadatas: [record.metadata || {}], embeddings: [embeddingToSend] };
    try {
      await this.request(`/tenants/${tName}/databases/${dbName}/collections/${colName}/add`, 'POST', body);
      return id;
    } catch (err) {
      throw err;
    }
  }

  async getRecord(tenant: string | undefined, database: string | undefined, collection: string, id: string) {
    if (!this.connected) {
      const recs = await this.listRecords(tenant, database, collection);
      return recs.find((r: any) => r.id === id);
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    const resolved = await this.resolveCollectionId(tenant, database, collection);
    const colName = encodeURIComponent(resolved);
    try {
      const json = await this.request(`/tenants/${tName}/databases/${dbName}/collections/${colName}/get`, 'POST', { ids: [id], include: ['metadatas', 'documents', 'embeddings'] });
      const ids = json.ids || [];
      if (!ids.length) { return undefined; }
      return { id: ids[0], document: (json.documents || [])[0], metadata: (json.metadatas || [])[0], embedding: (json.embeddings || [])[0] } as ChromaRecord;
    } catch (err) {
      return undefined;
    }
  }

  async queryCollection(tenant: string | undefined, database: string | undefined, collection: string, opts: { queryTexts?: string[]; queryEmbeddings?: number[][]; nResults?: number }) {
    if (!this.connected) { return []; }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    const colName = encodeURIComponent(collection);
    const body: any = {};
    if (opts.queryTexts) body.queryTexts = opts.queryTexts;
    if (opts.queryEmbeddings) body.queryEmbeddings = opts.queryEmbeddings;
    body.n_results = opts.nResults || 5;
    try {
      const json = await this.request(`/tenants/${tName}/databases/${dbName}/collections/${colName}/query`, 'POST', body);
      return json;
    } catch (err) {
      return [];
    }
  }

  // tenant / database management
  async createTenant(name: string) {
    if (!this.connected) {
      this.mockData.tenants.push({ name, databases: [] });
      return true;
    }
    try {
      await this.request(`/tenants`, 'POST', { name });
      return true;
    } catch (err) {
      throw err;
    }
  }

  async deleteTenant(name: string) {
    if (!this.connected) {
      this.mockData.tenants = this.mockData.tenants.filter((t: any) => t.name !== name);
      return true;
    }
    try {
      const tName = encodeURIComponent(name);
      await this.request(`/tenants/${tName}`, 'DELETE');
      return true;
    } catch (err) {
      throw err;
    }
  }

  async createDatabase(tenant: string, name: string) {
    if (!this.connected) {
      const t = this.mockData.tenants.find((x: any) => x.name === tenant) || this.mockData.tenants[0];
      t.databases.push({ name, collections: [] });
      return true;
    }
    try {
      const tName = encodeURIComponent(tenant);
      await this.request(`/tenants/${tName}/databases`, 'POST', { name });
      return true;
    } catch (err) {
      throw err;
    }
  }

  async deleteDatabase(tenant: string, name: string) {
    if (!this.connected) {
      const t = this.mockData.tenants.find((x: any) => x.name === tenant) || this.mockData.tenants[0];
      t.databases = (t.databases || []).filter((d: any) => d.name !== name);
      return true;
    }
    try {
      const tName = encodeURIComponent(tenant);
      const dbName = encodeURIComponent(name);
      await this.request(`/tenants/${tName}/databases/${dbName}`, 'DELETE');
      return true;
    } catch (err) {
      throw err;
    }
  }

  // collection rename
  async renameCollection(tenant: string | undefined, database: string | undefined, oldName: string, newName: string) {
    if (!this.connected) {
      const t = this.mockData.tenants[0];
      const d = t.databases[0];
      const c = d.collections.find((x: any) => x.name === oldName);
      if (c) { c.name = newName; }
      return true;
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    // resolve collection id first (server expects UUID id, not human name)
    const resolved = await this.resolveCollectionId(tenant, database, oldName);
    const colName = encodeURIComponent(resolved);
    try {
      await this.request(`/tenants/${tName}/databases/${dbName}/collections/${colName}`, 'PUT', { name: newName });
      return true;
    } catch (err) {
      throw err;
    }
  }

  // record update/delete
  async updateRecord(tenant: string | undefined, database: string | undefined, collection: string, record: Partial<ChromaRecord>) {
    if (!this.connected) {
      const t = this.mockData.tenants[0];
      const d = t.databases[0];
      const c = d.collections.find((x: any) => x.name === collection);
      const idx = (c.records || []).findIndex((r: any) => r.id === record.id);
      if (idx >= 0) {
        c.records[idx] = { ...c.records[idx], document: record.document ?? c.records[idx].document, metadata: record.metadata ?? c.records[idx].metadata, embedding: record.embedding ?? c.records[idx].embedding };
        return true;
      }
      return false;
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    const resolved = await this.resolveCollectionId(tenant, database, collection);
    const colName = encodeURIComponent(resolved);
    const body: any = { ids: [record.id] };
    if (record.document !== undefined) body.documents = [record.document];
    if (record.metadata !== undefined) body.metadatas = [record.metadata];
    if (record.embedding !== undefined) body.embeddings = [record.embedding];
    try {
      await this.request(`/tenants/${tName}/databases/${dbName}/collections/${colName}/update`, 'POST', body);
      return true;
    } catch (err) {
      throw err;
    }
  }

  async deleteRecord(tenant: string | undefined, database: string | undefined, collection: string, id: string) {
    if (!this.connected) {
      const t = this.mockData.tenants[0];
      const d = t.databases[0];
      const c = d.collections.find((x: any) => x.name === collection);
      c.records = (c.records || []).filter((r: any) => r.id !== id);
      return true;
    }
    const tName = encodeURIComponent(tenant || this.config.tenant || 'default_tenant');
    const dbName = encodeURIComponent(database || this.config.database || 'default_database');
    const resolved = await this.resolveCollectionId(tenant, database, collection);
    const colName = encodeURIComponent(resolved);
    try {
      await this.request(`/tenants/${tName}/databases/${dbName}/collections/${colName}/delete`, 'POST', { ids: [id] });
      return true;
    } catch (err) {
      throw err;
    }
  }
}
