const router  = require('express').Router();
const service = require('./aplicativo-service');

router.route('/download').get(service.download);

module.exports = router;