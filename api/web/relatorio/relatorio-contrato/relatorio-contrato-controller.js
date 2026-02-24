
const router = require('express').Router();
const service = require('./relatorio-contrato-service');
const multer = require('multer');
const upload = multer({ dest: __dirname + '/upload' });

router.route('/tabela').get(service.tabela);
router.route('/exportar').get(service.exportar);
router.route('/').get(service.buscar);

router.post('/importar',
  upload.single('file'),
  service.importar);

module.exports = router;