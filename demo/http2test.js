const awy2 = require('../awy2.js');

var ant = new awy2();

ant.config.https_on = true;
ant.config.https_options.cert = '../rsa/localhost-cert.pem';
ant.config.https_options.key = '../rsa/localhost-privkey.pem'

ant.config.parse_upload = true;

ant.get('/', async rr => {
    console.log(rr.headers);
    rr.res.Body = 'success';
});

ant.post('/upload', async rr => {

    var f = rr.req.GetFile('image');
    if (!f) {
        rr.res.Body = 'file not found';
        return ;
    }

    await rr.req.MoveFile(f, {
        path : '../upload/images'
    }).then(data => {
        rr.res.Body = data;
    }, err => {
        rr.res.Body = 'failed';
    });
});

ant.run('localhost', 8456);

