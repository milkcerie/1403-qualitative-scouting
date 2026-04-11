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
      console.log('Raw KV response type:', typeof raw.result);

      if (!raw.result) {
        return res.status(200).json({ entries: [], deleted: [] });
      }

      let data;
      if (typeof raw.result === 'object') {
        // Already parsed
        data = raw.result;
      } else if (typeof raw.result === 'string') {
        try {
          data = JSON.parse(raw.result);
        } catch(e) {
          // Maybe double-encoded
          try {
            data = JSON.parse(JSON.parse(raw.result));
          } catch(e2) {
            console.error('Could not parse result:', raw.result.slice(0, 100));
            data = { entries: [], deleted: [] };
          }
        }
      }

      return res.status(200).json({
        entries: data.entries || [],
        deleted: data.deleted || []
      });
    }

    if (req.method === 'POST') {
      const data = req.body;
      const value = JSON.stringify(data);
      await fetch(`${KV_URL}/set/${KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(value)
      });
      return res.status(200).json({ success: true });
    }
  } catch(e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}
