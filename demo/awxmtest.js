const awxm = require('../awxm.js');

var ant = new awxm();

ant.config.https_on = true;
ant.config.https_options.cert = '../rsa/localhost-cert.pem';
ant.config.https_options.key = '../rsa/localhost-privkey.pem';

ant.config.parse_upload = true;
ant.config.body_max_size = 6000000;
ant.config.log_type = 'stdio';
ant.config.auto_options = true;
ant.config.cors = '*';

var api = ant.group('/api');

api.add(async (rr, next) => {
    console.log('middleware in group api.');
    rr.res.write('api group\n');
    //rr.stream.write('api group\n');
    await next(rr);
});

api.get('/x', async rr => {
    rr.res.data = 'Helo';
});

ant.add(async (rr, next) => {
    await next(rr);
});

ant.get('/', async rr => {
    console.log(rr.headers);
    rr.res.data = 'success';
});

ant.post('/upload', async rr => {

    console.log(rr.bodyparam);

    console.log(rr.files.file);

    var f = rr.getFile('image');
    if (!f) {
        rr.res.data = 'file not found';
        return ;
    }

    await rr.moveFile(rr.getFile('file'), {
        path : '../upload/images'
    });

    await rr.moveFile(f, {
        path : '../upload/images'
    }).then(data => {
        rr.res.data = data;
    }, err => {
        rr.res.data = 'failed';
    });

});

ant.post('/pt', async rr => {
    console.log(rr.bodyparam);
    rr.res.data = 'ok';
});

ant.map(['GET','POST'], '/rs/:id', async rr => {
    if (rr.method === 'GET') {
        rr.res.data = rr.args;
    } else {
        console.log(rr.args);
        rr.res.data = rr.rawBody;
    }
});

ant.run('localhost', 2021);
