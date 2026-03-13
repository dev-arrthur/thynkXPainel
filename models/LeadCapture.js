const mongoose = require('mongoose');

const leadCaptureSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'Pendente Captação',
        'Aguardando Reunião',
        'Pendente Proposta',
        'Pendente Cliente',
        'Captação Concluida',
        'Captação Falhou',
      ],
      default: 'Pendente Captação',
    },
    scheduled: { type: Boolean, default: false },
    scheduledAt: { type: Date },
    city: { type: String, default: '' },
    address: { type: String, default: 'Não Encontrado' },
    email: { type: String, default: 'Não Encontrado' },
    phone: { type: String, default: 'Não Encontrado' },
    site: { type: String, default: 'Não Encontrado' },
    social: { type: String, default: 'Não Encontrado' },
    lat: { type: Number },
    lon: { type: Number },
    source: { type: String, default: 'OpenStreetMap/Overpass' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeadCapture', leadCaptureSchema);
