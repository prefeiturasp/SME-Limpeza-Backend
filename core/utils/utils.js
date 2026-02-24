const appRoot = require('app-root-path');
const fs = require('fs');
const moment = require('moment');

exports.parseDate = (dateInput) => {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
    return moment(dateInput, 'DD/MM/YYYY');
  }
  return moment(dateInput);
};

exports.parseNumberCsv = (str) => {

  const containsComma = str.includes(',');
  const containsDot = str.includes('.');

  let decimalSeparator = '.';
  let thousandSeparator = ',';

  if (containsComma && containsDot) {
    if (str.indexOf(',') > str.indexOf('.')) {
      decimalSeparator = ',';
      thousandSeparator = '.';
    }
  } else if (containsComma) {
    const parts = str.split(',');
    if (parts[parts.length - 1].length === 3) {
      thousandSeparator = ',';
      decimalSeparator = '.';
    } else {
      decimalSeparator = ',';
      thousandSeparator = '.';
    }
  }

  const normalizedNumber = str
    .replace(new RegExp(`\\${thousandSeparator}`, 'g'), '')
    .replace(new RegExp(`\\${decimalSeparator}`), '.');

  return parseFloat(normalizedNumber);

};

exports.isEmpty = async (value) => {
  return value == undefined || value == null || !value.toString().trim().length;
};

exports.toUpper = async (value) => {
  if (await this.isEmpty(value)) return value;
  return value.toString().toUpperCase();
};

exports.coalesce = async (value, valueOr) => {
  return await this.isEmpty(value) ? valueOr : value;
};

exports.getDatatableParams = async (req) => {
  let params = req.query;
  if (! await this.isEmpty(params.filters)) {
    params.filters = JSON.parse(params.filters);
  }
  return params;
};

exports.isTrue = async (value) => {
  if (await this.isEmpty(value)) {
    return false;
  }
  return value == true;
};

exports.isAllEmpty = async (arr = []) => {
  let res = true;
  arr.forEach(async (value) => {
    if (! await this.isEmpty(value)) {
      res = false;
    }
  });
  return res;
};

exports.getBase64Logo = async () => {
  const bitmap = fs.readFileSync(appRoot + '/core/assets/img/logo-preto-vertical.png');
  return new Buffer.from(bitmap).toString('base64');
}

exports.getExportCSS = async () => {
  const data = fs.readFileSync(appRoot + '/core/assets/pdf-export-style.css', 'utf8');
  return data.toString();
}

exports.getWeekDayName = (weekDayNumber) => {
  const diaSemanaList = [
    { id: 1, descricao: 'Segunda-feira' },
    { id: 2, descricao: 'Terça-feira' },
    { id: 3, descricao: 'Quarta-feira' },
    { id: 4, descricao: 'Quinta-feira' },
    { id: 5, descricao: 'Sexta-feira' },
  ];
  const weekDay = diaSemanaList.find((weekDay) => weekDay.id === weekDayNumber);
  return weekDay?.descricao || '';
}