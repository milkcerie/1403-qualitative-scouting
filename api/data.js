export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL   = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const KEY      = '1403-scouting';

  async function kvGet() {
    const r = await fetch(`${KV_URL}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const raw = await r.json();
    if (!raw.result) return { entries: [], deleted: [] };
    try {
      const val = typeof raw.result === 'object' ? raw.result : JSON.parse(raw.result);
      return { entries: val.entries || [], deleted: val.deleted || [] };
    } catch(e) { return { entries: [], deleted: [] }; }
  }

  async function kvSet(data) {
    // Use pipeline to set value as JSON string
    const r = await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([['SET', KEY, JSON.stringify(data)]])
    });
    return r.json();
  }

  try {
    if (req.method === 'GET') {
      const data = await kvGet();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { action, entry, data } = req.body;

      // action: 'add' | 'delete' | 'restore' | 'permDelete' | 'setAll'
      if (action === 'setAll') {
        // Merge with existing cloud data instead of replacing
        const existing = await kvGet();
        const seen = {};
        existing.entries.forEach(function(e) { seen[e.id] = true; });
        data.entries.forEach(function(e) {
          if (!seen[e.id]) { existing.entries.push(e); seen[e.id] = true; }
        });
        await kvSet(existing);
        return res.status(200).json({ success: true });
      }

      // For all other actions, read-modify-write
      const current = await kvGet();

      if (action === 'add') {
        // Only add if not already present (prevents duplicates)
        const exists = current.entries.some(function(e) { return e.id === entry.id; });
        if (!exists) current.entries.push(entry);
      } else if (action === 'delete') {
        const idx = current.entries.findIndex(function(e) { return e.id === entry.id; });
        if (idx !== -1) {
          const deleted = Object.assign({}, current.entries[idx], { deletedAt: new Date().toLocaleString() });
          current.entries.splice(idx, 1);
          current.deleted = current.deleted || [];
          current.deleted.unshift(deleted);
          current.deleted = current.deleted.slice(0, 20);
        }
      } else if (action === 'restore') {
        const idx = current.deleted.findIndex(function(e) { return e.id === entry.id; });
        if (idx !== -1) {
          const restored = Object.assign({}, current.deleted[idx]);
          delete restored.deletedAt;
          current.entries.push(restored);
          current.deleted.splice(idx, 1);
        }
      } else if (action === 'permDelete') {
        current.deleted = current.deleted.filter(function(e) { return e.id !== entry.id; });
      }

      await kvSet(current);
      return res.status(200).json({ success: true, data: current });
    }

  } catch(e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}
