// Minimal AiAdapter for the ADHDashboard to talk to the AI-Forge POC daemon.
// Assumes the POC daemon is running on 127.0.0.1:3000 and uses the dev-local-token.
// This file intentionally keeps a tiny, stable surface so the dashboard can
// feature-detect a local orchestrator without coupling to implementation details.
(function(){
  const LOCAL_URL = (window.__AI_FORGE_LOCAL_URL__ || localStorage.getItem('adhd4_local_ai_url') || 'http://127.0.0.1:3000') + '/api/v1';
  const LOCAL_TOKEN = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || 'dev-local-token';

  async function jsonFetch(path, body, method = 'POST'){
    const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || 'dev-local-token';
    const opts = { method, headers: { 'Content-Type': 'application/json', 'x-local-token': token } };
    if (method === 'POST') opts.body = JSON.stringify(body || {});
    const res = await fetch(LOCAL_URL + path, opts);
    if (!res.ok) {
      const txt = await res.text().catch(()=>'');
      throw new Error(`HTTP ${res.status} ${txt}`);
    }
    return res.json();
  }

  window.AiAdapter = {
    async isAvailable(){
      try {
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || LOCAL_TOKEN;
        const res = await fetch(LOCAL_URL + '/health', { headers: token ? { 'x-local-token': token } : {} });
        if (!res.ok) return false;
        const j = await res.json();
        return !!(j && j.ok && j.available);
      } catch (e) { return false; }
    },
    async buildGraph(opts){
      return await jsonFetch('/build-graph', opts, 'POST');
    },
    async route(packet){
      return await jsonFetch('/route', { packet }, 'POST');
    },
    async executeGraph(graph, mode='sequential', onEvent=null){
      // open a streaming connection to the daemon and parse chunked JSON events
      const url = LOCAL_URL + '/execute-graph';
      const body = { graph, mode };
      const controller = new AbortController();
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || 'dev-local-token';
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-local-token': token }, body: JSON.stringify(body), signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      async function readLoop(){
        while(true){
          const r = await reader.read();
          if (r.done) break;
          buf += decoder.decode(r.value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();
          for(const p of parts){
            if (!p.trim()) continue;
            try{ const obj = JSON.parse(p); if (typeof onEvent === 'function') onEvent(obj); }catch(e){ /* ignore parse errors */ }
          }
        }
        if (buf.trim()) { try{ const obj = JSON.parse(buf); if (typeof onEvent === 'function') onEvent(obj); }catch(e){} }
      }
      readLoop().catch((e)=>{ if (typeof onEvent === 'function') onEvent({ type: 'error', error: String(e) }); });
      return { abort: () => controller.abort() };
    },
    async previewNode(graph, nodeId, opts = {}){
      return await jsonFetch('/preview-node', { graph, nodeId, options: opts }, 'POST');
    },
    async createConversation(opts = {}){
      return await jsonFetch('/conversations', opts, 'POST');
    },
    async listConversations(){
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || LOCAL_TOKEN;
      const res = await fetch(LOCAL_URL + '/conversations', { method: 'GET', headers: token ? { 'x-local-token': token } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async getConversationMessages(conversationId){
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || LOCAL_TOKEN;
      const res = await fetch(LOCAL_URL + `/conversations/${conversationId}/messages`, { method: 'GET', headers: token ? { 'x-local-token': token } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async postConversationMessage(conversationId, body){
      return await jsonFetch(`/conversations/${conversationId}/messages`, body, 'POST');
    },
      async uploadAttachment(file, conversationId = null){
        // file: File object (browser). Convert to base64 and POST to /upload
        function fileToBase64(f){
          return new Promise((resolve,reject)=>{
            const reader = new FileReader();
            reader.onload = () => {
              const s = reader.result || '';
              // data:<type>;base64,<b64>
              const parts = String(s).split(',');
              resolve(parts.length>1?parts[1]:parts[0]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(f);
          });
        }
        const b64 = await fileToBase64(file);
        return await jsonFetch('/upload', { conversationId, filename: file.name, contentBase64: b64, contentType: file.type || 'application/octet-stream' }, 'POST');
      },
      async getAttachmentMeta(attachmentId){
        return await jsonFetch(`/attachments/${attachmentId}/meta`, {}, 'GET');
      },
      async downloadAttachment(attachmentId){
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || LOCAL_TOKEN;
        const res = await fetch(LOCAL_URL + `/download/${attachmentId}`, { method: 'GET', headers: token ? { 'x-local-token': token } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.blob();
      },
      async listAllAttachments(){
        return await jsonFetch('/attachments', {}, 'GET');
      },
      async addAttachmentTag(attachmentId, tag){
        return await jsonFetch(`/attachments/${attachmentId}/tags`, { tag }, 'POST');
      },
      async removeAttachmentTag(attachmentId, tag){
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || LOCAL_TOKEN;
        const encoded = encodeURIComponent(String(tag));
        const res = await fetch(LOCAL_URL + `/attachments/${attachmentId}/tags/${encoded}`, { method: 'DELETE', headers: token ? { 'x-local-token': token } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      },
      async renameAttachment(attachmentId, filename){
        return await jsonFetch(`/attachments/${attachmentId}/rename`, { filename }, 'POST');
      },
      async deleteAttachment(attachmentId){
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || LOCAL_TOKEN;
        const res = await fetch(LOCAL_URL + `/attachments/${attachmentId}`, { method: 'DELETE', headers: token ? { 'x-local-token': token } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      },
      async moveAttachment(attachmentId, destName){
        return await jsonFetch(`/attachments/${attachmentId}/move`, { destName }, 'POST');
      },
      async compareAttachments(idA, idB){
        return await jsonFetch('/attachments/compare', { idA, idB }, 'POST');
      },
      async repairAttachment(attachmentId, opts = { apply: false }){
        return await jsonFetch(`/attachments/${attachmentId}/repair`, opts, 'POST');
      },
      async listCheckpoints(){
        return await jsonFetch('/checkpoints', {}, 'GET');
      },
      async getCheckpoint(nodeId){
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || LOCAL_TOKEN;
        const res = await fetch(LOCAL_URL + `/checkpoints/${encodeURIComponent(nodeId)}`, { method: 'GET', headers: token ? { 'x-local-token': token } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      },
      async rollbackNode(nodeId){
        return await jsonFetch(`/nodes/${encodeURIComponent(nodeId)}/rollback`, {}, 'POST');
      },
    async executeNode(graph, nodeId, opts = {}){
      return await jsonFetch('/execute-node', { graph, nodeId, options: opts }, 'POST');
    },
    url: LOCAL_URL,
    token: LOCAL_TOKEN,
  };
})();
