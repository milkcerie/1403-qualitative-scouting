export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL   = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const KEY      = '1403-scouting';

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${KV_URL}/get/${KEY}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const raw = await r.json();

      if (!raw.result) {
        return res.status(200).json({ entries: [], deleted: [] });
      }

      let data;
      if (typeof raw.result === 'object') {
        data = raw.result;
      } else {
        try { data = JSON.parse(raw.result); }
        catch(e) { data = { entries: [], deleted: [] }; }
      }

      return res.status(200).json({
        entries: data.entries || [],
        deleted: data.deleted || []
      });
    }

    if (req.method === 'POST') {
      // Use Upstash REST API set command correctly
      const value = JSON.stringify(req.body);
      const r = await fetch(`${KV_URL}/set/${KEY}/${encodeURIComponent(value)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const result = await r.json();
      console.log('KV set result:', result);
      return res.status(200).json({ success: true });
    }

  } catch(e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}
