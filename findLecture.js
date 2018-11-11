const HashMap = require('hashmap');

const slotsMap = new HashMap();

slotsMap.multi(
  '475', ['1-19', '2-20'] //'Course', 'day-hour' (where 0 is Sunday, 24 hours clock)
);

function findSlot(courses){
  var d = new Date();
  const currentSlot = d.getDay() + "-" + d.getHours();

  let returnCourse;

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
