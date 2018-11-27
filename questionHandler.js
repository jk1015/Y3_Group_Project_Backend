'use strict';

const questionModel = require('./questionModel');

exports.create = (question, course) =>

	new Promise((resolve,reject) => {

		console.log("1");
		const newQuestion = new questionModel({
			timestamp_added: new Date().getTime(),
			question: question,
			course: course
		});

	console.log("2");
	 	newQuestion.save()

		.then(questionReturned => {
			console.log(questionReturned);
			resolve({ id: questionReturned._id})
		})

		.catch(err => {
			console.log(err);
			reject({ status: 500, message: 'Internal Server Error !' })
		})

	})


exports.getAllQuestions = (course) =>

	new Promise((resolve,reject) => {
		console.log("IN2");

		// const newQuestion = new questionModel({
		// 	timestamp_added: new Date().getTime(),
		// 	question: question
		// });

	 questionModel.find({})

		.then(questions => {
			console.log("IN3");
			// console.log(questionReturned);
			resolve({ questions: questions})
		})

		.catch(err => {
			console.log(err);
			reject({ status: 500, message: 'Internal Server Error !' })
		})

	})


exports.stopAsking = (id, reason) =>

	new Promise((resolve,reject) => {

		// const newQuestion = new questionModel({
		// 	timestamp_added: new Date().getTime(),
		// 	question: question
		// });

	 questionModel.update({_id: id},
		 {$set: {reason: reason, timestamp_stoped: new Date().getTime()}})

		.then(questionReturned => {
			// console.log(questionReturned);
			resolve({ id: questionReturned._id})
		})

		.catch(err => {
			console.log(err);
			reject({ status: 500, message: 'Internal Server Error !' })
		})

	})
