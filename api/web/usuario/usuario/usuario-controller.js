
const router = require('express').Router();
const service = require('./usuario-service');
const multer = require('multer');
const upload = multer({ dest: __dirname + '/upload' });

router.route('/tabela').get(service.tabela);
router.route('/menu').get(service.menu);
router.route('/:id').get(service.buscar);

router.post('/importar',
    upload.single('file'),
    service.importar);
    
router.route('/alterar-senha').post(service.alterarSenha);
router.route('/').post(service.inserir);
router.route('/:id').patch(service.atualizar);
router.route('/:id').delete(service.remover);

module.exports = router;