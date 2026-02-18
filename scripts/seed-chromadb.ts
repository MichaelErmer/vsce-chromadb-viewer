const BASE: string = process.env.CHROMA_URL ?? 'http://localhost:8000/api/v2';

async function waitForServer(url: string, timeout = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch (e) {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

type CollectionListItem = { id?: string; name?: string } | string;

function errorToString(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function post<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

async function get<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

(async function main() {
  try {
    console.log('Waiting for Chroma at', BASE);
    // use /version as a reliable readiness probe
    await waitForServer(`${BASE}/version`, 120000);
    console.log('Chroma is up — seeding test data');

    // create tenant
    try {
      await post('/tenants', { name: 'test_tenant' });
      console.log('Created tenant: test_tenant');
    } catch (err) {
      console.log('Tenant create skipped or failed (may already exist):', errorToString(err));
    }

    // create database
    try {
      await post(`/tenants/${encodeURIComponent('test_tenant')}/databases`, { name: 'test_db' });
      console.log('Created database: test_db');
    } catch (err) {
      console.log('Database create skipped or failed (may already exist):', errorToString(err));
    }

    // create collections and capture returned IDs
    const collections = ['test_collection_small', 'test_collection_big'];
    const created: Record<string, string> = {};
    for (const c of collections) {
      try {
        const resp = await post<{ id?: string; name?: string }>(`/tenants/${encodeURIComponent('test_tenant')}/databases/${encodeURIComponent('test_db')}/collections`, { name: c });
        const cid = resp?.id || resp?.name || c;
        created[c] = cid;
        console.log('Created collection:', c, '-> id:', cid);
      } catch (err) {
        console.log('Collection create skipped or failed (may already exist):', errorToString(err));
        // try to find existing collection id via list
        try {
          const list = await get<Array<CollectionListItem>>(`/tenants/${encodeURIComponent('test_tenant')}/databases/${encodeURIComponent('test_db')}/collections`);
          if (Array.isArray(list)) {
            const found = list.find((x) => (typeof x === 'string' ? x === c : (x.name === c || x.id === c || x === c)));
            if (typeof found === 'string') {
              created[c] = found;
            } else if (found && typeof found === 'object') {
              created[c] = (found.id ?? found.name) as string;
            } else {
              created[c] = c;
            }
            console.log('Resolved existing collection id for', c, '->', created[c]);
          } else {
            created[c] = c;
          }
        } catch (_) {
          created[c] = c;
        }
      }
    }

    // add a few records to small collection (use returned collection id)
    try {
      const collIdSmall = encodeURIComponent(created['test_collection_small']);
      await post(`/tenants/${encodeURIComponent('test_tenant')}/databases/${encodeURIComponent('test_db')}/collections/${collIdSmall}/add`, {
        ids: ['s1', 's2', 's3'],
        documents: ['small doc one', 'small doc two', 'small doc three'],
        metadatas: [{ tag: 'small' }, { tag: 'small' }, { tag: 'small' }],
        embeddings: [[0.1,0.2], [0.2,0.1], [0.3,0.4]]
      } as const);
      console.log('Seeded test_collection_small');
    } catch (err) {
      console.log('Seeding small collection failed:', errorToString(err));
    }

    // add many records to big collection (20) to allow pagination tests
    try {
      const collIdBig = encodeURIComponent(created['test_collection_big']);
      const ids: string[] = [];
      const docs: string[] = [];
      const metas: Array<Record<string, unknown>> = [];
      const embs: number[][] = [];
      for (let i = 1; i <= 20; i++) {
        ids.push(`b${i}`);
        docs.push(`big collection doc ${i}`);
        metas.push({ index: i });
        embs.push([Math.random(), Math.random(), Math.random()]);
      }
      await post(`/tenants/${encodeURIComponent('test_tenant')}/databases/${encodeURIComponent('test_db')}/collections/${collIdBig}/add`, {
        ids, documents: docs, metadatas: metas, embeddings: embs
      } as const);
      console.log('Seeded test_collection_big (20 records)');
    } catch (err) {
      console.log('Seeding big collection failed:', errorToString(err));
    }

    console.log('\nSeeding complete. Verify with GET', `${BASE}/tenants`);
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(2);
  }
})();