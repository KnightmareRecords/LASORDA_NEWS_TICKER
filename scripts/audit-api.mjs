import assert from 'node:assert/strict';

// Dedicated local database only; never point this mutating test at a deployed site.
const base = 'http://127.0.0.1:8899';
const headers = { Connection: 'close', 'Content-Type': 'application/json', 'X-Admin-Key': 'local' };
// Workerd on Windows may close reused HTTP connections; this affects the local harness only.
const request = (url, options = {}) => fetch(url, { ...options, headers: { Connection: 'close', ...options.headers } });
const check = (ok, label) => { assert.ok(ok, label); console.log(`PASS ${label}`); };
for (const [path, method] of [['settings', 'PATCH'], ['custom', 'POST'], ['custom/1', 'PATCH'], ['custom/1', 'DELETE'], ['promos', 'POST'], ['promos', 'PATCH'], ['promos/1', 'PATCH'], ['promos/1', 'DELETE'], ['advance', 'POST']]) {
  const response = await request(`${base}/api/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'DELETE' ? undefined : '{}' });
  check(response.status === 401, `${method} ${path} requires an admin key`);
}
const ids = [];
for (const [path, body] of [['custom', 'null'], ['custom', '{"text":7}'], ['settings', 'null'], ['promos', 'null']]) {
  const response = await request(`${base}/api/${path}`, { method: path === 'settings' ? 'PATCH' : 'POST', headers, body });
  check(response.status === 400, `Malformed ${path} body returns 400`);
}
let promoId;
try {
  for (const text of ['AUDIT rotation one', 'AUDIT rotation two', 'AUDIT rotation three']) {
    const response = await request(`${base}/api/custom`, { method: 'POST', headers, body: JSON.stringify({ text }) });
    check(response.status === 201, `Create ${text}`);
    ids.push((await response.json()).id);
  }
  const data = await (await request(`${base}/api/headlines`)).json();
  for (const id of ids) check(data.headlines.some((item) => item.id === `custom-${id}`), `Custom ${id} enters feed`);
  await request(`${base}/api/custom/${ids[0]}`, { method: 'PATCH', headers, body: JSON.stringify({ enabled: false }) });
  const changed = await (await request(`${base}/api/headlines`)).json();
  check(!changed.headlines.some((item) => item.id === `custom-${ids[0]}`), 'Disabled custom disappears');
  const form = new FormData();
  form.append('file', new Blob([Uint8Array.from({ length: 100 }, (_, i) => i)], { type: 'video/mp4' }), 'audit.mp4');
  const uploaded = await request(`${base}/api/promos`, { method: 'POST', headers: { 'X-Admin-Key': 'local' }, body: form });
  check(uploaded.status === 201, 'Media upload to local R2');
  promoId = (await uploaded.json()).id;
  const list = await (await request(`${base}/api/promos`)).json();
  const mediaUrl = base + list.find((promo) => promo.id === promoId).url;
  for (const [range, status, expectedLength, contentRange] of [['bytes=0-9', 206, 10, 'bytes 0-9/100'], ['bytes=-10', 206, 10, 'bytes 90-99/100'], ['bytes=90-', 206, 10, 'bytes 90-99/100'], ['bytes=100-', 416, 0, 'bytes */100'], ['bytes=9-1', 416, 0, 'bytes */100']]) {
    const response = await request(mediaUrl, { headers: { Range: range } });
    check(response.status === status && response.headers.get('Content-Range') === contentRange && (await response.arrayBuffer()).byteLength === expectedLength, `Media range ${range}`);
  }
} finally {
  for (const id of ids) await request(`${base}/api/custom/${id}`, { method: 'DELETE', headers });
  if (promoId) await request(`${base}/api/promos/${promoId}`, { method: 'DELETE', headers });
}

