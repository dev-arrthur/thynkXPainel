const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true },
    companyName: { type: String, required: true },
    companyDocument: { type: String, required: true },
    companyEmail: { type: String, required: true, lowercase: true },
    companyPhone: { type: String, required: true },
    city: { type: String, required: true },
    contractValue: { type: Number, default: 0 },
    responsibleCpf: { type: String, required: true },
    responsibleName: { type: String, required: true },
    responsibleSurname: { type: String, required: true },
    responsibleEmail: { type: String, required: true, lowercase: true },
    responsiblePhone: { type: String, required: true },
    accessEmail: { type: String, required: true, lowercase: true },
    accessPassword: { type: String, required: true },
    mustResetPassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', clientSchema);
