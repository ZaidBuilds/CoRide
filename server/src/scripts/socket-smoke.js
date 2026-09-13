/* Raw socket.io polling client used only to verify the CoRide server surface
 * (auth, presence_updated, user_typing, new_message) without depending on the
 * node socket.io-client quirks we hit in this environment. */
const http = require('http');

const base = 'http://localhost:4000/socket.io/';
const concat = (parts) => parts.join('');

function req(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', body } = opts;
    const conn = http.request(base + path, { method, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString() }));
    });
    conn.on('error', reject);
    if (body) conn.write(body);
    conn.end();
  });
}

async function connect(userId) {
  const h = await req(`?EIO=4&transport=polling`);
  const sid = JSON.parse(h.text.slice(1)).sid;
  await req(`?EIO=4&transport=polling&sid=${sid}`, { method: 'POST', body: `40${JSON.stringify({ userId })}` });
  const r = await req(`?EIO=4&transport=polling&sid=${sid}`);
  if (r.text.startsWith('44')) throw new Error(`rejected: ${r.text}`);
  return sid;
}

async function emit(sid, event, payload) {
  await req(`?EIO=4&transport=polling&sid=${sid}`, { method: 'POST', body: `42${JSON.stringify([event, payload])}` });
}

async function pollOnce(sid, seen, log) {
  const r = await req(`?EIO=4&transport=polling&sid=${sid}`);
  if (!r.text || r.text === 'ok') return;
  const parts = r.text.split('\u001e');
  for (const part of parts) {
    if (part.startsWith('42')) {
      const data = part.slice(2);
      const [event, payload] = JSON.parse(data);
      if (!seen.has(event)) { seen.add(event); log.push(`${event}:${JSON.stringify(payload)}`); }
    }
  }
}

(async () => {
  try {
    const log = [];
    const seen = new Set();
    const sidA = await connect('seed_cosmictiger');
    const sidB = await connect('seed_chaibyte');
    const RID = 'rajiv_chowk:blue:towards_noida';
    console.log('connected A,B');
    await emit(sidA, 'join_room', { roomId: RID });
    await emit(sidB, 'join_room', { roomId: RID });
    await new Promise((r) => setTimeout(r, 400));
    await Promise.all([pollOnce(sidB, seen, log), pollOnce(sidA, seen, log)]);
    await emit(sidA, 'typing_start', { roomId: RID });
    await new Promise((r) => setTimeout(r, 200));
    await Promise.all([pollOnce(sidB, seen, log), pollOnce(sidA, seen, log)]);
    await emit(sidA, 'send_message', { roomId: RID, content: 'raw protocol test msg' });
    await new Promise((r) => setTimeout(r, 400));
    await Promise.all([pollOnce(sidB, seen, log), pollOnce(sidA, seen, log)]);
    await emit(sidA, 'leave_room', { roomId: RID });
    await new Promise((r) => setTimeout(r, 400));
    await Promise.all([pollOnce(sidB, seen, log), pollOnce(sidA, seen, log)]);
    console.log('events seen by B:', JSON.stringify(log, null, 0));
  } catch (e) {
    console.log('FAIL:', e.message);
  }
  process.exit(0);
})();