const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    mustResetPassword: { type: Boolean, default: false },
    passwordPreview: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
