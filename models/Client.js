const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    company: { type: String, required: true },
    status: { type: String, enum: ['Ativo', 'Em negociação', 'Inativo'], default: 'Ativo' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', clientSchema);
