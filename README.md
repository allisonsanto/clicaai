# Mapa - Backend

Instruções rápidas:

1. Instale dependências:

```bash
npm install
```

2. Configure a variável de ambiente `MONGODB_URI` se necessário (por exemplo: `mongodb://localhost:27017`).

3. Inicie o servidor:

```bash
npm run dev
# ou
npm start
```

O servidor expõe endpoints:
- `GET /markers` - lista marcadores
- `POST /markers` - cria marcador (body JSON: `titulo, info, imagemSrc, lat, lng`)
- `PUT /markers/:id` - atualiza marcador (body JSON: `titulo, info, imagemSrc`)
- `DELETE /markers/:id` - exclui marcador

Atualize `mapa.html` para apontar para `http://localhost:3000` se estiver rodando localmente.
