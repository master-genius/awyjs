const awy2 = require('../awy2.js');

var ant = new awy2();

ant.config.https_on = true;
ant.config.https_options.cert = '../rsa/localhost-cert.pem';
ant.config.https_options.key = '../rsa/localhost-privkey.pem';

ant.config.parse_upload = true;

ant.config.body_max_size = 600000;

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

ant.post('/pt', async rr => {
    rr.res.Body = rr.req.GetBody();
});

ant.map(['GET','POST'], '/rs/:id', async rr => {
    if (rr.req.method === 'GET') {
        rr.res.Body = rr.req.RequestARGS;
    } else {
        console.log(rr.req.RequestARGS);
        rr.res.Body = rr.req.GetBody();
    }
});

ant.run('localhost', 8456);

