const HashMap = require('hashmap');
const timetable = require('./new_timetable');

const slotsMap = new HashMap();
//'Course', 'day-hour' (where 1 is Monday, 24 hours clock)
slotsMap.multi(
  '000', ['4-18', '3-19', '3-20'],
  '475', ['1-19', '2-20'],
  '333', ['2-09', '4-12', '4-13'],
  '349', ['1-09', '3-09', '5-12', '5-13'],
  '343', ['2-11', '4-17'],
  '382', ['1-14', '5-14'],
  '572', ['2-16', '5-09'],
  '316', ['2-14', '4-09'],
  'eie2', ['4-09', '4-15'],
  '362', ['5-15', '5-16', '5-17', '4-12'],
  '570', ['5-15', '5-16', '5-17']
);

const startDate = new Date(2018, 6, 2);
const endDate = new Date(2019, 5, 24);

function getTimetableSlot(course) {
  let i = 0;
  let modules = timetable.modules;
  for (i = 0; i < modules.length; i++) {
    if (modules[i].subheading.search(course) > -1) {
      return modules[i];
    }
  }
}

// Weeks P1-39, 02/07/2018 - 24/06/2019
function checkCourseSlot(course, startDate, endDate) {
  let courseSlot = getTimetableSlot(course);
  let currentDate = new Date();
  if (courseSlot != null && currentDate <= endDate && currentDate >= startDate) {
    if (courseSlot.events.length > 0) {
      let i, currentWeekNumber;
      for (i = 0; i < courseSlot.events.length; i++) {
        currentWeekNumber = getCurrentWeekNumber(startDate, currentDate);
        if (courseSlot.events[i].rawweeks.charAt(currentWeekNumber) === "Y") {
          if(checkEventHappening(courseSlot.events[i], currentDate)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

function checkEventHappening(event, currentDate) {
  let startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(),
    currentDate.getDate());
  let endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(),
    currentDate.getDate());
  let starttime = event.starttime.split(":");
  let endtime = event.endtime.split(":");
  startDate.setHours(starttime[0]);
  startDate.setMinutes(starttime[1]);
  endDate.setHours(endtime[0]);
  endDate.setMinutes(endtime[1]);
  return currentDate < endtime && currentDate >= starttime;
}

function getCurrentWeekNumber(startDate, currentDate) {
  let monthDifference = currentDate.getMonth() - startDate.getMonth() + 1;
  monthDifference = monthDifference <= 0 ? monthDifference + 12 :
    monthDifference;
  let maxPossibleWeekDifference = Math.ceil((monthDifference * 31) / 7);
  let newDate = new Date(startDate.getFullYear(), startDate.getMonth(),
    startDate.getDate() + maxPossibleWeekDifference * 7);
  while (newDate > currentDate) {
    // console.log(newDate);
    newDate.setDate(newDate.getDate() - 7);
    maxPossibleWeekDifference--;
  }
  return maxPossibleWeekDifference;
}

function findSlot(courses){

  var d = new Date();
  const currentSlot = d.getDay() + "-" + d.getHours();

  let returnCourse = currentSlot; //Testing

  courses.forEach(course => {
    if(checkCourseSlot(course, startDate, endDate)){

       let timeSlots = slotsMap.get(course);
       if(timeSlots.includes(currentSlot)){

         returnCourse = course;
       }
      returnCourse = course;
    }
  })

  return returnCourse;
}

module.exports = findSlot;
