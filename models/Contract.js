const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    clientCode: { type: String, required: true },
    clientName: { type: String, required: true },
    clientDocument: { type: String, required: true },
    clientEmail: { type: String, required: true },
    clientPhone: { type: String, required: true },
    contractValue: { type: Number, required: true },
    descriptionText: { type: String, default: '' },
    clauseTheme: { type: String, default: 'Geral' },
    clauses: { type: [String], default: [] },
    pdfPath: { type: String, default: '' },
    signatureToken: { type: String, required: true, unique: true },
    signed: { type: Boolean, default: false },
    signedAt: { type: Date },
    signedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contract', contractSchema);
