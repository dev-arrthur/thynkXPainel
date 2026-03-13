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
  const email = process.env.ADMIN_EMAIL || 'admin@thynkxp.com';
  const plainPassword = process.env.ADMIN_PASSWORD || '123456';
  const existing = await Admin.findOne({ email });

  if (!existing) {
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    await Admin.create({ name: 'Administrador', email, passwordHash });
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
