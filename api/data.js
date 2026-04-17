export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var KV_URL = process.env.KV_REST_API_URL;
  var KV_TOKEN = process.env.KV_REST_API_TOKEN;
  var KEY = '1403-scouting';

  var getUrl = KV_URL + '/get/' + KEY;
  var pipeUrl = KV_URL + '/pipeline';
  var authHeader = 'Bearer ' + KV_TOKEN;

  function kvGet() {
    return fetch(getUrl, { headers: { Authorization: authHeader } })
      .then(function(r) { return r.json(); })
      .then(function(raw) {
        if (!raw.result) return { entries: [], deleted: [], events: [] };
        var val = typeof raw.result === 'object' ? raw.result : JSON.parse(raw.result);
        return { entries: val.entries || [], deleted: val.deleted || [], events: val.events || [] };
      })
      .catch(function() { return { entries: [], deleted: [], events: [] }; });
  }

  function kvSet(data) {
    return fetch(pipeUrl, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', KEY, JSON.stringify(data)]])
    });
  }

  try {
    if (req.method === 'GET') {
      var result = await kvGet();
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      var action = req.body.action;
      var entry = req.body.entry;
      var bodyData = req.body.data;
      var current = await kvGet();

      if (action === 'setAll') {
        var seen = {};
        current.entries.forEach(function(e) { seen[e.id] = true; });
        if (bodyData && bodyData.entries) {
          bodyData.entries.forEach(function(e) {
            if (!seen[e.id]) { current.entries.push(e); seen[e.id] = true; }
          });
        }
      } else if (action === 'add') {
        var alreadyExists = current.entries.some(function(e) { return e.id === entry.id; });
        if (!alreadyExists) current.entries.push(entry);
      } else if (action === 'delete') {
        var di = current.entries.findIndex(function(e) { return e.id === entry.id; });
        if (di !== -1) {
          var del = Object.assign({}, current.entries[di], { deletedAt: new Date().toLocaleString() });
          current.entries.splice(di, 1);
          current.deleted = current.deleted || [];
          current.deleted.unshift(del);
          current.deleted = current.deleted.slice(0, 20);
        }
      } else if (action === 'restore') {
        var ri = current.deleted.findIndex(function(e) { return e.id === entry.id; });
        if (ri !== -1) {
          var res2 = Object.assign({}, current.deleted[ri]);
          delete res2.deletedAt;
          current.entries.push(res2);
          current.deleted.splice(ri, 1);
        }
      } else if (action === 'relabel') {
        current.entries.forEach(function(e) {
          if (e.id === entry.id) e.event = entry.event;
        });
      } else if (action === 'permDelete') {
        current.deleted = current.deleted.filter(function(e) { return e.id !== entry.id; });
      } else if (action === 'addEvent') {
        var newEvent = req.body.event;
        current.events = current.events || [];
        if (newEvent && !current.events.includes(newEvent)) {
          current.events.push(newEvent);
        }
      }

      await kvSet(current);
      return res.status(200).json({ success: true, data: current });
    }
  } catch(e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
