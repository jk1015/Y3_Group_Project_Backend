const ldap = require('ldapjs');
const findSlot = require('./findLecture');

exports.login = (username, password) =>

	new Promise((resolve,reject) => {

		// USE THIS CODE FOR TESTING
		/*
		if (username == "" || password == "") {
			reject("Please enter a username and password");
			return;
		}

		let courses = searchFakeLecturer(username, password);
		let courses2 = searchFakeStudent(username, password);
		if (courses) {
				resolve({
						doc_user: "lecturer",
						login: username,
						displayName: username,
						lecture: '000',
						courses: courses
				});
		} else if (courses2) {

				resolve({
						doc_user: "student",
						login: username,
						displayName: username,
						lecture: '000',
						courses: courses2
				});
		} else {
				reject("Invalid credentials");
		}
		*/



    if (username == "" || password == "") {
      // socket.emit('login error', "Please enter a username and password");
      reject("Please enter a username and password");
      return;
    }
    // Create new client pointing at the IC ldap server
    let ldapclient = ldap.createClient({
        url: 'ldaps://ldaps-vip.cc.ic.ac.uk:636'
    });

    // Register a LDAP client connection "error" handler
    ldapclient.on('error', function (err) {
      reject("Error");
      // The LDAP client connection has generated an error...
    });

    // Register a LDAP client connection "connectTimeout" handler
    ldapclient.on('connectTimeout', function (err) {
      reject("Connection timeout");
      // The ldap connection attempt has been timed out...
    });

    // Register a LDAP client connection "connect" handler
    ldapclient.on('connect', function () {
      //The ldap connection is ready to use. Place your subsequent ldapjs code here...
      let dn = 'CN=' + username + ',OU=doc,OU=Users,OU=Imperial College (London),DC=ic,DC=ac,DC=uk'

      ldapclient.bind(dn, password, function (err) {

        if (err) {
            let courses = searchFakeLecturer(username, password);
            let courses2 = searchFakeStudent(username, password);
            if (courses) {
                resolve({
                    doc_user: "lecturer",
                    login: username,
                    displayName: username,
                    lecture: findSlot(courses),
                    courses: courses
                });
            } else if (courses2) {
                resolve({
                    doc_user: "student",
                    login: username,
                    displayName: username,
                    lecture: findSlot(courses2),
                    courses: courses2
                });
            } else {
                // socket.emit('login error', "Invalid credentials");
                reject("Invalid credentials");
            }
        }
        else {

          // Search parameters - return list of all groups the user belongs to
          var opts = {
              attributes: ['displayName', 'memberOf']
          };

          ldapclient.search(dn, opts, function (err, res) {

            if (err) {
                // socket.emit('login error', "Error");
                reject("Error");
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

                resolve({
                    doc_user: doc_user,
                    login: username,
                    displayName: reorderDisplayName(entry.object.displayName),
                    lecture: findSlot(lectures),
                    courses: lectures
                });

              });
            }

          });

        }

      });
    });

});

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
