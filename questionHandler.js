'use strict';

const questionModel = require('./questionModel');

exports.create = (question, course) =>

	new Promise((resolve,reject) => {

		const newQuestion = new questionModel({
			timestamp_added: new Date().getTime(),
			question: question,
			course: course
		});

	 	newQuestion.save()

		.then(questionReturned => {
			console.log(questionReturned);
			resolve({ id: questionReturned._id})
		})

		.catch(err => {
			console.log(err);
			reject({ status: 500, message: 'Internal Server Error !' })
		})

	});


exports.getAllQuestions = (course, start_time, end_time) =>

	new Promise((resolve,reject) => {

		questionModel.find({
			$and: [
				{$and: [
					{ timestamp_added: { $gte: (start_time)}},
					{ timestamp_added: { $lt: (end_time)} }]
				},
			 	{course: course}
			]})
	 // questionModel.find({course: course})
	 //questionModel.find()
		.then(questions => {
			// console.log(questionReturned);
			resolve({ questions: questions})
		})

		.catch(err => {
			console.log(err);
			reject({ status: 500, message: 'Internal Server Error !' })
		})

	});


exports.stopAsking = (id, reason) =>

	new Promise((resolve,reject) => {

		// const newQuestion = new questionModel({
		// 	timestamp_added: new Date().getTime(),
		// 	question: question
		// });

	 questionModel.updateOne({_id: id},
		 {$set: {reason: reason, timestamp_stopped: new Date().getTime()}})

		.then(questionReturned => {
			// console.log(questionReturned);
			resolve({})
		})

		.catch(err => {
			console.log(err);
			reject({ status: 500, message: 'Internal Server Error !' })
		})

	});

exports.stopAskingBatch = (ids, reason) =>
    new Promise((resolve,reject) => {

        let t = new Date().getTime();

        questionModel.updateMany({_id: {$in : ids}},
			{$set: {reason: reason, timestamp_stopped: t}})

			.then(questionReturned => {
				// console.log(questionReturned);
				resolve({})
			})

			.catch(err => {
				console.log(err);
				reject({status: 500, message: 'Internal Server Error !'})
			})
    });
