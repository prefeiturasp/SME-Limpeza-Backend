const utils = require('rfr')('core/utils/utils.js');
const fs = require('fs');
const csvToJson = require("csvtojson/v2");
const jsonToCsv = require('json-2-csv');


exports.converterFromCsv = async (file) => {

    if(await utils.isEmpty(file)) {
        return false;
    }

    const json = await csvToJson({
        delimiter: ';',
        ignoreEmpty: true
    }).fromFile(file.path);

    fs.unlinkSync(file.path);

    return json;

};

exports.converterFromJson = async (json) => {

    try {
        const csv = await jsonToCsv.json2csvAsync(json, {
            delimiter : {
                field : ';'
            },
            excelBOM: true,
            useLocaleFormat: true
        });
        return csv;
        // fs.writeFileSync('todos.csv', csv);
    } catch (error) {
        console.log(error);
        throw error;
    }

};

exports.verificarEstruturaInvalida = async (dados, estrutura) => {
    
    if(await utils.isEmpty(dados)) {
        return `O arquivo está vazio.`;
    }

    for (const [i, v] of dados.entries()) {
        if(JSON.stringify(Object.keys(v)) !== JSON.stringify(estrutura)) {
            return `A estrutura dos dados da linha ${i+2} não é válida.`;
        }
    }

    return false;

};