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
const questionHandler = require('./questionHandler');
const timetable = require('./new_timetable');
const cors = require('cors');
const auth = require('basic-auth');
const ldapHandler = require('./ldapHandler');
const CryptoJS = require("crypto-js");
const SECRET_KEY = "EwWtEuAwByns9uALoH3zUdY5FoTAQzeq";

app.use(cors());

require('./routes')(router);

app.use('/api', router);

server.listen(port);

// app.all('/', function(req, res, next) {
//  res.header("Access-Control-Allow-Origin", "*");
//  res.header("Access-Control-Allow-Headers", "X-Requested-With");
//  next();
// });

app.get('/', (req, res) => {
    res.send('Backend');
});

app.post('/data/:room', (req, res) => {

  questionHandler.getAllQuestions(
    req.params.room,
    req.body.start_time,
    req.body.end_time)

  .then(result =>{
    res.status(200).json(result);
  })

  .catch(err => res.status(err.status).json(err.message));

});

console.log(`App Runs on ${port}`);
//console.log(timetable.modules[730].subheading);

// console.log(checkCourseSlot('382', startDate, endDate));

let studentQuestionMaps = new HashMap();
let lecturerQuestionMaps = new HashMap();


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

    socket.on('join room', (credentials, room, userType) => {

      const bytes  = CryptoJS.AES.decrypt(credentials, SECRET_KEY);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      const user = auth.parse(plaintext);
      // socket.emit('on rooms lists', new HashMap());


      if(user && user.name && user.pass){
        ldapHandler.login(user.name, user.pass)
        .then((res) => {
          socket.emit('on relogin', res);

          //Check if the user has student or lecturer access
          if(userType == res.doc_user){
            //Check if user have access to this course
            if(res.courses.indexOf(room) > -1){
              socket.join(room);
              if (!studentQuestionMaps.size || !studentQuestionMaps.has(room)) {
                  studentQuestionMaps.set(room, new HashMap());
              }
              if (!lecturerQuestionMaps.size || !lecturerQuestionMaps.has(room)) {
                  lecturerQuestionMaps.set(room, new HashMap());
              }
              let rooms = Object.keys(socket.rooms);
              socket.emit('on rooms lists', rooms);
            }
            else{
              socket.emit('on join error', 'You are not signed to this course');
            }
          }
          else{
            socket.emit('on join error', 'Cannot access this course');
          }

        })
        .catch((err) => {
          socket.emit('on join error', err);
        })
      }
      else{
        socket.emit('login error', 'Invalid token');
      }

    });

    socket.on('get rooms lists', () => {
        let rooms = Object.keys(socket.rooms);
        socket.emit('on rooms lists', rooms);
    });

    socket.on('question asked', (message, data) => {

      if(data.user.type == "student") {
        questionHandler.create(message, data.user.room)
        .then((id) => {

          let studentQuestionMap = studentQuestionMaps.get(data.user.room);

          if (studentQuestionMap.has(message)) {
              let question = studentQuestionMap.get(message);
              question.users.push({name: data.user.name, login: data.user.login, question_id: id});
              question.count = question.count + 1;
              studentQuestionMap.set(message, question);
          } else {
              studentQuestionMap.set(message,
                  {users: [{name: data.user.name, login: data.user.login, question_id: id}], count: 1});
          }

          io.in(data.user.room).emit('question received', {
              question: message,
              data: studentQuestionMap.get(message),
              question_id: id,
              user: data.user.login,
              type: "student"
          });
        })
        .catch((err) => {
            // io.in(data.user.room).emit('question received', { question: question,
            //   data: questionMap.get(question)});
        })
      }
      else if(data.user.type == "lecturer") {

        let lecturerQuestionMap = lecturerQuestionMaps.get(data.user.room);

        //Add to database
        let id = 0;
        //Add to lecturer question map
        if (!lecturerQuestionMap.has(message)) {
          lecturerQuestionMap.set(message,
            {answers: [],
             type: data.question_type,
             options: data.options,
             count: 0});
        }

        //Emit into room
        io.in(data.user.room).emit('question received', {
            question: message,
            data: lecturerQuestionMap.get(message),
            question_id: id,
            user: data.user.login,
            type: data.question_type,
            options: data.options
        });
      }

    });

    socket.on('lecturer connect', room => {
        //let room = Object.keys(socket.rooms)[1];
        let studentQuestionMap = studentQuestionMaps.get(room);
        let lecturerQuestionMap = lecturerQuestionMaps.get(room);
        // console.log("Question map after lecturer connect: " + questionMaps.get(room).entries());
        socket.emit('on lecturer connect', {sqm: studentQuestionMap, lqm: lecturerQuestionMap});
    });

    socket.on('answer student question', (question, room) => {
        let studentQuestionMap = studentQuestionMaps.get(room);
        let question_ids = studentQuestionMap.get(question).users.map(x => x.question_id.id);
        console.log(question_ids);
        questionHandler.stopAskingBatch(question_ids, "answered question")
        .then(id => {
            studentQuestionMap.delete(question);
            io.in(room).emit('student question answered', question);
        })
        .catch(err => {
            // io.in(user.room).emit('question received', { question: message,
            //   data: questionMap.get(message)});
        });
    });

    socket.on('answer lecturer question', (question, answer, room) => {
        let lecturerQuestionMap = lecturerQuestionMaps.get(room);
        lecturerQuestionMap.get(question).answers.push(answer);
        (lecturerQuestionMap.get(question).count)++;
        io.in(room).emit('lecturer question answered', {question: question, answer: answer})
    });

    socket.on('clear all', room => {
        let lecturerQuestionMap = lecturerQuestionMaps.get(room);
        let studentQuestionMap = studentQuestionMaps.get(room);
        let question_ids = [].concat(...studentQuestionMap.values().map(x =>
            x.users.map(y => y.question_id.id)
        ));
        //console.log(question_ids);
        questionHandler.stopAskingBatch(question_ids, "Lecturer cleared question")
        .then(id => {
            lecturerQuestionMap.clear();
            studentQuestionMap.clear();
            io.in(room).emit('on clear all');
        })
        .catch(err => {
            // io.in(user.room).emit('question received', { question: message,
            //   data: questionMap.get(message)});
        });
    });

    socket.on('stop asking', (message, user) => {
        //let room = Object.keys(socket.rooms)[1];
        //console.log(user.question_id);
        questionHandler.stopAsking(user.question_id, "Student withdrew question")
        .then(id => {
            let studentQuestionMap = studentQuestionMaps.get(user.room);

            if (studentQuestionMap.has(message)) {
                let question = studentQuestionMap.get(message);

                if (--question.count <= 0) {
                    studentQuestionMap.delete(message);
                } else {
                    question.users = question.users.filter(x => x.name !== user.name);
                    studentQuestionMap.set(message, question);
                }
            }
            io.in(user.room).emit('question received', {
                question: message,
                data: studentQuestionMap.get(message) ? studentQuestionMap.get(message) : null
            });
        })
        .catch((err) => {
            // io.in(user.room).emit('question received', { question: message,
            //   data: questionMap.get(message)});

        });
    });


    socket.on('login', (username, password) => {

      ldapHandler.login(username, password)
      .then((res) => {

        const credentials = username + ':' + password;
        var ciphertext = CryptoJS.AES.encrypt('Basic ' + Buffer.from(credentials).toString('base64'), SECRET_KEY);
        res.token = ciphertext.toString();

        socket.emit('course received', res);
      })
      .catch((err) => {
        console.log(err);
        socket.emit('login error', err);
      })

    });

    socket.on('relogin', credentials => {

      const bytes  = CryptoJS.AES.decrypt(credentials, SECRET_KEY);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      const user = auth.parse(plaintext);

      if(user && user.name && user.pass){
        ldapHandler.login(user.name, user.pass)
        .then((res) => {
          socket.emit('course received', res);
        })
        .catch((err) => {
          socket.emit('login error', err);
        })
      }
      else{
        socket.emit('login error', 'Invalid token');
      }

    });

});
