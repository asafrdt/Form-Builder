const express = require('express');
const path = require('path');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const mongoose = require('mongoose');
const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 5000;


var connection = mongoose.createConnection("mongodb://localhost/formbuilder");



// Multi-process to utilize all CPU cores.
if (!isDev && cluster.isMaster) {
  console.error(`Node cluster master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`Node cluster worker ${worker.process.pid} exited: code ${code}, signal ${signal}`);
  });

} else {
  const app = express();

  const bodyParser = require('body-parser')

  // Priority serve any static files.
  app.use(express.static(path.resolve(__dirname, '../form-builder-ui/build')));
  app.use(
    bodyParser.urlencoded({
      extended: true
    })
  )

  app.use(bodyParser.json())

  var autoIncrement = require('mongoose-auto-increment');
  autoIncrement.initialize(connection);

  var formSchema = require('./models/form');
  formSchema.plugin(autoIncrement.plugin, { model: 'Form', field: 'formId' });

  var Form = connection.model('Form', formSchema);

  app.post('/form', (req, res) => {

    var form = new Form({
      name: req.body.payload.form.name,
      inputs: req.body.payload.form.inputs
    });

    form.save(function (err) {

    });
    // res.set('Content-Type', 'application/json');
    // res.send('{"message":"success"}');
    res.sendStatus(200);
  });

  app.get('/form/:formId', (req, res) => {

    var formId = req.params.formId;
    // console.log(formId)
    Form.find({ formId: formId }, function (err, doc) {
      // console.log(doc);

      var formObj = {
        "formId": doc[0].formId,
        "name": doc[0].name,
        "inputs": doc[0].inputs
      }

      res.set('Content-Type', 'application/json');
      res.send(formObj);
    });
  });

  app.get('/forms', (req, res) => {
    Form.find({}, function (err, forms) {
      var userMap = {};
      forms.forEach(function (form) {

        var formObj = {
          "formId": form.formId,
          "name": form.name,
          "inputs": form.inputs

        }
        userMap[form._id] = formObj;
      });

      // res.sendStatus(200);
      res.set('Content-Type', 'application/json');
      res.send(userMap);

    });
  });

  var formSubmissionSchema = require('./models/formSubmission');
  var FormSubmission = connection.model('FormSubmission', formSubmissionSchema);

  app.post('/submit', (req, res) => {

    var formSubmission = new FormSubmission({
      formId:  req.body.payload.form.formId,
      name: req.body.payload.form.name,
      response: req.body.payload.form.response
    });

    // console.log(req)
    // console.log(req.body.payload.form)
    formSubmission.save(function (err) {

    });
    // // res.set('Content-Type', 'application/json');
    // // res.send('{"message":"success"}');
    res.sendStatus(200);
  });

  // Answer API requests.
  app.get('/api', function (req, res) {
    res.set('Content-Type', 'application/json');
    res.send('{"message":"success"}');
  });

  // All remaining requests return the React app, so it can handle routing.
  app.get('*', function (request, response) {
    response.sendFile(path.resolve(__dirname, '../form-builder-ui/build', 'index.html'));
  });

  app.listen(PORT, function () {
    console.error(`Node ${isDev ? 'dev server' : 'cluster worker ' + process.pid}: listening on port ${PORT}`);
  });
}
