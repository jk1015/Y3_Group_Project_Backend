'use strict';

const express = require('express');
const app = express();
const router = express.Router();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 8080;
const HashMap = require('hashmap');
const ldap = require('ldapjs');
const assert = require('assert');
const findSlot = require('./findLecture');

require('./routes')(router);

app.use('/api', router);

server.listen(port);

app.get('/', (req, res) => {
    res.send('Backend');
});

console.log(`App Runs on ${port}`);

let questionMaps = new HashMap();
//let connections = 0;


io.on('connection', (socket) => {
    // socket.on('connect', () => {
    //     connections += 1;
    //     io.emit('connection', connections);
    // });

    // socket.on('disconnect', () => {
    //     connections -= 1;
    //     io.emit('disconnection', connections);
    // });
    socket.on('disconnect', () => {
       socket.emit('disconnected');
    });

    socket.on('disconnected', (questions, room) => {
        //let questionMap = questionMaps.get(room);
        //questions.forEach(q => questionMap.set(q, questionMap.get(q)-1));
    });

    socket.on('join room', room => {
        socket.join(room);
        if (!questionMaps.size || !questionMaps.has(room)) {
            questionMaps.set(room, new HashMap());
        }
        let rooms = Object.keys(socket.rooms);
        socket.emit('on rooms lists', rooms);
    });

    socket.on('get rooms lists', () => {
      let rooms = Object.keys(socket.rooms);
      socket.emit('on rooms lists', rooms);
    });

    socket.on('question asked', (message, room) => {
        //let room = Object.keys(socket.rooms)[1];
        //console.log("Question asked in: " + Object.keys(socket.rooms).length);
        let questionMap = questionMaps.get(room);

        if (questionMap.has(message)) {
           questionMap.set(message, questionMap.get(message)+1);
        } else {
            questionMap.set(message, 1);
        }
        // console.log("Question map after asking: " + questionMap.entries());
        io.in(room).emit('question received', { question: message, number: questionMap.get(message)});
    });

    socket.on('lecturer connect', room => {
        //let room = Object.keys(socket.rooms)[1];
        let questionMap = questionMaps.get(room);
        // console.log("Question map after lecturer connect: " + questionMaps.get(room).entries());
        socket.emit('on lecturer connect', questionMap);
    });

    socket.on('answer question', (question, room) => {
        //let room = Object.keys(socket.rooms)[1];
        let questionMap = questionMaps.get(room);
        questionMap.delete(question);
        io.in(room).emit('question answered', question);
    });

    socket.on('clear all', room => {
        //let room = Object.keys(socket.rooms)[1];
        let questionMap = questionMaps.get(room);
        questionMap.clear();
        io.in(room).emit('on clear all');
    })

    socket.on('stop asking', (message, room) => {
        //let room = Object.keys(socket.rooms)[1];
        let questionMap = questionMaps.get(room);

        if (questionMap.has(message)) {
           questionMap.set(message, questionMap.get(message)-1);
           if(questionMap.get(message) <= 0)
             questionMap.delete(message);
        }

        io.in(room).emit('question received', { question: message,
          number: (questionMap.get(message)? questionMap.get(message) : 0)});
    });

    //TODO: Error handling on incorrect credentials and other issues
    socket.on('login', (username, password) => {
      // Create new client pointing at the IC ldap server
      let ldapclient = ldap.createClient({
        url: 'ldaps://ldaps-vip.cc.ic.ac.uk:636'
      });

      // Register a LDAP client connection "error" handler
      ldapclient.on( 'error', function( err ) {
      	// The LDAP client connection has generated an error...
      });

      // Register a LDAP client connection "connectTimeout" handler
      ldapclient.on( 'connectTimeout', function( err ) {
      	// The ldap connection attempt has been timed out...
      });

      // Register a LDAP client connection "connect" handler
      ldapclient.on( 'connect', function( ) {
      	// The ldap connection is ready to use. Place your subsequent ldapjs code here...
        let dn = 'CN=' + username + ',OU=doc,OU=Users,OU=Imperial College (London),DC=ic,DC=ac,DC=uk'

        // Authenticate with the LDAP server
        // TODO: Backend crashes here if credentials are invalid.
        ldapclient.bind(dn, password, function(err) {

          if(err){
            socket.emit('login error', "Invalid credentials");
          }
          else{

            // Search parameters - return list of all groups the user belongs to
            var opts = {
              attributes: ['memberOf']
            };

            ldapclient.search(dn, opts, function(err, res) {

              if(err){
                socket.emit('login error', "Error");
              }
              else{
                res.on('searchEntry', function(entry) {
                  let membership = entry.object.memberOf;
                  let lectures = [];
                  let len = membership.length;

                  // Return only groups containing 'doc-students' (enrolment groups)
                  for (var i = 0; i < len; i++) {
                    let str = membership[i];
                    str = str.split(',')[0];
                    if (str.includes("doc-students")) {
                      str = str.split('students-')[1];
                      lectures.push(str);
                    }
                  }

                  // Send list of courses to client
                  // socket.emit('courses received', {courses: lectures});
                  socket.emit('course received', findSlot(lectures));

                });
              }

            });

          }

        });

      });

    });
});
