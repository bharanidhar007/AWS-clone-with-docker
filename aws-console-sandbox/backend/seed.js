const { table } = require('./db');
const { azList } = require('./regions');

const metaT = table('meta');
const vpcT = table('vpcs');
const subnetT = table('subnets');
const rtbT = table('route_tables');
const igwT = table('igws');
const sgT = table('security_groups');

function ensureRegionSeeded(region) {
  const marker = metaT.get('seeded:' + region);
  if (marker) return;

  const vpc = vpcT.insert(
    { name: 'default-vpc', cidr: '172.31.0.0/16', tenancy: 'Default', isDefault: true, region },
    { prefix: 'vpc' }
  );

  const igw = igwT.insert({ name: 'default-igw', vpcId: vpc.id, region }, { prefix: 'igw' });

  const azs = azList(region);
  const subnetCidrs = azs.map((_, i) => `172.31.${i * 16}.0/20`);
  const subnets = azs.map((az, i) =>
    subnetT.insert(
      { vpcId: vpc.id, name: 'default-subnet-' + az, az, cidr: subnetCidrs[i], autoAssignPublicIp: true, region },
      { prefix: 'subnet' }
    )
  );

  rtbT.insert(
    {
      name: 'default-main-rtb', vpcId: vpc.id, main: true, region,
      routes: [{ dest: vpc.cidr, target: 'local' }, { dest: '0.0.0.0/0', target: igw.id }],
      assoc: subnets.map(s => s.id)
    },
    { prefix: 'rtb' }
  );

  const sgId = require('./db').genId('sg', 8);
  sgT.insert(
    {
      id: sgId, name: 'default', desc: 'default VPC security group', vpcId: vpc.id, region,
      inbound: [{ type: 'All traffic', proto: 'All', port: 'All', source: sgId + ' (self)' }],
      outbound: [{ type: 'All traffic', proto: 'All', port: 'All', source: '0.0.0.0/0' }]
    },
    { id: sgId }
  );

  metaT.insert({ value: true, region }, { id: 'seeded:' + region });
}

function wipeAll() {
  const { db } = require('./db');
  const tables = ['vpcs','subnets','route_tables','igws','nat_gateways','eips','security_groups',
    'instances','volumes','keypairs','buckets','load_balancers','target_groups','launch_templates','asgs','meta'];
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
}

module.exports = { ensureRegionSeeded, wipeAll };
