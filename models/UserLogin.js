const mongoose = require('mongoose');

const userLoginSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  loginDate: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String
  }
});

module.exports = mongoose.model('UserLogin', userLoginSchema);