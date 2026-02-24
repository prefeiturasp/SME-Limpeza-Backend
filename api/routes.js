
require('express-group-routes');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

app.use(cors());
app.options('*', cors());
app.use(morgan('dev'));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));

app.use(require('./system/routes'));
app.use(require('./web/routes'));
app.use(require('./app/routes'));

app.use((req, res, next) => {
    const error = new Error('Rota não encontrada.');
    error.status = 404;
    next(error);
});

app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json(error.message);
});

module.exports = app;