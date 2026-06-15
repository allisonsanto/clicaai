'use strict';

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// Aumentar limite para uploads de imagens em base64 (usado no mapa)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// PORTA DINÂMICA: Essencial para o Render não dar erro de inicialização
const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb+srv://allisonsanto_db:krZ9VZhZley2GrAT@allisonsanto.jykbpor.mongodb.net/?retryWrites=true&w=majority';
const DB_NAME = 'mapaDB';

let db;

// =======================================================
// DEFINIÇÃO DO SCHEMA PARA O PAINEL (MONGOOSE)
// =======================================================
const PostagemSchema = new mongoose.Schema({
    titulo: { type: String, required: true, minlength: 3, maxlength: 120 },
    conteudo: { type: String, required: true, minlength: 10 },
    imagem: { type: String, default: null },
    categoria: { type: String, required: true },
    data_criacao: { type: Date, default: Date.now }
});

const Postagem = mongoose.model('Postagem', PostagemSchema);

// =======================================================
// CONFIGURAÇÃO DO MULTER (UPLOAD DE IMAGENS)
// =======================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/';
        // Garante que o Render criará a pasta caso ela não tenha subido pelo Git
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir); 
    },
    filename: (req, file, cb) => {
        const nomeLimpo = file.originalname.replace(/\s+/g, '-');
        cb(null, Date.now() + '-' + nomeLimpo);
    }
});
const upload = multer({ storage: storage });

// Middlewares de Arquivos Estáticos (Entrega o Front-end direto pelo Render)
app.use(express.static(path.join(__dirname, './'))); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rota para carregar a página inicial ao acessar o link do Render
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =======================================================
// FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO
// =======================================================
async function start() {
  // 1. Conexão do Driver Nativo (para os Marcadores do Mapa)
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Driver Nativo conectado ao MongoDB:', DB_NAME);
  const markersColl = db.collection('markers');

  // 2. Conexão do Mongoose (para o Painel de Postagens)
  await mongoose.connect(MONGO_URI);
  console.log('Mongoose conectado com sucesso ao MongoDB Atlas!');

  // =======================================================
  // ROTAS DO MAPA (MARKERS)
  // =======================================================
  app.get('/markers', async (req, res) => {
    try {
      console.log('[HTTP] GET /markers');
      const docs = await markersColl.find({}).toArray();
      const normalized = docs.map(d => ({ 
        id: d._id.toString(), 
        titulo: d.titulo, 
        info: d.info, 
        imagemSrc: d.imagemSrc, 
        lat: d.lat, 
        lng: d.lng, 
        createdAt: d.createdAt 
      }));
      res.json(normalized);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao obter marcadores' });
    }
  });

  app.post('/markers', async (req, res) => {
    try {
      const { titulo, info, imagemSrc, lat, lng } = req.body || {};
      if (!titulo || (lat === undefined || lng === undefined)) {
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

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  // =======================================================
  // ROTAS DO PAINEL DE POSTAGENS
  // =======================================================
  app.post('/receber-post', upload.single('imagem'), async (req, res) => {
      try {
          const { titulo, conteudo, categoria } = req.body;
          const imagemPath = req.file ? `/uploads/${req.file.filename}` : null;

          const novaPostagem = new Postagem({
              titulo,
              conteudo,
              categoria,
              imagem: imagemPath
          });

          await novaPostagem.save();
          
          // Ajustado para responder sucesso de forma limpa para o front-end JavaScript tratar
          res.status(200).json({ success: true });
      } catch (error) {
          console.error("Erro ao salvar no Mongo:", error);
          res.status(500).send("Erro interno ao salvar a postagem.");
      }
  });

  app.get('/api/postagens/:categoria', async (req, res) => {
      try {
          const categoriaSelecionada = req.params.categoria;
          const posts = await Postagem.find({ categoria: categoriaSelecionada })
                                      .sort({ data_criacao: -1 });
          res.json(posts);
      } catch (error) {
          console.error("Erro ao buscar do Mongo:", error);
          res.status(500).json({ error: "Erro ao buscar postagens." });
      }
  });

  // Inicializa o servidor na porta correta atribuída pelo Render
  app.listen(PORT, () => console.log(`Servidor rodando e escutando na porta: ${PORT}`));
}

// Inicializa a aplicação protegendo contra falhas de conexão
start().catch(err => {
  console.error('Erro crítico ao iniciar servidor:', err);
  process.exit(1);
});
