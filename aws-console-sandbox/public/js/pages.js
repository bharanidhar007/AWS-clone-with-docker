/* ============================================================
   SHARED UI HELPERS
   ============================================================ */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function crumbs(list) {
  return `<div class="crumbs">${list.map((c, i) => i < list.length - 1 ? `<a href="#" onclick="event.preventDefault();navigate('${c.page}')">${c.label}</a> / ` : `${c.label}`).join('')}</div>`;
}
function statCard(label, value, subLabel, subPage) {
  return `<div class="stat-card"><div class="label">${label}</div><div class="value">${value}</div>
    ${subLabel ? `<a class="sub" href="#" onclick="event.preventDefault();navigate('${subPage}')">${subLabel}</a>` : ''}</div>`;
}
function badge(kind, text) { return `<span class="badge ${kind}"><span class="dot"></span>${text}</span>`; }
function emptyState(title, desc, btnLabel, btnPage) {
  return `<div class="empty-state"><h3>${title}</h3><p>${desc}</p>
    ${btnLabel ? `<button class="btn btn-primary" onclick="navigate('${btnPage}')">${btnLabel}</button>` : ''}</div>`;
}
function tableWrap(headers, rows) {
  if (rows.length === 0) return '';
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function optionList(arr, labelFn, valueFn) { return arr.map(a => `<option value="${esc(valueFn(a))}">${esc(labelFn(a))}</option>`).join(''); }

function isSubnetPublic(subnetId) {
  const subnet = state.subnets.find(s => s.id === subnetId);
  if (!subnet) return false;
  const rtb = state.rtbs.find(r => (r.assoc || []).includes(subnetId)) || state.rtbs.find(r => r.main && r.vpcId === subnet.vpcId);
  if (!rtb) return false;
  return (rtb.routes || []).some(rt => rt.dest === '0.0.0.0/0' && String(rt.target).startsWith('igw-'));
}
function azOptions() {
  const r = (state.regions || []).find(r => r.code === state.region);
  return (r ? r.azs : ['us-east-1a', 'us-east-1b', 'us-east-1c', 'us-east-1d']);
}

/* ============================================================
   HOME
   ============================================================ */
function pageHome() {
  return `
  <h1 class="page-title">Console Home</h1>
  <div class="note info">This UI talks to a real backend (Express + SQLite) — every VPC, subnet, instance, volume and bucket you create is written to a database file and stays there across restarts. Nothing here touches a real AWS account.
    <div style="margin-top:8px;"><button class="btn btn-sm" onclick="resetAll()">Reset sandbox</button></div>
  </div>
  <div class="panel">
    <h2>Recently visited / practice services</h2>
    <div class="home-grid">
      ${homeCard('vpc', '#8c4fff', 'VPC', 'Build a virtual network: VPC, subnets, route tables, gateways')}
      ${homeCard('ec2', '#ec7211', 'EC2', 'Launch instances and attach EBS volumes')}
      ${homeCard('s3', '#7aa116', 'S3', 'Store objects in buckets')}
      ${homeCard('elb', '#ec7211', 'EC2 Load Balancing', 'Distribute traffic across instances')}
      ${homeCard('asg', '#ec7211', 'EC2 Auto Scaling', 'Automatically scale groups of instances')}
    </div>
  </div>
  <div class="panel">
    <h2>Suggested learning path</h2>
    <ol style="font-size:13px; line-height:2;">
      <li><a href="#" onclick="event.preventDefault();navigate('vpc-create')">Create a VPC</a></li>
      <li><a href="#" onclick="event.preventDefault();navigate('subnet-create')">Create public &amp; private subnets</a></li>
      <li><a href="#" onclick="event.preventDefault();navigate('igw-create')">Create &amp; attach an Internet Gateway</a>, then add a route to it from your public subnet's route table</li>
      <li><a href="#" onclick="event.preventDefault();navigate('nat-create')">Create a NAT Gateway</a> in the public subnet so the private subnet can reach the internet</li>
      <li><a href="#" onclick="event.preventDefault();navigate('ec2-launch')">Launch an EC2 instance</a> — a root EBS volume is created automatically</li>
      <li><a href="#" onclick="event.preventDefault();navigate('alb-create')">Create a Load Balancer</a> and <a href="#" onclick="event.preventDefault();navigate('asg-create')">an Auto Scaling group</a> behind it</li>
      <li><a href="#" onclick="event.preventDefault();navigate('s3-create')">Create an S3 bucket</a></li>
    </ol>
  </div>`;
}
function homeCard(page, color, title, desc) {
  const letter = title[0];
  return `<div class="home-card" onclick="navigate('${pageDefaultFor(page)}')">
    <div class="svc-icon" style="background:${color}">${letter}</div>
    <div><div class="t">${title}</div><div class="d">${desc}</div></div>
  </div>`;
}
function pageServicesMenu() {
  return `<h1 class="page-title">All services</h1>
  <div class="panel"><div class="home-grid">
    ${homeCard('vpc', '#8c4fff', 'VPC', 'Isolated cloud networking')}
    ${homeCard('ec2', '#ec7211', 'EC2', 'Virtual servers')}
    ${homeCard('s3', '#7aa116', 'S3', 'Object storage')}
    ${homeCard('elb', '#ec7211', 'EC2 Load Balancing', 'Traffic distribution')}
    ${homeCard('asg', '#ec7211', 'EC2 Auto Scaling', 'Elastic instance groups')}
  </div></div>`;
}

/* ============================================================
   VPC
   ============================================================ */
function pageVpcList() {
  const rows = state.vpcs.map(v => `
    <tr onclick="navigate('vpc-detail',{id:'${v.id}'})" style="cursor:pointer">
      <td>${esc(v.name || '—')}</td><td class="mono">${v.id}</td><td>${v.isDefault ? 'Yes' : 'No'}</td>
      <td class="mono">${v.cidr}</td><td>${badge('ok', 'Available')}</td>
      <td>${state.subnets.filter(s => s.vpcId === v.id).length}</td></tr>`);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Your VPCs' }])}
  <h1 class="page-title">Your VPCs</h1>
  <div class="card-grid">
    ${statCard('VPCs', state.vpcs.length)}
    ${statCard('Subnets', state.subnets.length, 'View subnets', 'subnet-list')}
    ${statCard('Internet gateways', state.igws.length, 'View', 'igw-list')}
    ${statCard('NAT gateways', state.natgws.length, 'View', 'nat-list')}
  </div>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Your VPCs (${state.vpcs.length})</h2>
      <button class="btn btn-primary" onclick="navigate('vpc-create')">Create VPC</button></div>
    ${state.vpcs.length === 0 ? emptyState('No VPCs', 'Create a VPC to start building your network.', 'Create VPC', 'vpc-create') :
      tableWrap(['Name', 'VPC ID', 'Default VPC', 'IPv4 CIDR', 'State', 'Subnets'], rows)}
  </div>`;
}
function pageVpcCreate() {
  const presets = ['10.0.0.0/16', '10.1.0.0/16', '172.16.0.0/16', '172.31.0.0/16', '192.168.0.0/16', '10.0.0.0/8'];
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Create VPC' }])}
  <h1 class="page-title">Create VPC</h1>
  <div class="panel">
    <form onsubmit="return submitVpc(event)">
      <div class="form-section"><h3>Name tag</h3>
        <div class="field"><label>Name tag - optional</label><input type="text" id="vpc-name" placeholder="my-vpc"></div></div>
      <div class="form-section"><h3>IPv4 CIDR block</h3>
        <div class="field"><label>IPv4 CIDR</label>
          <select onchange="if(this.value)document.getElementById('vpc-cidr').value=this.value" style="margin-bottom:6px">
            <option value="">Choose a common CIDR…</option>${presets.map(p => `<option>${p}</option>`).join('')}</select>
          <input type="text" id="vpc-cidr" value="10.0.0.0/16" required>
          <div class="hint">e.g. 10.0.0.0/16 — provides 65,536 private IP addresses</div></div></div>
      <div class="form-section"><h3>Tenancy</h3>
        <div class="field"><select id="vpc-tenancy"><option>Default</option><option>Dedicated</option></select></div></div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('vpc-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create VPC</button></div>
    </form>
  </div>`;
}
function submitVpc(e) {
  e.preventDefault();
  runAction(async () => {
    const v = await API.post('/vpcs', {
      name: document.getElementById('vpc-name').value.trim(),
      cidr: document.getElementById('vpc-cidr').value.trim(),
      tenancy: document.getElementById('vpc-tenancy').value,
      region: currentRegion()
    });
    toast('VPC ' + v.id + ' created');
    navigate('vpc-detail', { id: v.id });
  });
  return false;
}
function pageVpcDetail(p) {
  const v = state.vpcs.find(x => x.id === p.id);
  if (!v) return emptyState('VPC not found', 'It may have been deleted.', 'Back to VPCs', 'vpc-list');
  const subs = state.subnets.filter(s => s.vpcId === v.id);
  const igw = state.igws.find(g => g.vpcId === v.id);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Your VPCs', page: 'vpc-list' }, { label: v.id }])}
  <h1 class="page-title">${esc(v.name || v.id)} <button class="btn btn-danger btn-sm" onclick="deleteVpc('${v.id}')">Delete VPC</button></h1>
  <div class="detail-drawer"><div class="kv-grid">
    <div><div class="k">VPC ID</div><div class="v mono">${v.id}</div></div>
    <div><div class="k">State</div><div class="v">${badge('ok', 'Available')}</div></div>
    <div><div class="k">IPv4 CIDR</div><div class="v mono">${v.cidr}</div></div>
    <div><div class="k">Tenancy</div><div class="v">${v.tenancy}</div></div>
    <div><div class="k">Internet gateway</div><div class="v">${igw ? `<a href="#" onclick="event.preventDefault();navigate('igw-list')">${igw.id}</a>` : 'none attached'}</div></div>
    <div><div class="k">Region</div><div class="v">${v.region}</div></div>
  </div></div>
  <div class="panel" style="margin-top:16px">
    <div class="btn-row"><h2 style="margin-right:auto">Subnets (${subs.length})</h2>
      <button class="btn btn-primary btn-sm" onclick="navigate('subnet-create')">Create subnet</button></div>
    ${subs.length === 0 ? `<p style="color:var(--text-secondary);font-size:13px">No subnets in this VPC yet.</p>` :
      tableWrap(['Name', 'Subnet ID', 'AZ', 'IPv4 CIDR', 'Type'], subs.map(s => `
        <tr onclick="navigate('subnet-detail',{id:'${s.id}'})" style="cursor:pointer">
          <td>${esc(s.name || '—')}</td><td class="mono">${s.id}</td><td>${s.az}</td><td class="mono">${s.cidr}</td>
          <td>${isSubnetPublic(s.id) ? '<span class="pill public">Public</span>' : '<span class="pill private">Private</span>'}</td></tr>`))}
  </div>`;
}
function deleteVpc(id) {
  runAction(async () => { await API.del('/vpcs/' + id); toast('VPC deleted'); navigate('vpc-list'); });
}

/* ---- Subnets ---- */
function pageSubnetList() {
  const rows = state.subnets.map(s => `
    <tr onclick="navigate('subnet-detail',{id:'${s.id}'})" style="cursor:pointer">
      <td>${esc(s.name || '—')}</td><td class="mono">${s.id}</td><td class="mono">${s.vpcId}</td>
      <td>${s.az}</td><td class="mono">${s.cidr}</td>
      <td>${isSubnetPublic(s.id) ? '<span class="pill public">Public</span>' : '<span class="pill private">Private</span>'}</td>
      <td>${s.autoAssignPublicIp ? 'Yes' : 'No'}</td></tr>`);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Subnets' }])}
  <h1 class="page-title">Subnets</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Subnets (${state.subnets.length})</h2>
      <button class="btn btn-primary" onclick="navigate('subnet-create')">Create subnet</button></div>
    ${state.subnets.length === 0 ? emptyState('No subnets', 'Create a subnet inside one of your VPCs.', 'Create subnet', 'subnet-create') :
      tableWrap(['Name', 'Subnet ID', 'VPC', 'Availability Zone', 'IPv4 CIDR', 'Type', 'Auto-assign public IP'], rows)}
    <div class="note info" style="margin-top:14px">A subnet is <b>public</b> when its route table has a route to an Internet Gateway. Set that up on the <a href="#" onclick="event.preventDefault();navigate('rtb-list')">Route tables</a> page.</div>
  </div>`;
}
function pageSubnetCreate() {
  if (state.vpcs.length === 0) return emptyState('Create a VPC first', 'You need a VPC before you can create a subnet.', 'Create VPC', 'vpc-create');
  const presets = ['10.0.1.0/24', '10.0.2.0/24', '10.0.3.0/24', '10.0.4.0/24', '10.0.10.0/24', '10.0.20.0/24'];
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Subnets', page: 'subnet-list' }, { label: 'Create subnet' }])}
  <h1 class="page-title">Create subnet</h1>
  <div class="panel">
    <form onsubmit="return submitSubnet(event)">
      <div class="form-section"><h3>VPC</h3>
        <div class="field"><label>VPC ID</label>
          <select id="sn-vpc">${optionList(state.vpcs, v => `${v.name || v.id} (${v.cidr})`, v => v.id)}</select></div></div>
      <div class="form-section"><h3>Subnet settings</h3>
        <div class="field"><label>Subnet name</label><input type="text" id="sn-name" placeholder="public-subnet-1a"></div>
        <div class="two-col">
          <div class="field"><label>Availability Zone</label>
            <select id="sn-az">${azOptions().map(az => `<option>${az}</option>`).join('')}</select></div>
          <div class="field"><label>IPv4 CIDR block</label>
            <select onchange="if(this.value)document.getElementById('sn-cidr').value=this.value" style="margin-bottom:6px">
              <option value="">Choose a common CIDR…</option>${presets.map(p => `<option>${p}</option>`).join('')}</select>
            <input type="text" id="sn-cidr" value="10.0.1.0/24" required></div>
        </div>
        <div class="check-row"><input type="checkbox" id="sn-autoip"><label for="sn-autoip">Enable auto-assign public IPv4 address</label></div>
      </div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('subnet-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create subnet</button></div>
    </form>
  </div>`;
}
function submitSubnet(e) {
  e.preventDefault();
  runAction(async () => {
    const s = await API.post('/subnets', {
      vpcId: document.getElementById('sn-vpc').value, name: document.getElementById('sn-name').value.trim(),
      az: document.getElementById('sn-az').value, cidr: document.getElementById('sn-cidr').value.trim(),
      autoAssignPublicIp: document.getElementById('sn-autoip').checked, region: currentRegion()
    });
    toast('Subnet ' + s.id + ' created');
    navigate('subnet-detail', { id: s.id });
  });
  return false;
}
function pageSubnetDetail(p) {
  const s = state.subnets.find(x => x.id === p.id);
  if (!s) return emptyState('Subnet not found', '', 'Back to subnets', 'subnet-list');
  const rtb = state.rtbs.find(r => (r.assoc || []).includes(s.id)) || state.rtbs.find(r => r.main && r.vpcId === s.vpcId);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Subnets', page: 'subnet-list' }, { label: s.id }])}
  <h1 class="page-title">${esc(s.name || s.id)} <button class="btn btn-danger btn-sm" onclick="deleteSubnet('${s.id}')">Delete subnet</button></h1>
  <div class="detail-drawer"><div class="kv-grid">
    <div><div class="k">Subnet ID</div><div class="v mono">${s.id}</div></div>
    <div><div class="k">VPC</div><div class="v mono"><a href="#" onclick="event.preventDefault();navigate('vpc-detail',{id:'${s.vpcId}'})">${s.vpcId}</a></div></div>
    <div><div class="k">Availability Zone</div><div class="v">${s.az}</div></div>
    <div><div class="k">IPv4 CIDR</div><div class="v mono">${s.cidr}</div></div>
    <div><div class="k">Auto-assign public IPv4</div><div class="v">${s.autoAssignPublicIp ? 'Yes' : 'No'}</div></div>
    <div><div class="k">Route table</div><div class="v mono">${rtb ? `<a href="#" onclick="event.preventDefault();navigate('rtb-detail',{id:'${rtb.id}'})">${rtb.id}</a>` : '—'}</div></div>
    <div><div class="k">Type</div><div class="v">${isSubnetPublic(s.id) ? '<span class="pill public">Public</span>' : '<span class="pill private">Private</span>'}</div></div>
  </div></div>`;
}
function deleteSubnet(id) {
  runAction(async () => { await API.del('/subnets/' + id); toast('Subnet deleted'); navigate('subnet-list'); });
}

/* ---- Internet Gateways ---- */
function pageIgwList() {
  const rows = state.igws.map(g => `
    <tr><td class="mono">${g.id}</td><td>${esc(g.name || '—')}</td>
      <td>${g.vpcId ? badge('ok', 'Attached') : badge('neutral', 'Detached')}</td><td class="mono">${g.vpcId || '—'}</td>
      <td>${!g.vpcId ? `<button class="btn btn-sm" onclick="attachIgw('${g.id}')">Attach to VPC</button>` :
        `<button class="btn btn-sm" onclick="detachIgw('${g.id}')">Detach</button>`}</td></tr>`);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Internet gateways' }])}
  <h1 class="page-title">Internet gateways</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Internet gateways (${state.igws.length})</h2>
      <button class="btn btn-primary" onclick="navigate('igw-create')">Create internet gateway</button></div>
    ${state.igws.length === 0 ? emptyState('No internet gateways', 'Create one, then attach it to a VPC to allow public internet access.', 'Create internet gateway', 'igw-create') :
      tableWrap(['Internet gateway ID', 'Name', 'State', 'Attached VPC', 'Actions'], rows)}
  </div>`;
}
function pageIgwCreate() {
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Internet gateways', page: 'igw-list' }, { label: 'Create' }])}
  <h1 class="page-title">Create internet gateway</h1>
  <div class="panel">
    <form onsubmit="return submitIgw(event)">
      <div class="field"><label>Name tag - optional</label><input type="text" id="igw-name" placeholder="my-igw"></div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('igw-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create internet gateway</button></div>
    </form>
  </div>`;
}
function submitIgw(e) {
  e.preventDefault();
  runAction(async () => {
    const g = await API.post('/igws', { name: document.getElementById('igw-name').value.trim(), region: currentRegion() });
    toast('Internet gateway ' + g.id + ' created (detached)');
    navigate('igw-list');
  });
  return false;
}
function attachIgw(id) {
  if (state.vpcs.length === 0) { toast('Create a VPC first', true); return; }
  const vpcId = prompt('Enter VPC ID to attach to:\n' + state.vpcs.map(v => v.id + (v.name ? ' — ' + v.name : '')).join('\n'), state.vpcs[0].id);
  if (!vpcId) return;
  runAction(async () => { await API.post(`/igws/${id}/attach`, { vpcId: vpcId.trim() }); toast(id + ' attached'); navigate('igw-list'); });
}
function detachIgw(id) {
  runAction(async () => { await API.post(`/igws/${id}/detach`); toast(id + ' detached'); navigate('igw-list'); });
}

/* ---- Route tables ---- */
function pageRtbList() {
  const rows = state.rtbs.map(r => `
    <tr onclick="navigate('rtb-detail',{id:'${r.id}'})" style="cursor:pointer">
      <td class="mono">${r.id}</td><td>${esc(r.name || '—')}</td><td class="mono">${r.vpcId}</td>
      <td>${r.main ? 'Yes' : 'No'}</td><td>${(r.assoc || []).length}</td><td>${(r.routes || []).length}</td></tr>`);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Route tables' }])}
  <h1 class="page-title">Route tables</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Route tables (${state.rtbs.length})</h2>
      <button class="btn btn-primary" onclick="navigate('rtb-create')">Create route table</button></div>
    ${state.rtbs.length === 0 ? emptyState('No route tables', 'Route tables are created automatically with each VPC.', 'Create VPC', 'vpc-create') :
      tableWrap(['Route table ID', 'Name', 'VPC', 'Main', 'Subnet associations', 'Routes'], rows)}
  </div>`;
}
function pageRtbCreate() {
  if (state.vpcs.length === 0) return emptyState('Create a VPC first', '', 'Create VPC', 'vpc-create');
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Route tables', page: 'rtb-list' }, { label: 'Create' }])}
  <h1 class="page-title">Create route table</h1>
  <div class="panel">
    <form onsubmit="return submitRtb(event)">
      <div class="field"><label>Name</label><input type="text" id="rtb-name" placeholder="public-rt"></div>
      <div class="field"><label>VPC</label><select id="rtb-vpc">${optionList(state.vpcs, v => `${v.name || v.id} (${v.cidr})`, v => v.id)}</select></div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('rtb-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create route table</button></div>
    </form>
  </div>`;
}
function submitRtb(e) {
  e.preventDefault();
  runAction(async () => {
    const r = await API.post('/route-tables', { vpcId: document.getElementById('rtb-vpc').value, name: document.getElementById('rtb-name').value.trim(), region: currentRegion() });
    toast('Route table ' + r.id + ' created');
    navigate('rtb-detail', { id: r.id });
  });
  return false;
}
function pageRtbDetail(p) {
  const r = state.rtbs.find(x => x.id === p.id);
  if (!r) return emptyState('Route table not found', '', 'Back', 'rtb-list');
  const availableSubnets = state.subnets.filter(s => s.vpcId === r.vpcId);
  const igw = state.igws.find(g => g.vpcId === r.vpcId && g.vpcId);
  const nats = state.natgws.filter(n => n.vpcId === r.vpcId);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Route tables', page: 'rtb-list' }, { label: r.id }])}
  <h1 class="page-title">${esc(r.name || r.id)} ${r.main ? badge('neutral', 'Main') : ''}</h1>
  <div class="tabs"><div class="tab active">Routes &amp; associations</div></div>
  <div class="panel"><h2>Routes</h2>
    ${tableWrap(['Destination', 'Target'], (r.routes || []).map((rt, i) => `<tr><td class="mono">${rt.dest}</td><td class="mono">${rt.target}
      ${rt.target !== 'local' ? `<button class="btn btn-sm btn-danger" style="margin-left:8px" onclick="removeRoute('${r.id}',${i})">Remove</button>` : ''}</td></tr>`))}
    <div class="form-section" style="border-top:1px solid var(--border); margin-top:14px;">
      <h3>Add route</h3>
      <div class="inline-fields">
        <div class="field"><label>Destination</label><input type="text" id="rt-dest" value="0.0.0.0/0" style="width:160px"></div>
        <div class="field"><label>Target</label>
          <select id="rt-target" style="width:220px">
            ${igw ? `<option value="${igw.id}">Internet Gateway — ${igw.id}</option>` : ''}
            ${nats.map(n => `<option value="${n.id}">NAT Gateway — ${n.id}</option>`).join('')}
            ${(!igw && nats.length === 0) ? `<option value="">No gateways available — create one first</option>` : ''}
          </select></div>
        <button class="btn btn-primary btn-sm" onclick="addRoute('${r.id}')">Add route</button>
      </div>
    </div>
  </div>
  <div class="panel"><h2>Subnet associations</h2>
    ${availableSubnets.length === 0 ? `<p style="color:var(--text-secondary);font-size:13px">No subnets in this VPC.</p>` :
      tableWrap(['Subnet', 'Associated'], availableSubnets.map(s => `<tr><td class="mono">${s.id} ${esc(s.name ? ('— ' + s.name) : '')}</td>
        <td><input type="checkbox" ${(r.assoc || []).includes(s.id) ? 'checked' : ''} onchange="toggleAssoc('${r.id}','${s.id}',this.checked)"></td></tr>`))}
  </div>`;
}
function addRoute(rtbId) {
  const dest = document.getElementById('rt-dest').value.trim();
  const target = document.getElementById('rt-target').value;
  runAction(async () => { await API.post(`/route-tables/${rtbId}/routes`, { dest, target }); toast('Route added'); navigate('rtb-detail', { id: rtbId }); });
}
function removeRoute(rtbId, idx) {
  runAction(async () => { await API.del(`/route-tables/${rtbId}/routes/${idx}`); navigate('rtb-detail', { id: rtbId }); });
}
function toggleAssoc(rtbId, subnetId, checked) {
  runAction(async () => { await API.post(`/route-tables/${rtbId}/associations`, { subnetId, associate: checked }); navigate('rtb-detail', { id: rtbId }); });
}

/* ---- Elastic IPs ---- */
function pageEipList() {
  const rows = state.eips.map(e => `<tr><td class="mono">${e.id}</td><td class="mono">${e.address}</td>
    <td>${e.assoc ? badge('ok', 'Associated') : badge('neutral', 'Not associated')}</td><td class="mono">${e.assoc || '—'}</td></tr>`);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Elastic IPs' }])}
  <h1 class="page-title">Elastic IPs</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Elastic IP addresses (${state.eips.length})</h2>
      <button class="btn btn-primary" onclick="allocateEip()">Allocate Elastic IP address</button></div>
    ${state.eips.length === 0 ? emptyState('No Elastic IPs', 'Allocate one for use with a NAT gateway or EC2 instance.', '', '') :
      tableWrap(['Allocation ID', 'Public IPv4 address', 'Status', 'Associated with'], rows)}
  </div>`;
}
function allocateEip() {
  runAction(async () => { const e = await API.post('/eips', { region: currentRegion() }); toast('Allocated ' + e.address); navigate('eip-list'); });
}

/* ---- NAT Gateways ---- */
function pageNatList() {
  const rows = state.natgws.map(n => `<tr>
    <td class="mono">${n.id}</td><td>${esc(n.name || '—')}</td><td>${badge('ok', 'Available')}</td>
    <td class="mono">${n.subnetId}</td><td class="mono">${n.vpcId}</td><td class="mono">${n.eip}</td><td>Public</td></tr>`);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'NAT gateways' }])}
  <h1 class="page-title">NAT gateways</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">NAT gateways (${state.natgws.length})</h2>
      <button class="btn btn-primary" onclick="navigate('nat-create')">Create NAT gateway</button></div>
    ${state.natgws.length === 0 ? emptyState('No NAT gateways', 'Create one in a public subnet so private-subnet resources can reach the internet.', 'Create NAT gateway', 'nat-create') :
      tableWrap(['NAT gateway ID', 'Name', 'State', 'Subnet', 'VPC', 'Elastic IP', 'Connectivity type'], rows)}
  </div>`;
}
function pageNatCreate() {
  const publicSubnets = state.subnets.filter(s => isSubnetPublic(s.id));
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'NAT gateways', page: 'nat-list' }, { label: 'Create' }])}
  <h1 class="page-title">Create NAT gateway</h1>
  <div class="panel">
    ${publicSubnets.length === 0 ? `<div class="note">No public subnets found. A NAT gateway must live in a <b>public</b> subnet. <a href="#" onclick="event.preventDefault();navigate('rtb-list')">Set that up first</a>.</div>` : ''}
    <form onsubmit="return submitNat(event)">
      <div class="field"><label>Name - optional</label><input type="text" id="nat-name" placeholder="my-nat-gw"></div>
      <div class="field"><label>Subnet</label>
        <select id="nat-subnet" ${publicSubnets.length === 0 ? 'disabled' : ''}>
          ${publicSubnets.length ? optionList(publicSubnets, s => `${s.id} ${s.name ? ('— ' + s.name) : ''} (${s.az})`, s => s.id) : '<option>—</option>'}
        </select></div>
      <div class="field"><label>Connectivity type</label>
        <div class="radio-card-group"><div class="radio-card selected"><div class="t">Public</div><div class="d">Routes traffic to the internet via an Internet Gateway</div></div></div></div>
      <div class="field"><label>Elastic IP allocation</label><div class="hint">A new Elastic IP will be allocated automatically.</div></div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('nat-list')">Cancel</button>
        <button type="submit" class="btn btn-primary" ${publicSubnets.length === 0 ? 'disabled' : ''}>Create NAT gateway</button></div>
    </form>
  </div>`;
}
function submitNat(e) {
  e.preventDefault();
  runAction(async () => {
    const n = await API.post('/nat-gateways', { name: document.getElementById('nat-name').value.trim(), subnetId: document.getElementById('nat-subnet').value });
    toast('NAT gateway ' + n.id + ' created and available');
    navigate('nat-list');
  });
  return false;
}

/* ---- Security Groups ---- */
function pageSgList() {
  const rows = state.sgs.map(g => `<tr onclick="navigate('sg-detail',{id:'${g.id}'})" style="cursor:pointer">
    <td class="mono">${g.id}</td><td>${esc(g.name)}</td><td>${esc(g.desc)}</td><td class="mono">${g.vpcId}</td>
    <td>${(g.inbound || []).length}</td><td>${(g.outbound || []).length}</td></tr>`);
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Security groups' }])}
  <h1 class="page-title">Security groups</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Security groups (${state.sgs.length})</h2>
      <button class="btn btn-primary" onclick="navigate('sg-create')">Create security group</button></div>
    ${state.sgs.length === 0 ? emptyState('No security groups', 'Create one to control inbound/outbound traffic.', 'Create security group', 'sg-create') :
      tableWrap(['Group ID', 'Name', 'Description', 'VPC', 'Inbound rules', 'Outbound rules'], rows)}
  </div>`;
}
function pageSgCreate() {
  if (state.vpcs.length === 0) return emptyState('Create a VPC first', '', 'Create VPC', 'vpc-create');
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Security groups', page: 'sg-list' }, { label: 'Create' }])}
  <h1 class="page-title">Create security group</h1>
  <div class="panel">
    <form onsubmit="return submitSg(event)">
      <div class="two-col">
        <div class="field"><label>Security group name</label><input type="text" id="sg-name" placeholder="web-sg" required></div>
        <div class="field"><label>Description</label><input type="text" id="sg-desc" placeholder="Allow web traffic" required></div>
      </div>
      <div class="field"><label>VPC</label><select id="sg-vpc">${optionList(state.vpcs, v => `${v.name || v.id}`, v => v.id)}</select></div>
      <fieldset><legend>Inbound rules (defaults: SSH from anywhere)</legend>
        <div class="hint">You can add more rules after creating the group, from its detail page.</div></fieldset>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('sg-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create security group</button></div>
    </form>
  </div>`;
}
function submitSg(e) {
  e.preventDefault();
  runAction(async () => {
    const g = await API.post('/security-groups', {
      name: document.getElementById('sg-name').value.trim(), desc: document.getElementById('sg-desc').value.trim(),
      vpcId: document.getElementById('sg-vpc').value, region: currentRegion()
    });
    toast('Security group ' + g.id + ' created');
    navigate('sg-detail', { id: g.id });
  });
  return false;
}
function pageSgDetail(p) {
  const g = state.sgs.find(x => x.id === p.id);
  if (!g) return emptyState('Not found', '', 'Back', 'sg-list');
  return `${crumbs([{ label: 'VPC', page: 'vpc-list' }, { label: 'Security groups', page: 'sg-list' }, { label: g.id }])}
  <h1 class="page-title">${esc(g.name)}</h1>
  <div class="detail-drawer"><div class="kv-grid">
    <div><div class="k">Group ID</div><div class="v mono">${g.id}</div></div>
    <div><div class="k">VPC</div><div class="v mono">${g.vpcId}</div></div>
    <div><div class="k">Description</div><div class="v">${esc(g.desc)}</div></div>
  </div></div>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Inbound rules</h2><button class="btn btn-sm" onclick="addSgRule('${g.id}','inbound')">Add rule</button></div>
    ${tableWrap(['Type', 'Protocol', 'Port range', 'Source'], (g.inbound || []).map((r, i) => `<tr><td>${esc(r.type)}</td><td>${esc(r.proto)}</td><td>${esc(r.port)}</td><td class="mono">${esc(r.source)}
      <button class="btn btn-sm btn-danger" style="margin-left:8px" onclick="removeSgRule('${g.id}','inbound',${i})">Delete</button></td></tr>`))}
  </div>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Outbound rules</h2><button class="btn btn-sm" onclick="addSgRule('${g.id}','outbound')">Add rule</button></div>
    ${tableWrap(['Type', 'Protocol', 'Port range', 'Destination'], (g.outbound || []).map((r, i) => `<tr><td>${esc(r.type)}</td><td>${esc(r.proto)}</td><td>${esc(r.port)}</td><td class="mono">${esc(r.source)}
      <button class="btn btn-sm btn-danger" style="margin-left:8px" onclick="removeSgRule('${g.id}','outbound',${i})">Delete</button></td></tr>`))}
  </div>`;
}
function addSgRule(sgId, dir) {
  const type = prompt('Rule type (e.g. HTTP, HTTPS, SSH, RDP, Custom TCP):', 'HTTP'); if (type === null) return;
  const port = prompt('Port range (e.g. 80, 443, 3000-4000):', '80'); if (port === null) return;
  const source = prompt((dir === 'inbound' ? 'Source' : 'Destination') + ' CIDR:', '0.0.0.0/0'); if (source === null) return;
  runAction(async () => { await API.post(`/security-groups/${sgId}/rules`, { direction: dir, type, proto: 'TCP', port, source }); navigate('sg-detail', { id: sgId }); });
}
function removeSgRule(sgId, dir, idx) {
  runAction(async () => { await API.del(`/security-groups/${sgId}/rules/${dir}/${idx}`); navigate('sg-detail', { id: sgId }); });
}

/* ============================================================
   EC2 + VOLUMES
   ============================================================ */
const AMIS = [
  { id: 'ami-0abcd1234ef567890', name: 'Amazon Linux 2023 AMI', desc: 'Free tier eligible' },
  { id: 'ami-0ubuntu2204xxxxxxx', name: 'Ubuntu Server 22.04 LTS', desc: 'Free tier eligible' },
  { id: 'ami-0win2022xxxxxxxxxx', name: 'Microsoft Windows Server 2022 Base', desc: '' },
  { id: 'ami-0debian12xxxxxxxxx', name: 'Debian 12 (Bookworm)', desc: 'Free tier eligible' },
];
const ITYPES = [
  { id: 't2.micro', vcpu: 1, mem: '1 GiB', free: true }, { id: 't3.micro', vcpu: 2, mem: '1 GiB', free: true },
  { id: 't3.small', vcpu: 2, mem: '2 GiB', free: false }, { id: 't3.medium', vcpu: 2, mem: '4 GiB', free: false },
  { id: 'm5.large', vcpu: 2, mem: '8 GiB', free: false }, { id: 'c5.xlarge', vcpu: 4, mem: '8 GiB', free: false },
];
function pageEc2List() {
  const rows = state.instances.map(i => `<tr onclick="navigate('ec2-detail',{id:'${i.id}'})" style="cursor:pointer">
    <td>${esc(i.name || '—')}</td><td class="mono">${i.id}</td>
    <td>${i.state === 'running' ? badge('ok', 'Running') : i.state === 'stopped' ? badge('neutral', 'Stopped') : badge('bad', 'Terminated')}</td>
    <td>${i.type}</td><td>${badge('ok', '2/2 checks passed')}</td><td>${i.az}</td>
    <td class="mono">${i.publicIp || '—'}</td><td class="mono">${i.privateIp}</td></tr>`);
  return `${crumbs([{ label: 'EC2', page: 'ec2-list' }, { label: 'Instances' }])}
  <h1 class="page-title">Instances</h1>
  <div class="card-grid">
    ${statCard('Instances', state.instances.length)}
    ${statCard('Running', state.instances.filter(i => i.state === 'running').length)}
    ${statCard('Volumes', state.volumes.length, 'View', 'vol-list')}
    ${statCard('Key pairs', state.keypairs.length, 'View', 'kp-list')}
  </div>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Instances (${state.instances.length})</h2>
      <button class="btn btn-primary" onclick="navigate('ec2-launch')">Launch instances</button></div>
    ${state.instances.length === 0 ? emptyState('No instances', 'Launch an EC2 instance to get started.', 'Launch instances', 'ec2-launch') :
      tableWrap(['Name', 'Instance ID', 'Instance state', 'Instance type', 'Status check', 'AZ', 'Public IPv4', 'Private IPv4'], rows)}
  </div>`;
}
function pageEc2Launch() {
  if (state.vpcs.length === 0 || state.subnets.length === 0) return emptyState('Set up networking first', 'You need a VPC and at least one subnet before launching an instance.', 'Create VPC', 'vpc-create');
  return `${crumbs([{ label: 'EC2', page: 'ec2-list' }, { label: 'Instances', page: 'ec2-list' }, { label: 'Launch an instance' }])}
  <h1 class="page-title">Launch an instance</h1>
  <div class="panel">
    <form onsubmit="return submitEc2(event)">
      <div class="form-section"><h3>Name and tags</h3><div class="field"><label>Name</label><input type="text" id="ec2-name" placeholder="my-server"></div></div>
      <div class="form-section"><h3>Application and OS Images (AMI)</h3>
        <div class="field"><label>AMI</label><select id="ec2-ami">${optionList(AMIS, a => `${a.name}${a.desc ? ' — ' + a.desc : ''}`, a => a.id)}</select></div></div>
      <div class="form-section"><h3>Instance type</h3>
        <div class="field"><label>Instance type</label><select id="ec2-type">${optionList(ITYPES, t => `${t.id} (${t.vcpu} vCPU, ${t.mem})${t.free ? ' — Free tier eligible' : ''}`, t => t.id)}</select></div></div>
      <div class="form-section"><h3>Key pair (login)</h3>
        <div class="field"><label>Key pair name</label>
          <select id="ec2-kp"><option value="">Proceed without a key pair (not recommended)</option>${optionList(state.keypairs, k => k.name, k => k.name)}</select>
          <div class="hint"><a href="#" onclick="event.preventDefault();navigate('kp-create')">Create new key pair</a></div></div></div>
      <div class="form-section"><h3>Network settings</h3>
        <div class="two-col">
          <div class="field"><label>VPC</label><select id="ec2-vpc" onchange="refreshEc2Subnets()">${optionList(state.vpcs, v => `${v.name || v.id}`, v => v.id)}</select></div>
          <div class="field"><label>Subnet</label><select id="ec2-subnet"></select></div>
        </div>
        <div class="check-row"><input type="checkbox" id="ec2-autoip" checked><label for="ec2-autoip">Auto-assign public IP (only applied if subnet is public)</label></div>
        <div class="field"><label>Firewall (security group)</label>
          <select id="ec2-sg"><option value="">Create a new security group</option>${optionList(state.sgs, g => `${g.name} (${g.id})`, g => g.id)}</select></div>
      </div>
      <div class="form-section"><h3>Configure storage</h3>
        <div class="field"><label>Root volume size (GiB, gp3)</label><input type="number" id="ec2-vol" value="8" min="8" max="16384"></div></div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('ec2-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Launch instance</button></div>
    </form>
  </div>`;
}
function refreshEc2Subnets() {
  const vpcSel = document.getElementById('ec2-vpc'); const subSel = document.getElementById('ec2-subnet');
  if (!vpcSel) return;
  const subs = state.subnets.filter(s => s.vpcId === vpcSel.value);
  subSel.innerHTML = subs.length ? optionList(subs, s => `${s.id} ${s.name ? ('— ' + s.name) : ''} (${isSubnetPublic(s.id) ? 'public' : 'private'})`, s => s.id) : '<option value="">No subnets in this VPC</option>';
}
function submitEc2(e) {
  e.preventDefault();
  runAction(async () => {
    const inst = await API.post('/instances', {
      name: document.getElementById('ec2-name').value.trim(), ami: document.getElementById('ec2-ami').value,
      type: document.getElementById('ec2-type').value, keypair: document.getElementById('ec2-kp').value || null,
      subnetId: document.getElementById('ec2-subnet').value, sgId: document.getElementById('ec2-sg').value || null,
      autoAssignPublicIp: document.getElementById('ec2-autoip').checked, volSize: document.getElementById('ec2-vol').value,
      region: currentRegion()
    });
    toast('Instance ' + inst.id + ' is launching (root volume created)');
    navigate('ec2-detail', { id: inst.id });
  });
  return false;
}
function pageEc2Detail(p) {
  const i = state.instances.find(x => x.id === p.id);
  if (!i) return emptyState('Instance not found', '', 'Back to instances', 'ec2-list');
  const vols = state.volumes.filter(v => v.instanceId === i.id);
  return `${crumbs([{ label: 'EC2', page: 'ec2-list' }, { label: 'Instances', page: 'ec2-list' }, { label: i.id }])}
  <h1 class="page-title">${esc(i.name || i.id)}
    ${i.state === 'running' ? `<button class="btn btn-sm" onclick="ec2Action('${i.id}','stopped')">Stop instance</button>` : ''}
    ${i.state === 'stopped' ? `<button class="btn btn-sm" onclick="ec2Action('${i.id}','running')">Start instance</button>` : ''}
    ${i.state !== 'terminated' ? `<button class="btn btn-sm btn-danger" onclick="ec2Action('${i.id}','terminated')">Terminate instance</button>` : ''}
  </h1>
  <div class="detail-drawer"><div class="kv-grid">
    <div><div class="k">Instance ID</div><div class="v mono">${i.id}</div></div>
    <div><div class="k">Instance state</div><div class="v">${i.state === 'running' ? badge('ok', 'Running') : i.state === 'stopped' ? badge('neutral', 'Stopped') : badge('bad', 'Terminated')}</div></div>
    <div><div class="k">Instance type</div><div class="v">${i.type}</div></div>
    <div><div class="k">AMI ID</div><div class="v mono">${i.ami}</div></div>
    <div><div class="k">VPC ID</div><div class="v mono">${i.vpcId}</div></div>
    <div><div class="k">Subnet ID</div><div class="v mono">${i.subnetId}</div></div>
    <div><div class="k">Availability Zone</div><div class="v">${i.az}</div></div>
    <div><div class="k">Security group</div><div class="v mono">${i.sgId}</div></div>
    <div><div class="k">Key pair</div><div class="v">${i.keypair || '—'}</div></div>
    <div><div class="k">Public IPv4 address</div><div class="v mono">${i.publicIp || '—'}</div></div>
    <div><div class="k">Private IPv4 address</div><div class="v mono">${i.privateIp}</div></div>
    <div><div class="k">Auto Scaling group</div><div class="v mono">${i.fromAsg || '—'}</div></div>
  </div></div>
  <div class="panel"><h2>Storage</h2>
    ${tableWrap(['Volume ID', 'Size', 'Type', 'Root'], vols.map(v => `<tr onclick="navigate('vol-list')" style="cursor:pointer"><td class="mono">${v.id}</td><td>${v.size} GiB</td><td>${v.type}</td><td>${v.root ? 'Yes' : 'No'}</td></tr>`))}
  </div>`;
}
function ec2Action(id, newState) {
  if (newState === 'terminated' && !confirm('Terminate ' + id + '? This cannot be undone.')) return;
  runAction(async () => { await API.post(`/instances/${id}/action`, { state: newState }); toast('Instance ' + id + ' -> ' + newState); navigate('ec2-detail', { id }); });
}

/* ---- Volumes ---- */
function pageVolList() {
  const rows = state.volumes.map(v => `<tr>
    <td class="mono">${v.id}</td><td>${v.size} GiB</td><td>${v.type}</td>
    <td>${v.state === 'in-use' ? badge('ok', 'In-use') : badge('neutral', 'Available')}</td><td>${v.az}</td>
    <td class="mono">${v.instanceId ? `<a href="#" onclick="event.preventDefault();navigate('ec2-detail',{id:'${v.instanceId}'})">${v.instanceId}</a>` : '—'}</td>
    <td>${v.root ? 'Root' : (v.state === 'available' ? `<button class="btn btn-sm" onclick="attachVol('${v.id}')">Attach</button> <button class="btn btn-sm btn-danger" onclick="deleteVol('${v.id}')">Delete</button>` : `<button class="btn btn-sm" onclick="detachVol('${v.id}')">Detach</button>`)}</td></tr>`);
  return `${crumbs([{ label: 'EC2', page: 'ec2-list' }, { label: 'Volumes' }])}
  <h1 class="page-title">Volumes</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Volumes (${state.volumes.length})</h2>
      <button class="btn btn-primary" onclick="navigate('vol-create')">Create volume</button></div>
    ${state.volumes.length === 0 ? emptyState('No volumes', 'A root volume is created automatically when you launch an instance, or create a standalone volume here.', 'Create volume', 'vol-create') :
      tableWrap(['Volume ID', 'Size', 'Type', 'State', 'AZ', 'Attached instance', 'Actions'], rows)}
  </div>`;
}
function pageVolCreate() {
  return `${crumbs([{ label: 'EC2', page: 'ec2-list' }, { label: 'Volumes', page: 'vol-list' }, { label: 'Create' }])}
  <h1 class="page-title">Create volume</h1>
  <div class="panel">
    <form onsubmit="return submitVol(event)">
      <div class="field"><label>Volume type</label><select id="vol-type"><option>gp3</option><option>gp2</option><option>io2</option><option>st1</option></select></div>
      <div class="field"><label>Size (GiB)</label><input type="number" id="vol-size" value="20" min="1" max="16384" required></div>
      <div class="field"><label>Availability Zone</label><select id="vol-az">${azOptions().map(az => `<option>${az}</option>`).join('')}</select></div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('vol-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create volume</button></div>
    </form>
  </div>`;
}
function submitVol(e) {
  e.preventDefault();
  runAction(async () => {
    const v = await API.post('/volumes', { size: document.getElementById('vol-size').value, type: document.getElementById('vol-type').value, az: document.getElementById('vol-az').value, region: currentRegion() });
    toast('Volume ' + v.id + ' created');
    navigate('vol-list');
  });
  return false;
}
function attachVol(id) {
  const running = state.instances.filter(i => i.state !== 'terminated');
  if (running.length === 0) { toast('No instances to attach to', true); return; }
  const instanceId = prompt('Instance ID to attach to:\n' + running.map(i => i.id + ' (' + i.az + ')').join('\n'), running[0].id);
  if (!instanceId) return;
  runAction(async () => { await API.post(`/volumes/${id}/attach`, { instanceId: instanceId.trim() }); toast('Volume attached'); navigate('vol-list'); });
}
function detachVol(id) {
  runAction(async () => { await API.post(`/volumes/${id}/detach`); toast('Volume detached'); navigate('vol-list'); });
}
function deleteVol(id) {
  runAction(async () => { await API.del('/volumes/' + id); toast('Volume deleted'); navigate('vol-list'); });
}

/* ---- Key pairs ---- */
function pageKpList() {
  const rows = state.keypairs.map(k => `<tr><td>${esc(k.name)}</td><td class="mono">${k.id}</td><td>${k.type}</td><td>${(k.createdAt || '').slice(0, 10)}</td></tr>`);
  return `${crumbs([{ label: 'EC2', page: 'ec2-list' }, { label: 'Key pairs' }])}
  <h1 class="page-title">Key pairs</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Key pairs (${state.keypairs.length})</h2>
      <button class="btn btn-primary" onclick="navigate('kp-create')">Create key pair</button></div>
    ${state.keypairs.length === 0 ? emptyState('No key pairs', 'Create one to securely connect to your instances.', 'Create key pair', 'kp-create') :
      tableWrap(['Name', 'Key pair ID', 'Type', 'Created'], rows)}
  </div>`;
}
function pageKpCreate() {
  return `${crumbs([{ label: 'EC2', page: 'ec2-list' }, { label: 'Key pairs', page: 'kp-list' }, { label: 'Create' }])}
  <h1 class="page-title">Create key pair</h1>
  <div class="panel">
    <form onsubmit="return submitKp(event)">
      <div class="field"><label>Name</label><input type="text" id="kp-name" placeholder="my-key-pair" required></div>
      <div class="field"><label>Key pair type</label><select id="kp-type"><option>RSA</option><option>ED25519</option></select></div>
      <div class="note">In real AWS this downloads a .pem private key file. This sandbox just registers the key pair name (stored in the database) for use when launching instances.</div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('kp-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create key pair</button></div>
    </form>
  </div>`;
}
function submitKp(e) {
  e.preventDefault();
  runAction(async () => {
    const k = await API.post('/keypairs', { name: document.getElementById('kp-name').value.trim(), type: document.getElementById('kp-type').value, region: currentRegion() });
    toast('Key pair "' + k.name + '" created');
    navigate('kp-list');
  });
  return false;
}

/* ============================================================
   S3
   ============================================================ */
function pageS3List() {
  const rows = state.buckets.map(b => `<tr onclick="navigate('s3-detail',{id:'${b.id}'})" style="cursor:pointer">
    <td>${esc(b.name)}</td><td>${b.region}</td>
    <td>${b.blockAll ? '<span class="pill private">Objects not public</span>' : '<span class="pill public">Public</span>'}</td>
    <td>${(b.createdAt || '').slice(0, 10)}</td></tr>`);
  return `${crumbs([{ label: 'S3', page: 's3-list' }])}
  <h1 class="page-title">General purpose buckets</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Buckets (${state.buckets.length})</h2>
      <button class="btn btn-primary" onclick="navigate('s3-create')">Create bucket</button></div>
    ${state.buckets.length === 0 ? emptyState('No buckets', 'Create a bucket to start storing objects.', 'Create bucket', 's3-create') :
      tableWrap(['Name', 'AWS Region', 'Access', 'Creation date'], rows)}
  </div>`;
}
function pageS3Create() {
  return `${crumbs([{ label: 'S3', page: 's3-list' }, { label: 'Create bucket' }])}
  <h1 class="page-title">Create bucket</h1>
  <div class="panel">
    <form onsubmit="return submitS3(event)">
      <div class="form-section"><h3>General configuration</h3>
        <div class="field"><label>Bucket name</label><input type="text" id="s3-name" placeholder="my-unique-bucket-name-2026" required>
          <div class="hint">Must be globally unique, lowercase, 3-63 characters.</div></div>
        <div class="field"><label>AWS Region</label>
          <select id="s3-region">${(state.regions || []).map(r => `<option value="${r.code}" ${r.code === state.region ? 'selected' : ''}>${r.name} (${r.code})</option>`).join('')}</select></div>
      </div>
      <div class="form-section"><h3>Object Ownership</h3>
        <div class="radio-row"><input type="radio" name="own" checked><label>ACLs disabled (recommended)</label></div>
        <div class="radio-row"><input type="radio" name="own"><label>ACLs enabled</label></div></div>
      <div class="form-section"><h3>Block Public Access settings for this bucket</h3>
        <div class="check-row"><input type="checkbox" id="s3-blockall" checked><label for="s3-blockall">Block <i>all</i> public access (recommended)</label></div></div>
      <div class="form-section"><h3>Bucket Versioning</h3>
        <div class="radio-row"><input type="radio" name="ver" id="s3-ver-dis" checked><label for="s3-ver-dis">Disable</label></div>
        <div class="radio-row"><input type="radio" name="ver" id="s3-ver-en"><label for="s3-ver-en">Enable</label></div></div>
      <div class="form-section"><h3>Default encryption</h3>
        <div class="field"><label>Encryption type</label><select><option>SSE-S3</option><option>SSE-KMS</option></select></div></div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('s3-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create bucket</button></div>
    </form>
  </div>`;
}
function submitS3(e) {
  e.preventDefault();
  runAction(async () => {
    const b = await API.post('/buckets', {
      name: document.getElementById('s3-name').value.trim(), region: document.getElementById('s3-region').value,
      blockAll: document.getElementById('s3-blockall').checked, versioning: document.getElementById('s3-ver-en').checked
    });
    toast('Bucket "' + b.name + '" created');
    navigate('s3-detail', { id: b.id });
  });
  return false;
}
function pageS3Detail(p) {
  const b = state.buckets.find(x => x.id === p.id);
  if (!b) return emptyState('Bucket not found', '', 'Back to buckets', 's3-list');
  return `${crumbs([{ label: 'S3', page: 's3-list' }, { label: b.name }])}
  <h1 class="page-title">${esc(b.name)} <button class="btn btn-danger btn-sm" onclick="deleteBucket('${b.id}')">Delete bucket</button></h1>
  <div class="tabs"><div class="tab active">Objects</div><div class="tab">Properties</div><div class="tab">Permissions</div></div>
  <div class="detail-drawer"><div class="kv-grid">
    <div><div class="k">AWS Region</div><div class="v">${b.region}</div></div>
    <div><div class="k">Access</div><div class="v">${b.blockAll ? 'Bucket and objects not public' : 'Public'}</div></div>
    <div><div class="k">Versioning</div><div class="v">${b.versioning ? 'Enabled' : 'Disabled'}</div></div>
    <div><div class="k">Creation date</div><div class="v">${new Date(b.createdAt).toLocaleString()}</div></div>
  </div></div>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Objects (${(b.objects || []).length})</h2><button class="btn btn-sm btn-primary" onclick="uploadObj('${b.id}')">Upload</button></div>
    ${(b.objects || []).length === 0 ? `<p style="color:var(--text-secondary);font-size:13px">This bucket is empty. Objects you "upload" here are names stored in the database — no real files are stored.</p>` :
      tableWrap(['Name', 'Size', 'Last modified'], b.objects.map(o => `<tr><td>${esc(o.name)}</td><td>${o.size} KB</td><td>${o.added.slice(0, 10)}</td></tr>`))}
  </div>`;
}
function uploadObj(bucketId) {
  const name = prompt('Object key name (e.g. photo.jpg, index.html):'); if (!name) return;
  runAction(async () => { await API.post(`/buckets/${bucketId}/objects`, { name }); navigate('s3-detail', { id: bucketId }); });
}
function deleteBucket(id) {
  const b = state.buckets.find(x => x.id === id);
  if (b && (b.objects || []).length > 0 && !confirm('Bucket is not empty. Delete anyway?')) return;
  runAction(async () => { await API.del('/buckets/' + id); toast('Bucket deleted'); navigate('s3-list'); });
}

/* ============================================================
   LOAD BALANCERS + TARGET GROUPS
   ============================================================ */
function pageAlbList() {
  const rows = state.albs.map(a => `<tr onclick="navigate('alb-detail',{id:'${a.id}'})" style="cursor:pointer">
    <td>${esc(a.name)}</td><td class="mono">${a.id}</td><td>${badge('ok', 'Active')}</td>
    <td>${a.scheme}</td><td>Application</td><td class="mono">${a.dns}</td></tr>`);
  return `${crumbs([{ label: 'EC2', page: 'alb-list' }, { label: 'Load balancers' }])}
  <h1 class="page-title">Load balancers</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Load balancers (${state.albs.length})</h2>
      <button class="btn btn-primary" onclick="navigate('alb-create')">Create load balancer</button></div>
    ${state.albs.length === 0 ? emptyState('No load balancers', 'Distribute incoming traffic across multiple EC2 instances.', 'Create load balancer', 'alb-create') :
      tableWrap(['Name', 'ARN suffix', 'State', 'Scheme', 'Type', 'DNS name'], rows)}
  </div>`;
}
function pageAlbCreate() {
  if (state.subnets.length < 2) return emptyState('Need at least 2 subnets', 'An Application Load Balancer requires subnets in at least two Availability Zones.', 'Create subnet', 'subnet-create');
  return `${crumbs([{ label: 'EC2', page: 'alb-list' }, { label: 'Load balancers', page: 'alb-list' }, { label: 'Create' }])}
  <h1 class="page-title">Create Application Load Balancer</h1>
  <div class="panel">
    <form onsubmit="return submitAlb(event)">
      <div class="form-section"><h3>Basic configuration</h3>
        <div class="field"><label>Load balancer name</label><input type="text" id="alb-name" placeholder="my-app-lb" required></div>
        <div class="field"><label>Scheme</label>
          <div class="radio-card-group">
            <div class="radio-card selected" onclick="pickRadioCard(this,'alb-scheme','internet-facing')"><div class="t">Internet-facing</div><div class="d">Public DNS</div></div>
            <div class="radio-card" onclick="pickRadioCard(this,'alb-scheme','internal')"><div class="t">Internal</div><div class="d">Only within the VPC</div></div>
          </div><input type="hidden" id="alb-scheme" value="internet-facing"></div>
      </div>
      <div class="form-section"><h3>Network mapping</h3>
        <div class="field"><label>VPC</label><select id="alb-vpc" onchange="refreshAlbSubnets()">${optionList(state.vpcs, v => `${v.name || v.id}`, v => v.id)}</select></div>
        <div class="field"><label>Mappings — select at least 2 Availability Zones / subnets</label><div class="checkbox-list" id="alb-subnets"></div></div>
      </div>
      <div class="form-section"><h3>Security groups</h3>
        <div class="field"><select id="alb-sg"><option value="">None</option>${optionList(state.sgs, g => `${g.name} (${g.id})`, g => g.id)}</select></div></div>
      <div class="form-section"><h3>Listeners and routing</h3>
        <div class="inline-fields">
          <div class="field"><label>Protocol</label><select id="alb-proto"><option>HTTP</option><option>HTTPS</option></select></div>
          <div class="field"><label>Port</label><input type="number" id="alb-port" value="80"></div>
          <div class="field"><label>Forwards to target group</label><input type="text" id="alb-tgname" placeholder="new target group name" value="my-targets"></div>
        </div>
        <div class="field"><label>Register targets (existing EC2 instances)</label>
          <div class="checkbox-list">
            ${state.instances.length ? state.instances.map(i => `<label style="display:block;padding:3px 0"><input type="checkbox" class="alb-target" value="${i.id}"> ${i.id} ${esc(i.name ? ('— ' + i.name) : '')}</label>`).join('') : '<span style="color:var(--text-secondary);font-size:12.5px">No instances yet.</span>'}
          </div></div>
      </div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('alb-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create load balancer</button></div>
    </form>
  </div>`;
}
function pickRadioCard(el, hiddenId, value) {
  el.parentElement.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected'); document.getElementById(hiddenId).value = value;
}
function refreshAlbSubnets() {
  const vpcSel = document.getElementById('alb-vpc'); const wrap = document.getElementById('alb-subnets');
  if (!vpcSel) return;
  const subs = state.subnets.filter(s => s.vpcId === vpcSel.value);
  wrap.innerHTML = subs.length ? subs.map(s => `<label style="display:block;padding:3px 0"><input type="checkbox" class="alb-subnet-cb" value="${s.id}"> ${s.id} ${s.name ? ('— ' + s.name) : ''} (${s.az}, ${isSubnetPublic(s.id) ? 'public' : 'private'})</label>`).join('') : '<span style="color:var(--text-secondary);font-size:12.5px">No subnets in this VPC.</span>';
}
function submitAlb(e) {
  e.preventDefault();
  const chosen = Array.from(document.querySelectorAll('.alb-subnet-cb:checked')).map(c => c.value);
  const targets = Array.from(document.querySelectorAll('.alb-target:checked')).map(c => c.value);
  runAction(async () => {
    const { alb } = await API.post('/load-balancers', {
      name: document.getElementById('alb-name').value.trim(), scheme: document.getElementById('alb-scheme').value,
      vpcId: document.getElementById('alb-vpc').value, subnets: chosen, sgId: document.getElementById('alb-sg').value || null,
      protocol: document.getElementById('alb-proto').value, port: document.getElementById('alb-port').value,
      tgName: document.getElementById('alb-tgname').value.trim(), targets, region: currentRegion()
    });
    toast('Load balancer ' + alb.name + ' created (provisioning)');
    navigate('alb-detail', { id: alb.id });
  });
  return false;
}
function pageAlbDetail(p) {
  const a = state.albs.find(x => x.id === p.id);
  if (!a) return emptyState('Not found', '', 'Back', 'alb-list');
  return `${crumbs([{ label: 'EC2', page: 'alb-list' }, { label: 'Load balancers', page: 'alb-list' }, { label: a.name }])}
  <h1 class="page-title">${esc(a.name)} <button class="btn btn-danger btn-sm" onclick="deleteAlb('${a.id}')">Delete</button></h1>
  <div class="detail-drawer"><div class="kv-grid">
    <div><div class="k">DNS name</div><div class="v mono">${a.dns}</div></div>
    <div><div class="k">State</div><div class="v">${badge('ok', 'Active')}</div></div>
    <div><div class="k">Scheme</div><div class="v">${a.scheme}</div></div>
    <div><div class="k">VPC</div><div class="v mono">${a.vpcId}</div></div>
    <div><div class="k">Availability Zones</div><div class="v">${(a.subnets || []).length}</div></div>
    <div><div class="k">Type</div><div class="v">Application</div></div>
  </div></div>
  <div class="panel"><h2>Listeners</h2>
    ${tableWrap(['Protocol : Port', 'Forwards to'], (a.listeners || []).map(l => `<tr><td>${l.protocol} : ${l.port}</td><td><a href="#" onclick="event.preventDefault();navigate('tg-list')">${l.tgId}</a></td></tr>`))}
  </div>`;
}
function deleteAlb(id) {
  runAction(async () => { await API.del('/load-balancers/' + id); toast('Load balancer deleted'); navigate('alb-list'); });
}
function pageTgList() {
  const rows = state.targetGroups.map(t => `<tr><td>${esc(t.name)}</td><td class="mono">${t.id}</td><td>${t.protocol}:${t.port}</td><td class="mono">${t.vpcId}</td><td>${(t.targets || []).length} registered</td></tr>`);
  return `${crumbs([{ label: 'EC2', page: 'alb-list' }, { label: 'Target groups' }])}
  <h1 class="page-title">Target groups</h1>
  <div class="panel"><h2>Target groups (${state.targetGroups.length})</h2>
    ${state.targetGroups.length === 0 ? emptyState('No target groups', 'Target groups are created automatically when you set up a load balancer listener.', 'Create load balancer', 'alb-create') :
      tableWrap(['Name', 'ARN suffix', 'Protocol : Port', 'VPC', 'Targets'], rows)}
  </div>`;
}

/* ============================================================
   AUTO SCALING
   ============================================================ */
function pageLtList() {
  const rows = state.launchTemplates.map(l => `<tr><td>${esc(l.name)}</td><td class="mono">${l.id}</td><td>${l.ami}</td><td>${l.itype}</td></tr>`);
  return `${crumbs([{ label: 'EC2', page: 'lt-list' }, { label: 'Launch templates' }])}
  <h1 class="page-title">Launch templates</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Launch templates (${state.launchTemplates.length})</h2>
      <button class="btn btn-primary" onclick="navigate('lt-create')">Create launch template</button></div>
    ${state.launchTemplates.length === 0 ? emptyState('No launch templates', 'A launch template defines the instance configuration an Auto Scaling group uses.', 'Create launch template', 'lt-create') :
      tableWrap(['Name', 'Template ID', 'AMI', 'Instance type'], rows)}
  </div>`;
}
function pageLtCreate() {
  return `${crumbs([{ label: 'EC2', page: 'lt-list' }, { label: 'Launch templates', page: 'lt-list' }, { label: 'Create' }])}
  <h1 class="page-title">Create launch template</h1>
  <div class="panel">
    <form onsubmit="return submitLt(event)">
      <div class="field"><label>Launch template name</label><input type="text" id="lt-name" placeholder="web-server-template" required></div>
      <div class="field"><label>AMI</label><select id="lt-ami">${optionList(AMIS, a => a.name, a => a.id)}</select></div>
      <div class="field"><label>Instance type</label><select id="lt-itype">${optionList(ITYPES, t => `${t.id} (${t.vcpu} vCPU, ${t.mem})`, t => t.id)}</select></div>
      <div class="field"><label>Key pair</label><select id="lt-kp"><option value="">None</option>${optionList(state.keypairs, k => k.name, k => k.name)}</select></div>
      <div class="field"><label>Security group</label><select id="lt-sg"><option value="">None</option>${optionList(state.sgs, g => `${g.name} (${g.id})`, g => g.id)}</select></div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('lt-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create launch template</button></div>
    </form>
  </div>`;
}
function submitLt(e) {
  e.preventDefault();
  runAction(async () => {
    const l = await API.post('/launch-templates', {
      name: document.getElementById('lt-name').value.trim(), ami: document.getElementById('lt-ami').value,
      itype: document.getElementById('lt-itype').value, kp: document.getElementById('lt-kp').value || null,
      sgId: document.getElementById('lt-sg').value || null, region: currentRegion()
    });
    toast('Launch template ' + l.name + ' created');
    navigate('lt-list');
  });
  return false;
}
function pageAsgList() {
  const rows = state.asgs.map(a => `<tr onclick="navigate('asg-detail',{id:'${a.id}'})" style="cursor:pointer">
    <td>${esc(a.name)}</td><td class="mono">${a.ltId}</td><td>${a.desired}</td><td>${a.min}</td><td>${a.max}</td>
    <td>${(a.instances || []).length}</td><td class="mono">${a.vpcId}</td></tr>`);
  return `${crumbs([{ label: 'EC2', page: 'asg-list' }, { label: 'Auto Scaling groups' }])}
  <h1 class="page-title">Auto Scaling groups</h1>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Auto Scaling groups (${state.asgs.length})</h2>
      <button class="btn btn-primary" onclick="navigate('asg-create')">Create Auto Scaling group</button></div>
    ${state.asgs.length === 0 ? emptyState('No Auto Scaling groups', 'Automatically launch and terminate EC2 instances to match demand.', 'Create Auto Scaling group', 'asg-create') :
      tableWrap(['Name', 'Launch template', 'Desired', 'Min', 'Max', 'Instances', 'VPC'], rows)}
  </div>`;
}
function pageAsgCreate() {
  if (state.launchTemplates.length === 0) return emptyState('Create a launch template first', 'An Auto Scaling group needs a launch template that defines what to launch.', 'Create launch template', 'lt-create');
  if (state.subnets.length === 0) return emptyState('Create a subnet first', '', 'Create subnet', 'subnet-create');
  return `${crumbs([{ label: 'EC2', page: 'asg-list' }, { label: 'Auto Scaling groups', page: 'asg-list' }, { label: 'Create' }])}
  <h1 class="page-title">Create Auto Scaling group</h1>
  <div class="panel">
    <form onsubmit="return submitAsg(event)">
      <div class="form-section"><h3>Name and launch template</h3>
        <div class="field"><label>Auto Scaling group name</label><input type="text" id="asg-name" placeholder="web-asg" required></div>
        <div class="field"><label>Launch template</label><select id="asg-lt">${optionList(state.launchTemplates, l => `${l.name} (${l.id})`, l => l.id)}</select></div></div>
      <div class="form-section"><h3>Network</h3>
        <div class="field"><label>VPC</label><select id="asg-vpc" onchange="refreshAsgSubnets()">${optionList(state.vpcs, v => `${v.name || v.id}`, v => v.id)}</select></div>
        <div class="field"><label>Subnets</label><div class="checkbox-list" id="asg-subnets"></div></div></div>
      <div class="form-section"><h3>Load balancing — optional</h3>
        <div class="field"><label>Attach to an existing target group</label>
          <select id="asg-tg"><option value="">No load balancer</option>${optionList(state.targetGroups, t => `${t.name} (${t.id})`, t => t.id)}</select></div></div>
      <div class="form-section"><h3>Group size and scaling</h3>
        <div class="inline-fields">
          <div class="field"><label>Desired capacity</label><input type="number" id="asg-desired" value="2" min="0"></div>
          <div class="field"><label>Minimum capacity</label><input type="number" id="asg-min" value="1" min="0"></div>
          <div class="field"><label>Maximum capacity</label><input type="number" id="asg-max" value="4" min="0"></div>
        </div></div>
      <div class="wizard-footer">
        <button type="button" class="btn" onclick="navigate('asg-list')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Auto Scaling group</button></div>
    </form>
  </div>`;
}
function refreshAsgSubnets() {
  const vpcSel = document.getElementById('asg-vpc'); const wrap = document.getElementById('asg-subnets');
  if (!vpcSel) return;
  const subs = state.subnets.filter(s => s.vpcId === vpcSel.value);
  wrap.innerHTML = subs.length ? subs.map(s => `<label style="display:block;padding:3px 0"><input type="checkbox" class="asg-subnet-cb" value="${s.id}" checked> ${s.id} ${s.name ? ('— ' + s.name) : ''} (${s.az})</label>`).join('') : '<span style="color:var(--text-secondary);font-size:12.5px">No subnets in this VPC.</span>';
}
function submitAsg(e) {
  e.preventDefault();
  const subnets = Array.from(document.querySelectorAll('.asg-subnet-cb:checked')).map(c => c.value);
  runAction(async () => {
    const a = await API.post('/asgs', {
      name: document.getElementById('asg-name').value.trim(), ltId: document.getElementById('asg-lt').value,
      vpcId: document.getElementById('asg-vpc').value, subnets, tgId: document.getElementById('asg-tg').value || null,
      desired: +document.getElementById('asg-desired').value, min: +document.getElementById('asg-min').value, max: +document.getElementById('asg-max').value,
      region: currentRegion()
    });
    toast('Auto Scaling group ' + a.name + ' created with ' + a.desired + ' instance(s)');
    navigate('asg-detail', { id: a.id });
  });
  return false;
}
function pageAsgDetail(p) {
  const a = state.asgs.find(x => x.id === p.id);
  if (!a) return emptyState('Not found', '', 'Back', 'asg-list');
  const insts = state.instances.filter(i => (a.instances || []).includes(i.id));
  return `${crumbs([{ label: 'EC2', page: 'asg-list' }, { label: 'Auto Scaling groups', page: 'asg-list' }, { label: a.name }])}
  <h1 class="page-title">${esc(a.name)} <button class="btn btn-danger btn-sm" onclick="deleteAsg('${a.id}')">Delete</button></h1>
  <div class="detail-drawer"><div class="kv-grid">
    <div><div class="k">Launch template</div><div class="v mono">${a.ltId}</div></div>
    <div><div class="k">VPC</div><div class="v mono">${a.vpcId}</div></div>
    <div><div class="k">Desired / Min / Max</div><div class="v">${a.desired} / ${a.min} / ${a.max}</div></div>
    <div><div class="k">Target group</div><div class="v mono">${a.tgId || '—'}</div></div>
  </div></div>
  <div class="panel">
    <div class="btn-row"><h2 style="margin-right:auto">Instance management (${insts.length})</h2>
      <button class="btn btn-sm" onclick="asgScale('${a.id}',1)">Add instance</button>
      <button class="btn btn-sm" onclick="asgScale('${a.id}',-1)">Terminate one</button></div>
    ${tableWrap(['Instance ID', 'State', 'AZ', 'Private IP'], insts.map(i => `<tr onclick="navigate('ec2-detail',{id:'${i.id}'})" style="cursor:pointer"><td class="mono">${i.id}</td><td>${badge('ok', i.state)}</td><td>${i.az}</td><td class="mono">${i.privateIp}</td></tr>`))}
  </div>`;
}
function asgScale(id, delta) {
  runAction(async () => { await API.post(`/asgs/${id}/scale`, { delta }); navigate('asg-detail', { id }); });
}
function deleteAsg(id) {
  runAction(async () => { await API.del('/asgs/' + id); toast('Auto Scaling group deleted'); navigate('asg-list'); });
}

/* ============================================================
   PAGE DISPATCH TABLE
   ============================================================ */
const PAGES = {
  'home': pageHome, 'services-menu': pageServicesMenu,
  'vpc-list': pageVpcList, 'vpc-create': pageVpcCreate, 'vpc-detail': pageVpcDetail,
  'subnet-list': pageSubnetList, 'subnet-create': pageSubnetCreate, 'subnet-detail': pageSubnetDetail,
  'rtb-list': pageRtbList, 'rtb-create': pageRtbCreate, 'rtb-detail': pageRtbDetail,
  'igw-list': pageIgwList, 'igw-create': pageIgwCreate,
  'eip-list': pageEipList,
  'nat-list': pageNatList, 'nat-create': pageNatCreate,
  'sg-list': pageSgList, 'sg-create': pageSgCreate, 'sg-detail': pageSgDetail,
  'ec2-list': pageEc2List, 'ec2-launch': pageEc2Launch, 'ec2-detail': pageEc2Detail,
  'vol-list': pageVolList, 'vol-create': pageVolCreate,
  'kp-list': pageKpList, 'kp-create': pageKpCreate,
  's3-list': pageS3List, 's3-create': pageS3Create, 's3-detail': pageS3Detail,
  'alb-list': pageAlbList, 'alb-create': pageAlbCreate, 'alb-detail': pageAlbDetail, 'tg-list': pageTgList,
  'lt-list': pageLtList, 'lt-create': pageLtCreate,
  'asg-list': pageAsgList, 'asg-create': pageAsgCreate, 'asg-detail': pageAsgDetail,
};
