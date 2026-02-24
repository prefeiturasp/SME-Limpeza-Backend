const utils = require('rfr')('core/utils/utils.js');

const cepPromise = require('cep-promise');
const axios = require('axios');


exports.buscarCep = async (cep) => {

    return cepPromise(cep).then((response) => {
        return {
            endereco: response.street,
            bairro: response.neighborhood,
            municipio: response.city,
            uf: response.state
        };
    }).catch((error) => {
        return null;
    });

    

};

exports.buscarCoordenadas = async (endereco) => {
    
    const data = {
        'text': typeof endereco == 'string' ? endereco : `${endereco.endereco.replace(/[0-9]/g, '')}, ${endereco.numero}, ${endereco.bairro}, ${endereco.municipio}, ${endereco.uf}`,
        'layers':  'address',
        'boundary.gid': 'whosonfirst:locality:101965533'
    };

    const parameters = new URLSearchParams(data);
    
    return axios.get('https://georef.sme.prefeitura.sp.gov.br/v1/search?' + parameters)
        .then((response) => {
            return {
                lng: response.data.features[0].geometry.coordinates[0],
                lat: response.data.features[0].geometry.coordinates[1]
            };
        }).catch((err) => {
            console.error(err);
            return null;
        });

};