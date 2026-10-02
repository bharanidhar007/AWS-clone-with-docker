/* ============================================================
   ROUTER
   ============================================================ */
let route = { page: 'home', params: {} };
function navigate(page, params = {}) {
  route = { page, params };
  location.hash = '#/' + page + (params.id ? '/' + params.id : '');
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => {
  const parts = location.hash.replace('#/', '').split('/');
  route = { page: parts[0] || 'home', params: { id: parts[1] } };
  render();
});

function toast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function resetAll() {
  if (!confirm('Reset the entire sandbox? This deletes every resource in the database.')) return;
  await runAction(() => API.post('/reset', { region: currentRegion() }));
  navigate('home');
}

async function switchRegion(code) {
  setRegion(code);
  await refreshState();
  renderRegionLabel();
  render();
  toast('Switched to ' + regionName(code));
}
function regionName(code) {
  const r = (state.regions || []).find(r => r.code === code);
  return r ? r.name + ' (' + r.code + ')' : code;
}
function renderRegionLabel() {
  const sel = document.getElementById('region-select');
  if (sel) sel.value = currentRegion();
}

/* ============================================================
   SIDEBAR
   ============================================================ */
const SERVICES = {
  home: { name: 'Console Home', sidebar: null },
  vpc: { name: 'VPC', sidebar: [
    { sec: 'Virtual private cloud', links: [
      { id: 'vpc-list', label: 'Your VPCs' },
      { id: 'subnet-list', label: 'Subnets' },
      { id: 'rtb-list', label: 'Route tables' },
      { id: 'igw-list', label: 'Internet gateways' },
      { id: 'eip-list', label: 'Elastic IPs' },
      { id: 'nat-list', label: 'NAT gateways' },
    ]},
    { sec: 'Security', links: [{ id: 'sg-list', label: 'Security groups' }] },
  ]},
  ec2: { name: 'EC2', sidebar: [
    { sec: 'Instances', links: [{ id: 'ec2-list', label: 'Instances' }, { id: 'kp-list', label: 'Key pairs' }] },
    { sec: 'Elastic Block Store', links: [{ id: 'vol-list', label: 'Volumes' }] },
  ]},
  s3: { name: 'S3', sidebar: [{ sec: 'Amazon S3', links: [{ id: 's3-list', label: 'General purpose buckets' }] }] },
  elb: { name: 'EC2 > Load Balancing', sidebar: [
    { sec: 'Load Balancing', links: [{ id: 'alb-list', label: 'Load balancers' }, { id: 'tg-list', label: 'Target groups' }] },
  ]},
  asg: { name: 'EC2 > Auto Scaling', sidebar: [
    { sec: 'Auto Scaling', links: [{ id: 'asg-list', label: 'Auto Scaling groups' }, { id: 'lt-list', label: 'Launch templates' }] },
  ]},
};

const PAGE_SERVICE = {
  'home': 'home', 'services-menu': 'home',
  'vpc-list': 'vpc', 'vpc-create': 'vpc', 'vpc-detail': 'vpc',
  'subnet-list': 'vpc', 'subnet-create': 'vpc', 'subnet-detail': 'vpc',
  'rtb-list': 'vpc', 'rtb-create': 'vpc', 'rtb-detail': 'vpc',
  'igw-list': 'vpc', 'igw-create': 'vpc',
  'eip-list': 'vpc',
  'nat-list': 'vpc', 'nat-create': 'vpc',
  'sg-list': 'vpc', 'sg-create': 'vpc', 'sg-detail': 'vpc',
  'ec2-list': 'ec2', 'ec2-launch': 'ec2', 'ec2-detail': 'ec2', 'kp-list': 'ec2', 'kp-create': 'ec2',
  'vol-list': 'ec2', 'vol-create': 'ec2',
  's3-list': 's3', 's3-create': 's3', 's3-detail': 's3',
  'alb-list': 'elb', 'alb-create': 'elb', 'alb-detail': 'elb', 'tg-list': 'elb',
  'asg-list': 'asg', 'asg-create': 'asg', 'asg-detail': 'asg', 'lt-list': 'asg', 'lt-create': 'asg',
};

function renderSidebar() {
  const svcKey = PAGE_SERVICE[route.page] || 'home';
  const svc = SERVICES[svcKey];
  const el = document.getElementById('sidebar');
  if (!svc.sidebar) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  let html = `<div class="side-section-title" style="font-weight:700;color:#16191f;font-size:14px;text-transform:none;padding-top:4px;">${svc.name}</div>`;
  svc.sidebar.forEach(group => {
    html += `<div class="side-section-title">${group.sec}</div>`;
    group.links.forEach(l => {
      const active = route.page === l.id ? 'active' : '';
      html += `<div class="side-link ${active}" onclick="navigate('${l.id}')">${l.label}</div>`;
    });
  });
  el.innerHTML = html;
}

function pageDefaultFor(svcKey) {
  const map = { vpc: 'vpc-list', ec2: 'ec2-list', s3: 's3-list', elb: 'alb-list', asg: 'asg-list' };
  return map[svcKey] || 'home';
}
function onSearch(v) { /* cosmetic only in this sandbox */ }

const POST_RENDER = {
  'ec2-launch': () => refreshEc2Subnets(),
  'alb-create': () => refreshAlbSubnets(),
  'asg-create': () => refreshAsgSubnets(),
};
function render() {
  renderSidebar();
  const main = document.getElementById('main');
  const fn = PAGES[route.page] || PAGES['home'];
  main.innerHTML = fn(route.params);
  if (POST_RENDER[route.page]) POST_RENDER[route.page]();
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
(async function boot() {
  const regionSelect = document.getElementById('region-select');
  try {
    const regions = await API.get('/regions');
    regionSelect.innerHTML = regions.map(r => `<option value="${r.code}">${r.name} (${r.code})</option>`).join('');
  } catch (e) {
    regionSelect.innerHTML = `<option value="us-east-1">US East (N. Virginia) (us-east-1)</option>`;
  }
  regionSelect.value = currentRegion();
  regionSelect.addEventListener('change', (e) => switchRegion(e.target.value));

  document.getElementById('main').innerHTML = '<div class="empty-state"><h3>Loading…</h3><p>Connecting to the sandbox API and database.</p></div>';
  try {
    await refreshState();
  } catch (e) {
    document.getElementById('main').innerHTML = `<div class="empty-state"><h3>Could not reach the backend</h3><p>${e.message}. Is the API server running?</p></div>`;
    return;
  }
  const parts = location.hash.replace('#/', '').split('/');
  route = { page: parts[0] || 'home', params: { id: parts[1] } };
  render();
})();
