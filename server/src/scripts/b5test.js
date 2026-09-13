const http = require('http');
const base = `http://localhost:4000/socket.io/`;
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
async function pump(sid, seen, log) {
  const r = await req(`?EIO=4&transport=polling&sid=${sid}`);
  if (!r.text || r.text === 'ok') return;
  for (const part of r.text.split('\u001e')) {
    if (part.startsWith('42')) {
      const [event, payload] = JSON.parse(part.slice(2));
      if (!seen.has(`${event}`)) { seen.add(event); log.push({ event, payload }); }
    }
  }
}
(async () => {
  const logA = [], logB = [];
  const seenA = new Set(), seenB = new Set();
  const a = await connect('seed_cosmictiger');
  const b = await connect('seed_chaibyte');
  const RID = 'rajiv_chowk:blue:towards_noida';
  await emit(a, 'join_room', { roomId: RID });
  await emit(b, 'join_room', { roomId: RID });
  await new Promise(r => setTimeout(r, 400));
  await pump(b, seenB, logB); await pump(a, seenA, logA);
  await emit(a, 'send_message', { roomId: RID, content: 'ack test hello' });
  await new Promise(r => setTimeout(r, 400));
  await pump(a, seenA, logA); await pump(a, seenA, logA); await pump(b, seenB, logB);
  const aHasAck = logA.some(x => x.event === 'message_ack');
  const aHasOwnMsg = logA.some(x => x.event === 'new_message' && x.payload.content === 'ack test hello');
  const bHasMsg = logB.some(x => x.event === 'new_message' && x.payload.content === 'ack test hello');
  console.log('A got message_ack:', aHasAck);
  console.log('A got own new_message:', aHasOwnMsg);
  console.log('B got new_message:', bHasMsg);
  process.exit(0);
})();
