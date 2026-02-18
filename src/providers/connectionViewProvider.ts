import * as vscode from 'vscode';
import { ChromaTreeProvider } from './chromaTreeProvider';

export class ConnectionViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'chromadbConnection';
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext, private readonly treeProvider: ChromaTreeProvider) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg?.type === 'connect') {
          let url = String(msg.url || '').trim();
          if (!url) { return; }
          if (!/^https?:\/\//i.test(url)) { url = 'http://' + url; }
          const parsed = new URL(url);
          const host = parsed.hostname;
          const port = parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 8000);
          const ssl = parsed.protocol === 'https:';

          // attempt connect using existing tenant/database settings (do NOT overwrite settings on connect)
          const cfg = vscode.workspace.getConfiguration('chromadb');
          const tenant = cfg.get<string>('tenant') || 'default_tenant';
          const database = cfg.get<string>('database') || 'default_database';

          const ok = await this.treeProvider.client.connect({ host, port, ssl, tenant, database });
          if (ok) {
            vscode.window.showInformationMessage(`Connected to ${host}:${port} (${tenant}/${database})`);
            this.treeProvider.refresh();
            this._view?.webview.postMessage({ type: 'status', status: 'connected', url });
          } else {
            vscode.window.showErrorMessage(`Failed to connect to ${host}:${port}`);
            this._view?.webview.postMessage({ type: 'status', status: 'failed', url });
          }
        }

        if (msg?.type === 'saveSettings') {
          let url = String(msg.url || '').trim();
          const tenantVal = String(msg.tenant || '').trim();
          if (!url) { return; }
          if (!/^https?:\/\//i.test(url)) { url = 'http://' + url; }
          const parsed = new URL(url);
          const host = parsed.hostname;
          const port = parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 8000);
          const ssl = parsed.protocol === 'https:';

          const cfg = vscode.workspace.getConfiguration('chromadb');
          await cfg.update('host', host, vscode.ConfigurationTarget.Global);
          await cfg.update('port', port, vscode.ConfigurationTarget.Global);
          await cfg.update('ssl', ssl, vscode.ConfigurationTarget.Global);
          if (tenantVal) {
            await cfg.update('tenant', tenantVal, vscode.ConfigurationTarget.Global);
          }
          vscode.window.showInformationMessage(`Saved connection settings: ${host}:${port} (tenant: ${tenantVal || cfg.get('tenant')})`);
          this.treeProvider.refresh();
          this._view?.webview.postMessage({ type: 'status', status: 'saved', url });
        }
      } catch (err) {
        vscode.window.showErrorMessage(String(err));
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const cfg = vscode.workspace.getConfiguration('chromadb');
    const host = cfg.get<string>('host') || 'localhost';
    const port = cfg.get<number>('port') || 8000;
    const ssl = cfg.get<boolean>('ssl') ? 'https' : 'http';
    const tenant = cfg.get<string>('tenant') || 'default_tenant';
    const defaultUrl = `${ssl}://${host}${port ? `:${port}` : ''}`;

    const nonce = Date.now().toString(36);
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html,body{height:100%}
      body{display:flex;flex-direction:column;gap:8px;font-family:Segoe UI,Arial;padding:8px;color:var(--vscode-editor-foreground);background:transparent}
      .container{display:flex;flex-direction:column;gap:8px;flex:1}
      input[type=text]{width:100%;padding:6px 8px;border-radius:4px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground)}
      button{margin-top:8px;padding:6px 10px;border-radius:4px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none}
      .row{display:flex;gap:8px}
      .note{font-size:12px;color:var(--vscode-descriptionForeground);margin-top:6px}
      #status{margin-top:auto}
    </style>
  </head>
  <body>
    <div class="container">
      <div>
        <label for="url"><strong>Chroma URL</strong></label>
        <input id="url" type="text" value="${defaultUrl}" />
      </div>
      <div>
        <label for="tenant"><strong>Tenant</strong></label>
        <input id="tenant" type="text" value="${tenant}" />
      </div>
      <div class="row">
        <button id="connect">Connect</button>
        <button id="save-settings">Save in settings</button>
      </div>
      <div class="note">Enter full URL (e.g. http://localhost:8000). Connect uses the current settings (does not overwrite them). Use "Save in settings" to persist the URL and tenant.</div>
      <div id="status" class="note"></div>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const input = document.getElementById('url');
      const tenantInput = document.getElementById('tenant');
      const btn = document.getElementById('connect');
      const saveBtn = document.getElementById('save-settings');
      const status = document.getElementById('status');
      btn.addEventListener('click', ()=>{ vscode.postMessage({ type: 'connect', url: input.value }); status.textContent = 'Connecting...'; });
      saveBtn.addEventListener('click', ()=>{ vscode.postMessage({ type: 'saveSettings', url: input.value, tenant: tenantInput.value }); status.textContent = 'Saving...'; });
      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.type === 'status') {
          if (msg.status === 'connected') status.textContent = 'Connected';
          else if (msg.status === 'failed') status.textContent = 'Connection failed';
          else if (msg.status === 'saved') status.textContent = 'Settings saved';
          else status.textContent = '';
        }
      });
    </script>
  </body>
</html>`;
  }
}
