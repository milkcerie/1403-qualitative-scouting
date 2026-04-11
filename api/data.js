export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  const KEY      = '1403-scouting';

  async function kvGet() {
    const r = await fetch(`${KV_URL}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const json = await r.json();
    return json.result ? JSON.parse(json.result) : { entries: [], deleted: [] };
  }

  async function kvSet(data) {
    await fetch(`${KV_URL}/set/${KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(data))
    });
  }

  try {
    if (req.method === 'GET') {
      const data = await kvGet();
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      await kvSet(req.body);
      return res.status(200).json({ success: true });
    }
  } catch (e) {
    console.error('KV error:', e);
    return res.status(500).json({ error: e.message });
  }
}
