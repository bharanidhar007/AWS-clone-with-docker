// Realistic region / Availability Zone list used to drive the region
// selector and every AZ dropdown in the UI.
const REGIONS = [
  { code: 'us-east-1', name: 'US East (N. Virginia)', azLetters: ['a', 'b', 'c', 'd', 'e', 'f'] },
  { code: 'us-east-2', name: 'US East (Ohio)', azLetters: ['a', 'b', 'c'] },
  { code: 'us-west-1', name: 'US West (N. California)', azLetters: ['a', 'c'] },
  { code: 'us-west-2', name: 'US West (Oregon)', azLetters: ['a', 'b', 'c', 'd'] },
  { code: 'eu-west-1', name: 'Europe (Ireland)', azLetters: ['a', 'b', 'c'] },
  { code: 'eu-central-1', name: 'Europe (Frankfurt)', azLetters: ['a', 'b', 'c'] },
  { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', azLetters: ['a', 'b', 'c'] },
  { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', azLetters: ['a', 'b', 'c'] },
];

function azList(regionCode) {
  const r = REGIONS.find(r => r.code === regionCode) || REGIONS[0];
  return r.azLetters.map(l => regionCode + l);
}

function regionMeta(regionCode) {
  return REGIONS.find(r => r.code === regionCode) || REGIONS[0];
}

module.exports = { REGIONS, azList, regionMeta };
