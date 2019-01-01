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

  questionHandler.getAllQuestions(req.params.room)

  .then(result =>{
    res.status(200).json(result);
  })

  .catch(err => res.status(err.status).json({ message: "Error" }));

});

console.log(`App Runs on ${port}`);
//console.log(timetable.modules[730].subheading);

// console.log(checkCourseSlot('382', startDate, endDate));

let questionMaps = new HashMap();

//Since LDAP gives us displayName with surnname, firstname format, below
//function reorder it to firstname surnname format.
function reorderDisplayName(name) {
  let name_part = name.split(", ");
  return name_part[1] + " " + name_part[0];
}

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

      const user = auth.parse(credentials);

      // socket.emit('on rooms lists', new HashMap());

      ldapHandler.login(user.name, user.pass)
      .then((res) => {
        socket.emit('on relogin', res);

        //Check if the user has student or lecturer access
        if(userType == res.doc_user){
          //Check if user have access to this course
          if(res.courses.indexOf(room) > -1){
            socket.join(room);
            if (!questionMaps.size || !questionMaps.has(room)) {
                questionMaps.set(room, new HashMap());
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


    });

    socket.on('get rooms lists', () => {
        let rooms = Object.keys(socket.rooms);
        socket.emit('on rooms lists', rooms);
    });

    socket.on('question asked', (message, user) => {

      questionHandler.create(message, user.room)
      .then((id) => {

        let questionMap = questionMaps.get(user.room);

        if (questionMap.has(message)) {
            let question = questionMap.get(message);
            question.users.push({name: user.name, login: user.login, question_id: id});
            question.count = question.count + 1;
            questionMap.set(message, question);
        } else {
            questionMap.set(message,
                {users: [{name: user.name, login: user.login, question_id: id}], count: 1});
        }

        io.in(user.room).emit('question received', {
            question: message,
            data: questionMap.get(message), question_id: id, user: user.login
        });
      })
      .catch((err) => {
          // io.in(user.room).emit('question received', { question: message,
          //   data: questionMap.get(message)});
      })

    });

    socket.on('lecturer connect', room => {
        //let room = Object.keys(socket.rooms)[1];
        let questionMap = questionMaps.get(room);
        // console.log("Question map after lecturer connect: " + questionMaps.get(room).entries());
        socket.emit('on lecturer connect', questionMap);
    });

    socket.on('answer question', (question, room) => {
        let questionMap = questionMaps.get(room);
        let question_ids = questionMap.get(question).users.map(x => x.question_id.id);
        //console.log(question_ids);
        questionHandler.stopAskingBatch(question_ids, "Lecturer answered question")
        .then(id => {
            questionMap.delete(question);
            io.in(room).emit('question answered', question);
        })
        .catch(err => {
            // io.in(user.room).emit('question received', { question: message,
            //   data: questionMap.get(message)});
        });
    });

    socket.on('clear all', room => {
        let questionMap = questionMaps.get(room);
        let question_ids = [].concat(...questionMap.values().map(x =>
            x.users.map(y => y.question_id.id)
        ));
        //console.log(question_ids);
        questionHandler.stopAskingBatch(question_ids, "Lecturer cleared question")
        .then(id => {
            questionMap.clear();
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
            let questionMap = questionMaps.get(user.room);

            if (questionMap.has(message)) {
                let question = questionMap.get(message);

                if (--question.count <= 0) {
                    questionMap.delete(message);
                } else {
                    question.users = question.users.filter(x => x.name !== user.name);
                    questionMap.set(message, question);
                }
            }
            io.in(user.room).emit('question received', {
                question: message,
                data: questionMap.get(message) ? questionMap.get(message) : null
            });
        })
        .catch((err) => {
            // io.in(user.room).emit('question received', { question: message,
            //   data: questionMap.get(message)});

        });
    });


    socket.on('login', (username, password) => {

      // socket.emit('course received', {});

      ldapHandler.login(username, password)
      .then((res) => {
        socket.emit('course received', res);
      })
      .catch((err) => {
        socket.emit('login error', err);
      })

    });

    socket.on('relogin', credentials => {

      const user = auth.parse(credentials);

      ldapHandler.login(user.name, user.pass)
      .then((res) => {
        socket.emit('course received', res);
      })
      .catch((err) => {
        socket.emit('login error', err);
      })

    });

});
