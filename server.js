const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');
const Client = require('./models/Client');
const Contract = require('./models/Contract');
const LeadCapture = require('./models/LeadCapture');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const contractsDir = path.join(__dirname, 'Contratos');
if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use('/Contratos', express.static(contractsDir));
app.use(express.static(path.join(__dirname, 'public')));

const fmtCode = (prefix, n) => `${prefix}-${String(n).padStart(3, '0')}`;


const CAPTACAO_CATEGORIES = [
  'Clínicas', 'Hospitais', 'Borracharias', 'Restaurantes', 'Pizzarias', 'Padarias', 'Supermercados',
  'Farmácias', 'Academias', 'Pet Shops', 'Salões de Beleza', 'Barbearias', 'Auto Peças', 'Oficinas Mecânicas',
  'Lojas de Roupas', 'Calçados', 'Óticas', 'Escolas', 'Cursos', 'Imobiliárias', 'Construtoras',
  'Escritórios de Advocacia', 'Contabilidades', 'Consultorias', 'Laboratórios', 'Clínicas Odontológicas',
  'Hotéis', 'Pousadas', 'Agências de Turismo', 'Lava Jatos', 'Postos de Combustível', 'Materiais de Construção',
  'Móveis Planejados', 'Eventos e Buffet', 'Fotografia', 'Marketing Digital', 'Tecnologia da Informação',
  'SaaS', 'E-commerce', 'Atacadistas', 'Distribuidoras', 'Transportadoras', 'Seguradoras', 'Bancos',
  'Cooperativas', 'Igrejas', 'ONGs', 'Prefeituras', 'Serviços Públicos', 'Condomínios', 'Coworkings'
];

function normalizeStatus(status) {
  const valid = [
    'Pendente Captação',
    'Aguardando Reunião',
    'Pendente Proposta',
    'Pendente Cliente',
    'Captação Concluida',
    'Captação Falhou',
  ];
  return valid.includes(status) ? status : 'Pendente Captação';
}

function bucketColor(n) {
  if (n <= 3) return 'red';
  if (n <= 6) return 'yellow';
  if (n <= 11) return 'green';
  return 'blue';
}

function categoryToOverpass(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('hospital')) return 'amenity=hospital';
  if (c.includes('clín') || c.includes('clinic')) return 'amenity=clinic';
  if (c.includes('farm')) return 'amenity=pharmacy';
  if (c.includes('rest')) return 'amenity=restaurant';
  if (c.includes('pizz')) return 'amenity=restaurant';
  if (c.includes('barbear')) return 'shop=hairdresser';
  if (c.includes('sal')) return 'shop=beauty';
  if (c.includes('borrach')) return 'shop=tyres';
  if (c.includes('academ')) return 'leisure=fitness_centre';
  if (c.includes('pet')) return 'shop=pet';
  if (c.includes('hotel') || c.includes('pous')) return 'tourism=hotel';
  return 'shop=*';
}

function requestJson(url, options = {}) {
  if (typeof fetch === 'function') return fetch(url, options);

  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = options.body;

    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => data,
            json: async () => JSON.parse(data || 'null'),
          });
        });
      },
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}


function escapePdfText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildSimplePdf(lines) {
  const bodyLines = lines.map((line) => `(${escapePdfText(line)}) Tj`).join(' T*\n');
  const stream = [
    'BT',
    '/F1 28 Tf',
    '50 800 Td',
    '0 0 0 rg',
    '(thynk) Tj',
    '1 0.55 0.1 rg',
    '10 0 Td',
    '(XP) Tj',
    'ET',
    '0.92 0.45 0.08 RG',
    '50 786 m',
    '545 786 l',
    'S',
    'BT',
    '/F1 14 Tf',
    '50 764 Td',
    '0.15 0.15 0.15 rg',
    '(Dados do Contrato) Tj',
    'ET',
    'BT',
    '/F1 11 Tf',
    '50 740 Td',
    '14 TL',
    '0.1 0.1 0.1 rg',
    bodyLines,
    'ET',
  ].join('\n');

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
  objects[4] = `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`;
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

async function nextCode(Model, prefix) {
  const last = await Model.findOne({ code: new RegExp(`^${prefix}-`) }).sort({ createdAt: -1 });
  const n = last ? Number((last.code.split('-')[1] || '0')) + 1 : 1;
  return fmtCode(prefix, n > 999 ? 999 : n);
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@thynkxp.com').toLowerCase();
  const plainPassword = process.env.ADMIN_PASSWORD || '123456';
  const existing = await Admin.findOne({ email });
  if (!existing) {
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    await Admin.create({ name: 'Administrador', email, passwordHash, mustResetPassword: plainPassword === '123456', passwordPreview: plainPassword });
  }
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: (email || '').toLowerCase() });
    if (!admin || !(await bcrypt.compare(password || '', admin.passwordHash))) return res.status(401).json({ message: 'Credenciais inválidas.' });
    if (admin.mustResetPassword) return res.json({ requirePasswordReset: true, message: 'Primeiro acesso detectado. Redefina sua senha para continuar.', email: admin.email });
    return res.json({ admin: { id: admin._id, name: admin.name, email: admin.email } });
  } catch {
    return res.status(500).json({ message: 'Erro interno no login.' });
  }
});

app.post('/api/auth/reset-password-first-access', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const admin = await Admin.findOne({ email: (email || '').toLowerCase() });
    if (!admin) return res.status(404).json({ message: 'Administrador não encontrado.' });
    if (!(await bcrypt.compare(currentPassword || '', admin.passwordHash))) return res.status(401).json({ message: 'Senha atual inválida.' });
    admin.passwordHash = await bcrypt.hash(newPassword || '', 10);
    admin.mustResetPassword = false;
    admin.passwordPreview = newPassword;
    await admin.save();
    return res.json({ admin: { id: admin._id, name: admin.name, email: admin.email } });
  } catch {
    return res.status(500).json({ message: 'Erro ao redefinir senha.' });
  }
});

app.get('/api/admins', async (_req, res) => res.json(await Admin.find().sort({ createdAt: -1 }).select('name email mustResetPassword passwordPreview')));
app.post('/api/admins', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = (email || '').toLowerCase();
    if (await Admin.findOne({ email: normalizedEmail })) return res.status(409).json({ message: 'Já existe administrador com esse e-mail.' });
    const admin = await Admin.create({ name, email: normalizedEmail, passwordHash: await bcrypt.hash(password, 10), mustResetPassword: password === '123456', passwordPreview: password });
    res.status(201).json(admin);
  } catch { res.status(500).json({ message: 'Erro ao criar administrador.' }); }
});
app.put('/api/admins/:id', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const update = { name, email: (email || '').toLowerCase() };
    if (password) { update.passwordHash = await bcrypt.hash(password, 10); update.passwordPreview = password; update.mustResetPassword = password === '123456'; }
    res.json(await Admin.findByIdAndUpdate(req.params.id, update, { new: true }));
  } catch { res.status(500).json({ message: 'Erro ao editar administrador.' }); }
});
app.delete('/api/admins/:id', async (req, res) => { await Admin.findByIdAndDelete(req.params.id); res.json({ ok: true }); });

app.get('/api/clients', async (_req, res) => res.json(await Client.find().sort({ createdAt: -1 })));
app.post('/api/clients', async (req, res) => {
  try {
    const payload = req.body;
    const code = await nextCode(Client, 'TXC');
    const client = await Client.create({ ...payload, code, mustResetPassword: payload.accessPassword === '123456' });
    res.status(201).json(client);
  } catch { res.status(500).json({ message: 'Erro ao cadastrar cliente.' }); }
});
app.put('/api/clients/:id', async (req, res) => res.json(await Client.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/clients/:id', async (req, res) => { await Client.findByIdAndDelete(req.params.id); res.json({ ok: true }); });

app.get('/api/clients/stats/dashboard', async (_req, res) => {
  const clients = await Client.find();
  const growthMap = {};
  const cityMap = {};
  const profitMap = {};
  let totalValue = 0;

  clients.forEach((c) => {
    const m = new Date(c.createdAt).toISOString().slice(0, 7);
    growthMap[m] = (growthMap[m] || 0) + 1;
    cityMap[c.city] = (cityMap[c.city] || 0) + 1;
    profitMap[m] = (profitMap[m] || 0) + Number(c.contractValue || 0);
    totalValue += Number(c.contractValue || 0);
  });

  res.json({
    totalClients: clients.length,
    averageContract: clients.length ? totalValue / clients.length : 0,
    growth: Object.entries(growthMap).map(([month, total]) => ({ month, total })),
    cities: Object.entries(cityMap).map(([city, total]) => ({ city, total })).sort((a, b) => b.total - a.total),
    profitGrowth: Object.entries(profitMap).map(([month, total]) => ({ month, total })),
  });
});

app.get('/api/contracts', async (_req, res) => res.json(await Contract.find().sort({ createdAt: -1 })));
app.post('/api/contracts', async (req, res) => {
  try {
    const { clientId, descriptionText, clauseTheme, clauses } = req.body;
    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ message: 'Cliente não encontrado.' });

    const code = await nextCode(Contract, 'TXCC');
    const signatureToken = crypto.randomBytes(20).toString('hex');
    const pdfName = `${code}.pdf`;
    const pdfPath = `/Contratos/${pdfName}`;
    const lines = [
      `Código: ${code}`,
      `Cliente: ${client.companyName}`,
      `CNPJ/CPF: ${client.companyDocument}`,
      `Valor do Contrato: R$ ${Number(client.contractValue).toFixed(2)}`,
      '',
      `Tema: ${clauseTheme || 'Geral'}`,
      'Descrição:',
      ...(descriptionText ? [descriptionText] : ['Sem descrição informada.']),
      '',
      'Cláusulas:',
      ...((clauses || []).map((c, idx) => `${idx + 1}) ${c}`)),
      '',
      'Emitido por thynkXP Sistemas',
    ];
    fs.writeFileSync(path.join(contractsDir, pdfName), buildSimplePdf(lines));

    const contract = await Contract.create({
      code,
      clientId: client._id,
      clientCode: client.code,
      clientName: client.companyName,
      clientDocument: client.companyDocument,
      clientEmail: client.companyEmail,
      clientPhone: client.companyPhone,
      contractValue: Number(client.contractValue || 0),
      descriptionText,
      clauseTheme,
      clauses: Array.isArray(clauses) ? clauses : [],
      pdfPath,
      signatureToken,
    });

    res.status(201).json(contract);
  } catch {
    res.status(500).json({ message: 'Erro ao criar contrato.' });
  }
});
app.put('/api/contracts/:id', async (req, res) => res.json(await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/contracts/:id', async (req, res) => { await Contract.findByIdAndDelete(req.params.id); res.json({ ok: true }); });

app.get('/api/contracts/stats/dashboard', async (_req, res) => {
  const contracts = await Contract.find();
  const totalContracts = contracts.length;
  const signedContracts = contracts.filter((c) => c.signed).length;
  const pendingContracts = totalContracts - signedContracts;

  const signedWithTime = contracts.filter((c) => c.signed && c.signedAt && c.createdAt);
  const avgSignatureHours = signedWithTime.length
    ? signedWithTime.reduce((acc, c) => acc + ((new Date(c.signedAt) - new Date(c.createdAt)) / 36e5), 0) / signedWithTime.length
    : 0;

  const monthlyCreated = {};
  const monthlySigned = {};
  const themeMap = {};

  contracts.forEach((c) => {
    const cm = new Date(c.createdAt).toISOString().slice(0, 7);
    monthlyCreated[cm] = (monthlyCreated[cm] || 0) + 1;
    if (c.signedAt) {
      const sm = new Date(c.signedAt).toISOString().slice(0, 7);
      monthlySigned[sm] = (monthlySigned[sm] || 0) + 1;
    }
    const t = c.clauseTheme || 'Geral';
    themeMap[t] = (themeMap[t] || 0) + 1;
  });

  res.json({
    totalContracts,
    signedContracts,
    pendingContracts,
    avgSignatureHours,
    monthlyCreated: Object.entries(monthlyCreated).map(([month, total]) => ({ month, total })),
    monthlySigned: Object.entries(monthlySigned).map(([month, total]) => ({ month, total })),
    byTheme: Object.entries(themeMap).map(([theme, total]) => ({ theme, total })),
  });
});

app.get('/api/contracts/sign/:token', async (req, res) => {
  const contract = await Contract.findOne({ signatureToken: req.params.token });
  if (!contract) return res.status(404).json({ message: 'Contrato não encontrado.' });
  res.json(contract);
});

app.post('/api/contracts/sign/:token', async (req, res) => {
  const contract = await Contract.findOne({ signatureToken: req.params.token });
  if (!contract) return res.status(404).json({ message: 'Contrato não encontrado.' });

  const { signedBy, photoDataUrl, photoCapturedAt } = req.body;
  contract.signed = true;
  contract.signedAt = new Date();
  contract.signedBy = signedBy || contract.clientName;

  if (photoDataUrl && /^data:image\/(png|jpeg|jpg);base64,/.test(photoDataUrl)) {
    const ext = photoDataUrl.includes('image/png') ? 'png' : 'jpg';
    const base64 = photoDataUrl.split(',')[1];
    const fileName = `${contract.code}-assinatura.${ext}`;
    fs.writeFileSync(path.join(contractsDir, fileName), Buffer.from(base64, 'base64'));
    contract.signerPhotoPath = `/Contratos/${fileName}`;
    contract.signerPhotoCapturedAt = photoCapturedAt ? new Date(photoCapturedAt) : new Date();
  }

  await contract.save();
  res.json(contract);
});


app.get('/api/captacao/categories', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const list = CAPTACAO_CATEGORIES.filter((c) => !q || c.toLowerCase().includes(q)).slice(0, 20);
  res.json(list);
});

app.get('/api/captacao/categories/check', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const exists = CAPTACAO_CATEGORIES.some((c) => c.toLowerCase() === q);
  const suggestions = CAPTACAO_CATEGORIES.filter((c) => !q || c.toLowerCase().includes(q)).slice(0, 5);
  res.json({ exists, suggestions });
});

app.get('/api/captacao/locations', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=8&q=${encodeURIComponent(q)}`;
    const r = await requestJson(url, { headers: { 'User-Agent': 'thynkxp-painel/1.0' } });
    const data = await r.json();
    res.json((data || []).map((d) => ({
      display_name: d.display_name,
      lat: Number(d.lat),
      lon: Number(d.lon),
    })));
  } catch {
    res.json([]);
  }
});

app.get('/api/captacao', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const category = String(req.query.category || '').trim();

  const query = {};
  if (status) query.status = status;
  if (category) query.category = { $regex: category, $options: 'i' };
  if (q) {
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { address: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { site: { $regex: q, $options: 'i' } },
      { social: { $regex: q, $options: 'i' } },
    ];
  }

  const items = await LeadCapture.find(query).sort({ createdAt: -1 }).limit(300);
  res.json(items);
});

app.post('/api/captacao/run', async (req, res) => {
  try {
    const {
      scheduled,
      scheduledAt,
      category,
      location,
      lat,
      lon,
      radius,
      collectInfo,
      quantity,
    } = req.body;

    const qty = Math.min(10, Math.max(1, Number(quantity || 5)));
    const rad = Math.min(30000, Math.max(500, Number(radius || 3000)));
    const latNum = Number(lat);
    const lonNum = Number(lon);

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return res.status(400).json({ message: 'Localização inválida. Selecione uma sugestão válida.' });
    }

    const overpassTag = categoryToOverpass(category);

    const query = `[out:json][timeout:25];(node[${overpassTag}](around:${rad},${latNum},${lonNum});way[${overpassTag}](around:${rad},${latNum},${lonNum});relation[${overpassTag}](around:${rad},${latNum},${lonNum}););out center tags ${qty};`;
    const or = await requestJson('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    });

    if (!or.ok) {
      const overpassError = await or.text();
      return res.status(502).json({ message: 'Serviço de mapas indisponível no momento.', details: overpassError.slice(0, 160) });
    }

    let od;
    try {
      od = await or.json();
    } catch {
      return res.status(502).json({ message: 'Resposta inválida do serviço de mapas.' });
    }
    const elements = (od.elements || []).slice(0, qty);

    const docs = [];
    for (const e of elements) {
      const tags = e.tags || {};
      const name = tags.name || 'Não Encontrado';
      const lc = await LeadCapture.create({
        name,
        category: category || 'Não informado',
        status: 'Pendente Captação',
        scheduled: !!scheduled,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        city: location || 'Não informado',
        address: tags['addr:full'] || tags['addr:street'] || 'Não Encontrado',
        email: collectInfo ? (tags.email || 'Não Encontrado') : 'Não Encontrado',
        phone: collectInfo ? (tags.phone || tags['contact:phone'] || 'Não Encontrado') : 'Não Encontrado',
        site: collectInfo ? (tags.website || tags['contact:website'] || 'Não Encontrado') : 'Não Encontrado',
        social: collectInfo ? (tags.facebook || tags.instagram || tags['contact:facebook'] || tags['contact:instagram'] || 'Não Encontrado') : 'Não Encontrado',
        lat: e.lat || e.center?.lat,
        lon: e.lon || e.center?.lon,
        metadata: { overpassId: e.id, tags },
      });
      docs.push(lc);
    }

    res.status(201).json({ created: docs.length, items: docs });
  } catch (error) {
    res.status(500).json({ message: 'Falha na captação automática.', details: error.message });
  }
});

app.patch('/api/captacao/:id/status', async (req, res) => {
  const status = normalizeStatus(req.body.status);
  const item = await LeadCapture.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(item);
});

app.delete('/api/captacao/:id', async (req, res) => {
  await LeadCapture.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.get('/api/captacao/stats', async (_req, res) => {
  const items = await LeadCapture.find();
  const success = items.filter((i) => i.status === 'Captação Concluida');

  const pointMap = {};
  success.forEach((s) => {
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') return;
    const key = `${s.lat.toFixed(2)}|${s.lon.toFixed(2)}`;
    if (!pointMap[key]) pointMap[key] = { lat: s.lat, lon: s.lon, count: 0 };
    pointMap[key].count += 1;
  });

  const timeline = {};
  items.forEach((i) => {
    const m = new Date(i.createdAt).toISOString().slice(0, 10);
    timeline[m] = (timeline[m] || 0) + 1;
  });

  res.json({
    points: Object.values(pointMap).map((p) => ({ ...p, color: bucketColor(p.count) })),
    timeline: Object.entries(timeline).map(([date, total]) => ({ date, total })),
  });
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function start() {
  try {
    if (!MONGODB_URI) throw new Error('Defina MONGODB_URI no .env');
    await mongoose.connect(MONGODB_URI);
    await seedAdmin();
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  } catch (error) {
    console.error('Falha ao iniciar aplicação:', error.message);
    process.exit(1);
  }
}

start();
