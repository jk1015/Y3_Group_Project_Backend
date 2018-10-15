'use strict';

const express = require('express');
const app = express();
const router = express.Router();
const port = process.env.PORT || 8080;


require('./routes')(router);

app.use('/api', router);

app.listen(port);

console.log(`App Runs on ${port}`);
