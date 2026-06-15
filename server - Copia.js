'use strict';

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
// aumentar limite para uploads de imagens em base64
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'mapaDB';

let db;

async function start() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB:', MONGO_URI, 'DB:', DB_NAME);

  const markersColl = db.collection('markers');

  // List markers
  app.get('/markers', async (req, res) => {
    try {
      console.log('[HTTP] GET /markers');
      const docs = await markersColl.find({}).toArray();
      const normalized = docs.map(d => ({ id: d._id.toString(), titulo: d.titulo, info: d.info, imagemSrc: d.imagemSrc, lat: d.lat, lng: d.lng, createdAt: d.createdAt }));
      res.json(normalized);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao obter marcadores' });
    }
  });

  // Create marker
  app.post('/markers', async (req, res) => {
    try {
      console.log('[HTTP] POST /markers - body keys:', req.body ? Object.keys(req.body) : null);
      try { console.log('[HTTP] POST body preview:', JSON.stringify(req.body).slice(0,1000)); } catch(e) {}
      const { titulo, info, imagemSrc, lat, lng } = req.body || {};
      if (!titulo || (lat === undefined || lng === undefined)) {
        console.warn('[HTTP] POST /markers - dados incompletos', { titulo, lat, lng });
        return res.status(400).json({ error: 'titulo, lat e lng são obrigatórios' });
      }
      const doc = { titulo, info, imagemSrc, lat, lng, createdAt: new Date() };
      const r = await markersColl.insertOne(doc);
      res.json({ id: r.insertedId.toString(), ...doc });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao salvar marcador' });
    }
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  // Update marker
  app.put('/markers/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const { titulo, info, imagemSrc } = req.body;
      const update = { $set: { titulo, info, imagemSrc } };
      await markersColl.updateOne({ _id: new ObjectId(id) }, update);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar marcador' });
    }
  });

  // Delete marker
  app.delete('/markers/:id', async (req, res) => {
    try {
      const id = req.params.id;
      await markersColl.deleteOne({ _id: new ObjectId(id) });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao excluir marcador' });
    }
  });

  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Erro ao iniciar servidor:', err);
  process.exit(1);
});
