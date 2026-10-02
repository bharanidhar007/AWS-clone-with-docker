const API = {
  async _req(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch('/api' + path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const msg = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  },
  get(path) { return this._req('GET', path); },
  post(path, body) { return this._req('POST', path, body === undefined ? {} : body); },
  del(path) { return this._req('DELETE', path); },
};

let state = { vpcs: [], subnets: [], rtbs: [], igws: [], natgws: [], eips: [], sgs: [], instances: [], volumes: [],
  keypairs: [], buckets: [], albs: [], targetGroups: [], launchTemplates: [], asgs: [], regions: [], region: 'us-east-1' };

async function refreshState() {
  state = await API.get('/state?region=' + encodeURIComponent(currentRegion()));
  return state;
}

function currentRegion() {
  return localStorage.getItem('sandbox_region') || 'us-east-1';
}
function setRegion(code) {
  try { localStorage.setItem('sandbox_region', code); } catch (e) {}
}

// Wraps an async submit/action handler: runs it, refreshes state, and
// surfaces backend validation errors as a toast instead of a crash.
async function runAction(fn) {
  try {
    await fn();
    await refreshState();
    return true;
  } catch (e) {
    toast(e.message || String(e), true);
    return false;
  }
}
