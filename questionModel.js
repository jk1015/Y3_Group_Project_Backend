'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const questionSchema = mongoose.Schema({

  timestamp_added: Number,
  question: String,
  timestamp_stoped: Number,
  reason: String,
  course: String

});

mongoose.Promise = global.Promise;
const options = {
  useNewUrlParser: true
};
mongoose.createConnection("mongodb://cloud-vm-45-130.doc.ic.ac.uk:27017/myapp", options);

module.exports = mongoose.model('question', questionSchema);
