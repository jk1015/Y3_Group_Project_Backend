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
const questionHandler = require('./questionHandler');
const timetable = require('./new_timetable');
require('./routes')(router);

app.use('/api', router);

server.listen(port);

app.get('/', (req, res) => {
    res.send('Backend');
});

app.get('/data', (req, res) => {

  questionHandler.getAllQuestions(410) //req.body.code

  .then(result =>{
    console.log(result);
    res.status(200).json(result);
  })

  .catch(err => res.status(err.status).json({ message: "Error" }));

});

console.log(`App Runs on ${port}`);
//console.log(timetable.modules[730].subheading);
let questionMaps = new HashMap();
//let connections = 0;
let fake_lacturers = [
    {user: "lec_1", pass: "123", courses: ['000', '333', '11','12','13', '362']},
    {user: "lec_2", pass: "123", courses: ['343', '21','22','23', '570']},
    {user: "lec_3", pass: "123", courses: ['349', '31','32','33']},
    {user: "lec_4", pass: "123", courses: ['382', '41','42','43']},
    {user: "lec_5", pass: "123", courses: ['316', '51','52','53']},
    {user: "lec_6", pass: "123", courses: ['572', '61','62','63']},
    {user: "lec_7", pass: "123", courses: ['eie2', '71','72','73']},
    {user: "lec_8", pass: "123", courses: ['475', '81','82','83']},
    {user: "lec_9", pass: "123", courses: ['333', '91','92','93']}
  ];

  let fake_students = [
      {user: "stu_1", pass: "123", courses: ['000', '333', '11','12','13', '362']},
      {user: "stu_2", pass: "123", courses: ['000', '343', '21','22','23', '570']},
    ];

function searchFakeLecturer(username, password) {
  let lecturer;
  for (let i = 0; i < fake_lacturers.length; i++) {
    lecturer = fake_lacturers[i];
    if (lecturer.user === username && lecturer.pass === password) {
      return lecturer.courses;
    }
  }
  return null;
}

function searchFakeStudent(username, password) {
  let student;
  for (let i = 0; i < fake_students.length; i++) {
    student = fake_students[i];
    if (student.user === username && student.pass === password) {
      return student.courses;
    }
  }
  return null;
}

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


    //TODO: Error handling on incorrect credentials and other issues
    socket.on('login', (username, password) => {
        // Create new client pointing at the IC ldap server
        let ldapclient = ldap.createClient({
            url: 'ldaps://ldaps-vip.cc.ic.ac.uk:636'
        });

        // Register a LDAP client connection "error" handler
        ldapclient.on('error', function (err) {
            // The LDAP client connection has generated an error...
        });

        // Register a LDAP client connection "connectTimeout" handler
        ldapclient.on('connectTimeout', function (err) {
            // The ldap connection attempt has been timed out...
        });

        // Register a LDAP client connection "connect" handler
        ldapclient.on('connect', function () {
            // The ldap connection is ready to use. Place your subsequent ldapjs code here...
            let dn = 'CN=' + username + ',OU=doc,OU=Users,OU=Imperial College (London),DC=ic,DC=ac,DC=uk'

            // Authenticate with the LDAP server
            // TODO: Backend crashes here if credentials are invalid.

            ldapclient.bind(dn, password, function (err) {

                if (err) {
                    let courses = searchFakeLecturer(username, password);
                    let courses2 = searchFakeStudent(username, password);
                    if (courses) {
                        socket.emit('course received', {
                            doc_user: "lecturer",
                            login: username,
                            displayName: username,
                            lecture: findSlot(courses)
                        });
                    } else if (courses2) {
                        socket.emit('course received', {
                            doc_user: "student",
                            login: username,
                            displayName: username,
                            lecture: findSlot(courses2)
                        });
                    } else {
                        socket.emit('login error', "Invalid credentials");
                    }
                }
                else {

                    // Search parameters - return list of all groups the user belongs to
                    var opts = {
                        attributes: ['displayName', 'memberOf']
                    };

                    ldapclient.search(dn, opts, function (err, res) {

                        if (err) {
                            socket.emit('login error', "Error");
                        }
                        else {
                            res.on('searchEntry', function (entry) {
                                // console.log(entry.object);
                                let membership = entry.object.memberOf;
                                let lectures = [];
                                let len = membership.length;
                                //console.log(entry.object);
                                let doc_user = "student";
                                // Return only groups containing 'doc-students' (enrolment groups)
                                for (var i = 0; i < len; i++) {
                                    let str = membership[i];
                                    str = str.split(',')[0];
                                    if (str.includes("doc-students")) {
                                        str = str.split('students-')[1];
                                        lectures.push(str);
                                    }
                                    if (str.includes("doc-staff")) {
                                        doc_user = "lecturer";
                                    }
                                }

                                // Send list of courses to client
                                // socket.emit('courses received', {courses: lectures});
                                socket.emit('course received', {
                                    doc_user: doc_user,
                                    login: username,
                                    displayName: reorderDisplayName(entry.object.displayName),
                                    lecture: findSlot(lectures)
                                });

                            });
                        }

                    });

                }

            });
        });
    });
});
