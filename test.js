import http from 'http';
const server = http.createServer((req, res) => { res.end('ok'); });
server.listen(3000, () => console.log('TEST listening http://localhost:3000'));
