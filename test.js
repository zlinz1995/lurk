import http from 'http';
const server = http.createServer((req, res) => { res.end('ok'); });
const PORT = process.env.PORT || 3000;

