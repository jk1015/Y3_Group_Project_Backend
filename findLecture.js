const HashMap = require('hashmap');

const slotsMap = new HashMap();
//'Course', 'day-hour' (where 0 is Sunday, 24 hours clock)
slotsMap.multi(
  '475', ['1-19', '2-20'],
  '333', ['2-09', '4-12', '4-13'],
  '349', ['1-09', '3-09', '5-12', '5-13'],
  '343', ['2-11', '4-17'],
  '382', ['1-14', '5-14'],
  '572', ['2-16', '5-09'],
  '316', ['2-14', '4-09'],
  'eie2', ['4-09', '4-15'],
  '362', ['5-15', '5-16', '5-17'],
  '570', ['5-15', '5-16', '5-17']
);

function findSlot(courses){
  var d = new Date();
  const currentSlot = d.getDay() + "-" + d.getHours();

  let returnCourse = null;

  courses.forEach(course => {
    if(slotsMap.has(course)){
      let timeSlots = slotsMap.get(course);
      if(timeSlots.includes(currentSlot)){
        returnCourse = course;
      }
    }
  })

  return returnCourse;
}

module.exports = findSlot;
