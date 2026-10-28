const mongoose = require('mongoose');
const ownerId = () => ({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true });
const reference = model => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null });
const finiteNumber = (minimum = 0) => ({ type: Number, min: minimum,
  validate: { validator: value => value == null || Number.isFinite(value), message: 'Value must be finite' } });
const positiveInteger = () => ({ type: Number, default: 1, min: 1,
  validate: { validator: Number.isSafeInteger, message: 'Value must be a positive integer' } });
const genres = () => ({ type: [{ type: String, trim: true, maxlength: 64, required: true }], default: [],
  validate: { validator: values => values.length <= 20, message: 'At most 20 genres are allowed' } });
module.exports = { ownerId, reference, finiteNumber, positiveInteger, genres };
