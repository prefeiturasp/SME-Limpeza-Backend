const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const app = require('./api/routes');
const server = http.createServer(app);
// server.setTimeout(120000);

server.listen(process.env.SERVER_PORT);
console.log(`\n 🚀 Listening on port ${process.env.SERVER_PORT} 🚀 \n`);
