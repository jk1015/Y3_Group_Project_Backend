'use strict';

const questionModel = require('./questionModel');

exports.create = req =>

	new Promise((resolve,reject) => {

		const newQuestion = new questionModel({
			name: req.body.name,
		});

	 newQuestion.save()

	.then(questionReturned => {
		resolve({ status: 200, message: 'Added question'})
	})

	.catch(err => {
		 reject({ status: 500, message: 'Internal Server Error !' })
	 })

  })
