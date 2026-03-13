const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');
const Client = require('./models/Client');
const Contract = require('./models/Contract');

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

app.get('/api/contracts/sign/:token', async (req, res) => {
  const contract = await Contract.findOne({ signatureToken: req.params.token });
  if (!contract) return res.status(404).json({ message: 'Contrato não encontrado.' });
  res.json(contract);
});

app.post('/api/contracts/sign/:token', async (req, res) => {
  const contract = await Contract.findOne({ signatureToken: req.params.token });
  if (!contract) return res.status(404).json({ message: 'Contrato não encontrado.' });

  const { signedBy, photoDataUrl } = req.body;
  contract.signed = true;
  contract.signedAt = new Date();
  contract.signedBy = signedBy || contract.clientName;

  if (photoDataUrl && /^data:image\/(png|jpeg|jpg);base64,/.test(photoDataUrl)) {
    const ext = photoDataUrl.includes('image/png') ? 'png' : 'jpg';
    const base64 = photoDataUrl.split(',')[1];
    const fileName = `${contract.code}-assinatura.${ext}`;
    fs.writeFileSync(path.join(contractsDir, fileName), Buffer.from(base64, 'base64'));
    contract.signerPhotoPath = `/Contratos/${fileName}`;
  }

  await contract.save();
  res.json(contract);
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
