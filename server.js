'use strict';

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = 3000;
const MONGO_URI = 'mongodb+srv://allisonsanto_db:krZ9VZhZley2GrAT@allisonsanto.jykbpor.mongodb.net/mapaDB?retryWrites=true&w=majority';

// =======================================================
// MIDDLEWARES GERAIS
// =======================================================
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Permite receber imagens em Base64 grandes para o mapa
app.use(express.urlencoded({ extended: true })); // Permite receber formulários normais (painel.html)
app.use(express.static('public')); // Onde ficam seus arquivos HTML/CSS/JS (front-end)
app.use('/uploads', express.static('uploads')); // Torna as imagens salvas acessíveis via URL

// =======================================================
// CONFIGURAÇÃO DO MULTER (UPLOAD DE IMAGENS DO PAINEL)
// =======================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// =======================================================
// DEFINIÇÃO DOS SCHEMAS E MODELOS (MONGOOSE)
// =======================================================

// 1. Modelo para as Postagens por Categoria (Painel)
const PostagemSchema = new mongoose.Schema({
    titulo: { type: String, required: true, minlength: 3, maxlength: 120 },
    conteudo: { type: String, required: true, minlength: 10 },
    imagem: { type: String, default: null },
    categoria: { type: String, required: true },
    data_criacao: { type: Date, default: Date.now }
});
const Postagem = mongoose.model('Postagem', PostagemSchema);

// 2. Modelo para os Marcadores do Mapa (Óbidos)
const MarkerSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    info: { type: String },
    imagemSrc: { type: String }, // Mantido como String para suportar Base64 ou URL
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Marker = mongoose.model('Marker', MarkerSchema);

// =======================================================
// ROTAS DO MAPA (MARCADORES) - Refatoradas para Mongoose
// =======================================================

// Listar marcadores
app.get('/markers', async (req, res) => {
    try {
        console.log('[HTTP] GET /markers');
        const docs = await Marker.find({});
        // Normaliza o formato mudando o _id interno do mongo para 'id' string para manter compatibilidade com seu mapa
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

// Criar marcador
app.post('/markers', async (req, res) => {
    try {
        console.log('[HTTP] POST /markers');
        const { titulo, info, imagemSrc, lat, lng } = req.body || {};
        
        if (!titulo || lat === undefined || lng === undefined) {
            console.warn('[HTTP] POST /markers - dados incompletos', { titulo, lat, lng });
            return res.status(400).json({ error: 'titulo, lat e lng são obrigatórios' });
        }

        const novoMarker = new Marker({ titulo, info, imagemSrc, lat, lng });
        const r = await novoMarker.save();

        res.json({ id: r._id.toString(), titulo, info, imagemSrc, lat, lng, createdAt: r.createdAt });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar marcador' });
    }
});

// Atualizar marcador
app.put('/markers/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { titulo, info, imagemSrc } = req.body;
        
        await Marker.findByIdAndUpdate(id, { titulo, info, imagemSrc });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar marcador' });
    }
});

// Excluir marcador
app.delete('/markers/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await Marker.findByIdAndDelete(id);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir marcador' });
    }
});

// Rota de teste de saúde do servidor
app.get('/health', (req, res) => {
    res.json({ ok: true });
});

// =======================================================
// ROTAS DO PAINEL DE POSTAGENS (FORMULÁRIO)
// =======================================================

// Receber o formulário do painel.html
app.post('/receber-post', upload.single('imagem'), async (req, res) => {
// Altere esta parte dentro do app.post('/receber-post') no seu server.js
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

    // RETORNO ATUALIZADO: Responde apenas sucesso para o fetch do front-end tratar
    res.status(200).json({ success: true, message: "Postagem salva com sucesso!" });

} catch (error) {
    console.error("Erro ao salvar no Mongo:", error);
    res.status(500).send("Erro interno ao salvar a postagem.");
}
});

// Buscar posts por categoria para alimentar as páginas dinâmicas
app.get('/api/postagens/:categoria', async (req, res) => {
    try {
        const categoriaSelecionada = req.params.categoria;
        const posts = await Postagem.find({ categoria: categoriaSelecionada }).sort({ data_criacao: -1 });
        res.json(posts);
    } catch (error) {
        console.error("Erro ao buscar do Mongo:", error);
        res.status(500).json({ error: "Erro ao buscar postagens." });
    }
});

// =======================================================
// CONEXÃO COM O BANCO E INICIALIZAÇÃO ÚNICA DO SERVIDOR
// =======================================================
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Conectado com sucesso ao MongoDB Atlas (mapaDB)!');
        
        // Liga o servidor uma única vez, escutando as duas funcionalidades na porta 3000
        app.listen(PORT, () => {
            console.log(`Servidor rodando e escutando em http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Erro crítico ao conectar ao MongoDB:', err);
    });