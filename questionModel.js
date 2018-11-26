'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const questionSchema = mongoose.Schema({

  timestamp: Number,
  question: String

});

mongoose.Promise = global.Promise;
const options = {
  useMongoClient: true
};
mongoose.createConnection(FILL IT!!!, options);

module.exports = mongoose.model('question', questionSchema);
