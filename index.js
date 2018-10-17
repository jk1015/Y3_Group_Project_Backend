'use strict';

const express = require('express');
const app = express();
const router = express.Router();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 8080;
const HashMap = require('hashmap');

require('./routes')(router);

app.use('/api', router);

server.listen(port);

app.get('/', (req, res) => {
    res.send('Backend');
});

console.log(`App Runs on ${port}`);

let questionsMap = new HashMap();

io.on('connection', (socket) => {
    socket.on('question asked', message => {
        if( questionsMap.has(message)){
           questionsMap.set(message, questionsMap.get(message)+1);
        }
        else{
            questionsMap.set(message, 1);
        }
        socket.emit('question received', { question: message, number: questionsMap.get(message)});
    });

    socket.on('lecturer connect', () => {
        socket.emit('on lecturer connect', questionsMap);
    });
});
