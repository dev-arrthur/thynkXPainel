const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');
const Client = require('./models/Client');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@thynkxp.com').toLowerCase();
  const plainPassword = process.env.ADMIN_PASSWORD || '123456';
  const existing = await Admin.findOne({ email });

  if (!existing) {
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    await Admin.create({
      name: 'Administrador',
      email,
      passwordHash,
      mustResetPassword: plainPassword === '123456',
    });
    console.log(`Admin padrão criado: ${email}`);
  }
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    if (admin.mustResetPassword) {
      return res.json({
        requirePasswordReset: true,
        message: 'Primeiro acesso detectado. Redefina sua senha para continuar.',
        email: admin.email,
      });
    }

    return res.json({
      message: 'Login realizado com sucesso.',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro interno no login.' });
  }
});

app.post('/api/auth/reset-password-first-access', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Preencha email, senha atual e nova senha.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(404).json({ message: 'Administrador não encontrado.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Senha atual inválida.' });
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    admin.mustResetPassword = false;
    await admin.save();

    return res.json({
      message: 'Senha redefinida com sucesso.',
      admin: { id: admin._id, name: admin.name, email: admin.email },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao redefinir senha.' });
  }
});

app.get('/api/admins', async (_req, res) => {
  try {
    const admins = await Admin.find().sort({ createdAt: -1 }).select('name email mustResetPassword createdAt');
    return res.json(admins);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao listar administradores.' });
  }
});

app.post('/api/admins', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    const normalizedEmail = email.toLowerCase();
    const exists = await Admin.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: 'Já existe administrador com esse e-mail.' });
    }

    const admin = await Admin.create({
      name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
      mustResetPassword: password === '123456',
    });

    return res.status(201).json({
      id: admin._id,
      name: admin.name,
      email: admin.email,
      mustResetPassword: admin.mustResetPassword,
      createdAt: admin.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao criar administrador.' });
  }
});

app.get('/api/clients', async (_req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    return res.json(clients);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao listar clientes.' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { name, email, company, status, notes } = req.body;
    if (!name || !email || !company) {
      return res.status(400).json({ message: 'Nome, email e empresa são obrigatórios.' });
    }

    const alreadyExists = await Client.findOne({ email: email.toLowerCase() });
    if (alreadyExists) {
      return res.status(409).json({ message: 'Já existe cliente com esse email.' });
    }

    const client = await Client.create({
      name,
      email: email.toLowerCase(),
      company,
      status: status || 'Ativo',
      notes: notes || '',
    });

    return res.status(201).json(client);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao cadastrar cliente.' });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  try {
    if (!MONGODB_URI) {
      throw new Error('Defina MONGODB_URI no .env');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB conectado.');

    await seedAdmin();

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar aplicação:', error.message);
    process.exit(1);
  }
}

start();
