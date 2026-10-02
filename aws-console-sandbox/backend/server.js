const path = require('path');
const express = require('express');
const { table, genId } = require('./db');
const { REGIONS, azList } = require('./regions');
const { ensureRegionSeeded, wipeAll } = require('./seed');

const app = express();
app.use(express.json());

const vpcT = table('vpcs');
const subnetT = table('subnets');
const rtbT = table('route_tables');
const igwT = table('igws');
const natT = table('nat_gateways');
const eipT = table('eips');
const sgT = table('security_groups');
const instT = table('instances');
const volT = table('volumes');
const kpT = table('keypairs');
const bucketT = table('buckets');
const albT = table('load_balancers');
const tgT = table('target_groups');
const ltT = table('launch_templates');
const asgT = table('asgs');

const err = (res, code, message) => res.status(code).json({ error: message });
const CIDR_RE = /^\d+\.\d+\.\d+\.\d+\/\d+$/;

function isSubnetPublic(subnetId) {
  const subnet = subnetT.get(subnetId);
  if (!subnet) return false;
  const rtbs = rtbT.all(subnet.region);
  const rtb = rtbs.find(r => (r.assoc || []).includes(subnetId)) || rtbs.find(r => r.main && r.vpcId === subnet.vpcId);
  if (!rtb) return false;
  return (rtb.routes || []).some(rt => rt.dest === '0.0.0.0/0' && String(rt.target).startsWith('igw-'));
}

function randomPublicIp() {
  const n = () => Math.floor(Math.random() * 255);
  return [Math.floor(Math.random() * 50) + 52, n(), n(), n()].join('.');
}
function randomPrivateIp() {
  const n = (max) => Math.floor(Math.random() * max);
  return `10.${n(200) + 10}.${n(200)}.${n(250) + 2}`;
}

/* ============================ REGIONS / STATE ============================ */
app.get('/api/regions', (req, res) => {
  res.json(REGIONS.map(r => ({ code: r.code, name: r.name, azs: azList(r.code) })));
});

// One-shot payload that mirrors everything the UI needs for the selected region.
app.get('/api/state', (req, res) => {
  const region = req.query.region || 'us-east-1';
  ensureRegionSeeded(region);
  res.json({
    region,
    regions: REGIONS.map(r => ({ code: r.code, name: r.name, azs: azList(r.code) })),
    vpcs: vpcT.all(region),
    subnets: subnetT.all(region),
    rtbs: rtbT.all(region),
    igws: igwT.all(region),
    natgws: natT.all(region),
    eips: eipT.all(region),
    sgs: sgT.all(region),
    instances: instT.all(region),
    volumes: volT.all(region),
    keypairs: kpT.all(region),
    buckets: bucketT.all(),              // S3 bucket list spans all regions, like the real console
    albs: albT.all(region),
    targetGroups: tgT.all(region),
    launchTemplates: ltT.all(region),
    asgs: asgT.all(region),
  });
});

app.post('/api/reset', (req, res) => {
  wipeAll();
  ensureRegionSeeded(req.body.region || 'us-east-1');
  res.json({ ok: true });
});

/* ============================ VPC ============================ */
app.post('/api/vpcs', (req, res) => {
  const { name, cidr, tenancy, region } = req.body;
  if (!CIDR_RE.test(cidr || '')) return err(res, 400, 'Enter a valid IPv4 CIDR block, e.g. 10.0.0.0/16');
  const vpc = vpcT.insert({ name, cidr, tenancy: tenancy || 'Default', isDefault: false, region }, { prefix: 'vpc' });
  rtbT.insert({ name: 'Main route table', vpcId: vpc.id, main: true, routes: [{ dest: cidr, target: 'local' }], assoc: [], region }, { prefix: 'rtb' });
  res.status(201).json(vpc);
});
app.delete('/api/vpcs/:id', (req, res) => {
  const id = req.params.id;
  const hasSubnets = subnetT.all().some(s => s.vpcId === id);
  const hasInstances = instT.all().some(i => i.vpcId === id);
  if (hasSubnets || hasInstances) return err(res, 409, 'VPC has dependent subnets or instances. Delete those first.');
  vpcT.remove(id);
  rtbT.all().filter(r => r.vpcId === id).forEach(r => rtbT.remove(r.id));
  res.json({ ok: true });
});

/* ============================ Subnets ============================ */
app.post('/api/subnets', (req, res) => {
  const { vpcId, name, az, cidr, autoAssignPublicIp, region } = req.body;
  if (!vpcT.get(vpcId)) return err(res, 404, 'VPC not found');
  if (!CIDR_RE.test(cidr || '')) return err(res, 400, 'Enter a valid IPv4 CIDR block');
  const subnet = subnetT.insert({ vpcId, name, az, cidr, autoAssignPublicIp: !!autoAssignPublicIp, region }, { prefix: 'subnet' });
  res.status(201).json(subnet);
});
app.delete('/api/subnets/:id', (req, res) => {
  const id = req.params.id;
  if (instT.all().some(i => i.subnetId === id)) return err(res, 409, 'Instances exist in this subnet. Terminate them first.');
  subnetT.remove(id);
  rtbT.all().forEach(r => { if ((r.assoc || []).includes(id)) rtbT.update(r.id, x => ({ ...x, assoc: x.assoc.filter(a => a !== id) })); });
  res.json({ ok: true });
});
app.get('/api/subnets/:id/public', (req, res) => res.json({ public: isSubnetPublic(req.params.id) }));

/* ============================ Route tables ============================ */
app.post('/api/route-tables', (req, res) => {
  const { vpcId, name, region } = req.body;
  const vpc = vpcT.get(vpcId);
  if (!vpc) return err(res, 404, 'VPC not found');
  const rtb = rtbT.insert({ name, vpcId, main: false, routes: [{ dest: vpc.cidr, target: 'local' }], assoc: [], region }, { prefix: 'rtb' });
  res.status(201).json(rtb);
});
app.post('/api/route-tables/:id/routes', (req, res) => {
  const { dest, target } = req.body;
  if (!CIDR_RE.test(dest || '')) return err(res, 400, 'Enter a valid CIDR destination');
  if (!target) return err(res, 400, 'Select a target gateway');
  const rtb = rtbT.update(req.params.id, r => ({ ...r, routes: [...r.routes, { dest, target }] }));
  if (!rtb) return err(res, 404, 'Route table not found');
  res.status(201).json(rtb);
});
app.delete('/api/route-tables/:id/routes/:idx', (req, res) => {
  const idx = Number(req.params.idx);
  const rtb = rtbT.update(req.params.id, r => ({ ...r, routes: r.routes.filter((_, i) => i !== idx) }));
  if (!rtb) return err(res, 404, 'Route table not found');
  res.json(rtb);
});
app.post('/api/route-tables/:id/associations', (req, res) => {
  const { subnetId, associate } = req.body;
  // A subnet can only be associated with one route table at a time.
  rtbT.all().forEach(r => { if (r.id !== req.params.id && (r.assoc || []).includes(subnetId)) rtbT.update(r.id, x => ({ ...x, assoc: x.assoc.filter(a => a !== subnetId) })); });
  const rtb = rtbT.update(req.params.id, r => {
    const assoc = new Set(r.assoc || []);
    associate ? assoc.add(subnetId) : assoc.delete(subnetId);
    return { ...r, assoc: [...assoc] };
  });
  if (!rtb) return err(res, 404, 'Route table not found');
  res.json(rtb);
});

/* ============================ Internet Gateways ============================ */
app.post('/api/igws', (req, res) => {
  const igw = igwT.insert({ name: req.body.name, vpcId: null, region: req.body.region }, { prefix: 'igw' });
  res.status(201).json(igw);
});
app.post('/api/igws/:id/attach', (req, res) => {
  const { vpcId } = req.body;
  if (!vpcT.get(vpcId)) return err(res, 404, 'VPC not found');
  if (igwT.all().some(g => g.vpcId === vpcId)) return err(res, 409, 'This VPC already has an internet gateway attached');
  const igw = igwT.update(req.params.id, g => ({ ...g, vpcId }));
  if (!igw) return err(res, 404, 'Internet gateway not found');
  res.json(igw);
});
app.post('/api/igws/:id/detach', (req, res) => {
  const igw = igwT.update(req.params.id, g => ({ ...g, vpcId: null }));
  if (!igw) return err(res, 404, 'Internet gateway not found');
  res.json(igw);
});

/* ============================ Elastic IPs ============================ */
app.post('/api/eips', (req, res) => {
  const eip = eipT.insert({ address: randomPublicIp(), assoc: null, region: req.body.region }, { prefix: 'eipalloc' });
  res.status(201).json(eip);
});

/* ============================ NAT Gateways ============================ */
app.post('/api/nat-gateways', (req, res) => {
  const { name, subnetId } = req.body;
  const subnet = subnetT.get(subnetId);
  if (!subnet) return err(res, 404, 'Subnet not found');
  if (!isSubnetPublic(subnetId)) return err(res, 400, 'A NAT gateway must be created in a public subnet');
  const eip = eipT.insert({ address: randomPublicIp(), assoc: null, region: subnet.region }, { prefix: 'eipalloc' });
  const nat = natT.insert({ name, subnetId, vpcId: subnet.vpcId, eip: eip.address, region: subnet.region }, { prefix: 'nat' });
  eipT.update(eip.id, e => ({ ...e, assoc: nat.id }));
  res.status(201).json(nat);
});

/* ============================ Security Groups ============================ */
app.post('/api/security-groups', (req, res) => {
  const { name, desc, vpcId, region } = req.body;
  if (!vpcT.get(vpcId)) return err(res, 404, 'VPC not found');
  const sg = sgT.insert({
    name, desc, vpcId, region,
    inbound: [{ type: 'SSH', proto: 'TCP', port: '22', source: '0.0.0.0/0' }],
    outbound: [{ type: 'All traffic', proto: 'All', port: 'All', source: '0.0.0.0/0' }]
  }, { prefix: 'sg' });
  res.status(201).json(sg);
});
app.post('/api/security-groups/:id/rules', (req, res) => {
  const { direction, type, proto, port, source } = req.body;
  const key = direction === 'outbound' ? 'outbound' : 'inbound';
  const sg = sgT.update(req.params.id, g => ({ ...g, [key]: [...g[key], { type, proto: proto || 'TCP', port, source }] }));
  if (!sg) return err(res, 404, 'Security group not found');
  res.status(201).json(sg);
});
app.delete('/api/security-groups/:id/rules/:direction/:idx', (req, res) => {
  const key = req.params.direction === 'outbound' ? 'outbound' : 'inbound';
  const idx = Number(req.params.idx);
  const sg = sgT.update(req.params.id, g => ({ ...g, [key]: g[key].filter((_, i) => i !== idx) }));
  if (!sg) return err(res, 404, 'Security group not found');
  res.json(sg);
});

/* ============================ EC2 Instances + Volumes ============================ */
function launchInstanceRecord({ name, ami, type, keypair, subnetId, sgId, autoAssignPublicIp, volSize, region, fromAsg }) {
  const subnet = subnetT.get(subnetId);
  const isPublic = isSubnetPublic(subnetId) && !!autoAssignPublicIp;
  const inst = instT.insert({
    name, ami, type, keypair: keypair || null, vpcId: subnet.vpcId, subnetId, sgId,
    az: subnet.az, state: 'running', region: region || subnet.region,
    privateIp: randomPrivateIp(), publicIp: isPublic ? randomPublicIp() : null,
    launchTime: new Date().toISOString(), fromAsg: fromAsg || null
  }, { prefix: 'i', idLen: 9 });
  volT.insert({
    size: Number(volSize) || 8, type: 'gp3', az: subnet.az, state: 'in-use',
    instanceId: inst.id, root: true, region: inst.region
  }, { prefix: 'vol', idLen: 10 });
  return inst;
}

app.post('/api/instances', (req, res) => {
  const b = req.body;
  if (!subnetT.get(b.subnetId)) return err(res, 400, 'Select a valid subnet');
  let sgId = b.sgId;
  if (!sgId) {
    const subnet = subnetT.get(b.subnetId);
    const sg = sgT.insert({
      name: 'launch-wizard-' + (Date.now() % 1000), desc: 'Created by launch instance wizard', vpcId: subnet.vpcId, region: subnet.region,
      inbound: [{ type: 'SSH', proto: 'TCP', port: '22', source: '0.0.0.0/0' }],
      outbound: [{ type: 'All traffic', proto: 'All', port: 'All', source: '0.0.0.0/0' }]
    }, { prefix: 'sg' });
    sgId = sg.id;
  }
  const inst = launchInstanceRecord({ ...b, sgId });
  res.status(201).json(inst);
});
app.post('/api/instances/:id/action', (req, res) => {
  const { state } = req.body;
  if (!['running', 'stopped', 'terminated'].includes(state)) return err(res, 400, 'Invalid state');
  const inst = instT.update(req.params.id, i => ({ ...i, state, publicIp: state === 'terminated' ? null : i.publicIp }));
  if (!inst) return err(res, 404, 'Instance not found');
  if (state === 'terminated') {
    volT.all().filter(v => v.instanceId === inst.id && v.root).forEach(v => volT.remove(v.id));
  }
  res.json(inst);
});

app.post('/api/volumes', (req, res) => {
  const { size, type, az, region } = req.body;
  if (!size || size < 1) return err(res, 400, 'Enter a valid size');
  const vol = volT.insert({ size: Number(size), type: type || 'gp3', az, state: 'available', instanceId: null, root: false, region }, { prefix: 'vol', idLen: 10 });
  res.status(201).json(vol);
});
app.post('/api/volumes/:id/attach', (req, res) => {
  const { instanceId } = req.body;
  const inst = instT.get(instanceId);
  const vol = volT.get(req.params.id);
  if (!vol) return err(res, 404, 'Volume not found');
  if (!inst) return err(res, 404, 'Instance not found');
  if (vol.state !== 'available') return err(res, 409, 'Volume is not available');
  if (vol.az !== inst.az) return err(res, 400, 'Volume and instance must be in the same Availability Zone');
  const updated = volT.update(vol.id, v => ({ ...v, state: 'in-use', instanceId }));
  res.json(updated);
});
app.post('/api/volumes/:id/detach', (req, res) => {
  const vol = volT.get(req.params.id);
  if (!vol) return err(res, 404, 'Volume not found');
  if (vol.root) return err(res, 409, 'Cannot detach a root volume');
  const updated = volT.update(vol.id, v => ({ ...v, state: 'available', instanceId: null }));
  res.json(updated);
});
app.delete('/api/volumes/:id', (req, res) => {
  const vol = volT.get(req.params.id);
  if (!vol) return err(res, 404, 'Volume not found');
  if (vol.state === 'in-use') return err(res, 409, 'Detach the volume before deleting it');
  volT.remove(vol.id);
  res.json({ ok: true });
});

/* ============================ Key pairs ============================ */
app.post('/api/keypairs', (req, res) => {
  const { name, type, region } = req.body;
  if (kpT.all(region).some(k => k.name === name)) return err(res, 409, 'A key pair with that name already exists in this region');
  const kp = kpT.insert({ name, type: type || 'RSA', region }, { prefix: 'key' });
  res.status(201).json(kp);
});

/* ============================ S3 ============================ */
app.post('/api/buckets', (req, res) => {
  const { name, region, blockAll, versioning } = req.body;
  const clean = String(name || '').trim().toLowerCase();
  if (!/^[a-z0-9.-]{3,63}$/.test(clean)) return err(res, 400, 'Bucket names must be 3-63 lowercase letters, numbers, dots or hyphens');
  if (bucketT.all().some(b => b.name === clean)) return err(res, 409, 'Bucket name already exists (must be globally unique)');
  const bucket = bucketT.insert({ name: clean, region, blockAll: blockAll !== false, versioning: !!versioning, objects: [] }, { prefix: 'bucket' });
  res.status(201).json(bucket);
});
app.post('/api/buckets/:id/objects', (req, res) => {
  const { name } = req.body;
  if (!name) return err(res, 400, 'Object key required');
  const bucket = bucketT.update(req.params.id, b => ({ ...b, objects: [...b.objects, { name, size: Math.floor(Math.random() * 5000) + 1, added: new Date().toISOString() }] }));
  if (!bucket) return err(res, 404, 'Bucket not found');
  res.status(201).json(bucket);
});
app.delete('/api/buckets/:id', (req, res) => {
  bucketT.remove(req.params.id);
  res.json({ ok: true });
});

/* ============================ Load Balancers / Target Groups ============================ */
app.post('/api/load-balancers', (req, res) => {
  const { name, scheme, vpcId, subnets, sgId, protocol, port, tgName, targets, region } = req.body;
  if (!Array.isArray(subnets) || subnets.length < 2) return err(res, 400, 'Select subnets in at least 2 Availability Zones');
  const azs = new Set(subnets.map(id => (subnetT.get(id) || {}).az));
  if (azs.size < 2) return err(res, 400, 'Selected subnets must be in at least 2 different Availability Zones');
  const tg = tgT.insert({ name: tgName || 'my-targets', vpcId, protocol: protocol || 'HTTP', port: port || 80, targets: targets || [], region }, { prefix: 'tg' });
  const alb = albT.insert({
    name, scheme: scheme || 'internet-facing', vpcId, subnets, sgId: sgId || null, region,
    dns: `${name}-${Math.random().toString(36).slice(2, 10)}.${region}.elb.amazonaws.com`,
    listeners: [{ protocol: protocol || 'HTTP', port: port || 80, tgId: tg.id }]
  }, { prefix: 'alb' });
  res.status(201).json({ alb, targetGroup: tg });
});
app.delete('/api/load-balancers/:id', (req, res) => {
  albT.remove(req.params.id);
  res.json({ ok: true });
});

/* ============================ Launch templates ============================ */
app.post('/api/launch-templates', (req, res) => {
  const { name, ami, itype, kp, sgId, region } = req.body;
  const lt = ltT.insert({ name, ami, itype, kp: kp || null, sgId: sgId || null, region }, { prefix: 'lt' });
  res.status(201).json(lt);
});

/* ============================ Auto Scaling Groups ============================ */
app.post('/api/asgs', (req, res) => {
  const { name, ltId, vpcId, subnets, tgId, desired, min, max, region } = req.body;
  const lt = ltT.get(ltId);
  if (!lt) return err(res, 404, 'Launch template not found');
  if (!Array.isArray(subnets) || subnets.length === 0) return err(res, 400, 'Select at least one subnet');
  if (min > max) return err(res, 400, 'Minimum capacity cannot exceed maximum capacity');
  if (desired < min || desired > max) return err(res, 400, 'Desired capacity must be between min and max');
  const instances = [];
  for (let n = 0; n < desired; n++) {
    const subnetId = subnets[n % subnets.length];
    const inst = launchInstanceRecord({
      name: name + '-instance', ami: lt.ami, type: lt.itype, keypair: lt.kp,
      subnetId, sgId: lt.sgId, autoAssignPublicIp: true, volSize: 8, region, fromAsg: null
    });
    instances.push(inst.id);
  }
  const asg = asgT.insert({ name, ltId, vpcId, subnets, tgId: tgId || null, desired, min, max, instances, region }, { prefix: 'asg' });
  instances.forEach(id => instT.update(id, i => ({ ...i, fromAsg: asg.id })));
  if (tgId) tgT.update(tgId, tg => ({ ...tg, targets: [...tg.targets, ...instances] }));
  res.status(201).json(asg);
});
app.post('/api/asgs/:id/scale', (req, res) => {
  const { delta } = req.body;
  const asg = asgT.get(req.params.id);
  if (!asg) return err(res, 404, 'Auto Scaling group not found');
  const lt = ltT.get(asg.ltId);
  if (delta > 0) {
    if (asg.instances.length >= asg.max) return err(res, 409, `Already at maximum capacity (${asg.max})`);
    const inst = launchInstanceRecord({
      name: asg.name + '-instance', ami: lt.ami, type: lt.itype, keypair: lt.kp,
      subnetId: asg.subnets[0], sgId: lt.sgId, autoAssignPublicIp: true, volSize: 8, region: asg.region, fromAsg: asg.id
    });
    const updated = asgT.update(asg.id, a => ({ ...a, instances: [...a.instances, inst.id], desired: a.desired + 1 }));
    return res.json(updated);
  } else {
    if (asg.instances.length <= asg.min) return err(res, 409, `Already at minimum capacity (${asg.min})`);
    const removeId = asg.instances[asg.instances.length - 1];
    instT.remove(removeId);
    volT.all().filter(v => v.instanceId === removeId).forEach(v => volT.remove(v.id));
    const updated = asgT.update(asg.id, a => ({ ...a, instances: a.instances.filter(x => x !== removeId), desired: a.desired - 1 }));
    return res.json(updated);
  }
});
app.delete('/api/asgs/:id', (req, res) => {
  const asg = asgT.get(req.params.id);
  if (asg) {
    asg.instances.forEach(id => { instT.remove(id); volT.all().filter(v => v.instanceId === id).forEach(v => volT.remove(v.id)); });
  }
  asgT.remove(req.params.id);
  res.json({ ok: true });
});

/* ============================ Static frontend ============================ */
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return err(res, 404, 'Not found');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`AWS console sandbox API + UI listening on :${PORT}`));
