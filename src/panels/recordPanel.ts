import * as vscode from 'vscode';

export class RecordPanel {
  public static currentPanel: vscode.WebviewPanel | undefined;

  public static createOrShow(extensionUri: vscode.Uri, record: any) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    if (RecordPanel.currentPanel) {
      RecordPanel.currentPanel.reveal(column);
      RecordPanel.currentPanel.webview.postMessage({ type: 'set', record });
      return;
    }

    const panel = vscode.window.createWebviewPanel('chromadb.record', `Record: ${record.id}`, column || vscode.ViewColumn.One, {
      enableScripts: true
    });

    panel.webview.html = RecordPanel.getHtml(record);

    // external code (command handlers) can listen to panel.webview.onDidReceiveMessage

    panel.onDidDispose(() => {
      RecordPanel.currentPanel = undefined;
    });

    RecordPanel.currentPanel = panel;
  }

  private static getHtml(record: any) {
    const escaped = JSON.stringify(record, null, 2).replace(/</g, '&lt;');
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Record</title>
    <style>body{font-family:Segoe UI,Arial;padding:12px}textarea{width:100%;height:60vh;font-family:monospace}</style>
  </head>
  <body>
    <h2>Record: ${record.id}</h2>
    <form>
      <label>JSON</label>
      <textarea id="payload">${escaped}</textarea>
      <div style="margin-top:8px">
        <button type="button" id="save">Save</button>
        <button type="button" id="delete">Delete</button>
      </div>
    </form>
    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('save').addEventListener('click', ()=>{
        const payload = document.getElementById('payload').value;
        try { JSON.parse(payload); vscode.postMessage({type:'save', payload}); } catch(e){ alert('Invalid JSON'); }
      });
      document.getElementById('delete').addEventListener('click', ()=>{ if(confirm('Delete?')) vscode.postMessage({type:'delete'}); });
    </script>
  </body>
</html>`;
  }
}
