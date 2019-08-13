const http2 = require('http2');
const fs = require('fs');

var opts = {
    peerMaxConcurrentStreams : 200,
    key : fs.readFileSync(
        './rsa/localhost-privkey.pem'
    ),
    cert : fs.readFileSync(
        './rsa/localhost-cert.pem'
    ),
};

var serv = http2.createSecureServer(opts);

serv.on('stream', (stream, headers) => {
    stream.end('1001');
});

serv.on('session', (sess) => {
    console.log(sess.eventNames());
    console.log('session');
});

serv.on('request', (req, res) => {
    console.log('rr');
});

serv.on('checkContinue', (req, res) => {
    console.log('cc');
});

serv.on('tlsClientError', (err, tls) => {
    console.log(err);
        console.log(tls);
});

serv.listen(8009);
