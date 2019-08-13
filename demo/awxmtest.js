const awxm = require('../awxm.js');

var ant = new awxm();

var {router, group} = ant;

//ant.config.daemon = true;
ant.config.https_on = true;
ant.config.cert = '../rsa/localhost-cert.pem';
ant.config.key = '../rsa/localhost-privkey.pem';

ant.config.body_max_size = 600000000;
ant.config.log_type = 'stdio';
ant.config.auto_options = true;
ant.config.cors = '*';

var api = group('/api');

api.add(async (rr, next) => {
    console.log('middleware in group api.');
    rr.res.write('api group\n');
    //rr.stream.write('api group\n');
    await next(rr);
});

api.get('/x', async rr => {
    rr.res.write('Helo');
});

ant.add(async (rr, next) => {
    await next(rr);
});

router.get('/', async rr => {
    console.log(rr.headers);
    rr.res.data = 'success';
});

router.get('/name', async rr => {
    rr.res.data = rr.name;
}, 'test-name');

router.post('/upload', async rr => {

    var f = rr.getFile('image');
    if (f) {
        //rr.res.data = 'file not found';
        //rr.res.status = 500;
        //return ;
        await rr.moveFile(f, {
            path : '../upload/images'
        }).then(data => {
            rr.res.write(JSON.stringify(data));
        }, err => {
            rr.res.write('failed upload image\n');
        });
    }

    await rr.moveFile(rr.getFile('file'), {
        path : '../upload/images'
    }).then(data => {
        rr.res.write(JSON.stringify(data));
    }, err => {
        rr.res.write('failed upload file\n');
    });

    var vlist = rr.getFile('video', -1);

    for(var i=0; i<vlist.length; i++) {
        await rr.moveFile(vlist[i], {
            path : '../upload/images'
        })
        .then(data => {
            rr.res.write(JSON.stringify(data));
        }, err => {
            rr.res.write('failed upload video\n');
        });
    }

});

router.post('/pt', async rr => {
    console.log(rr.bodyparam);
    rr.res.data = rr.bodyparam;
});

router.map(['GET','POST'], '/rs/:id', async rr => {
    if (rr.method === 'GET') {
        rr.res.data = rr.args;
    } else {
        console.log(rr.args);
        rr.res.data = rr.rawBody;
    }
});

router.get('/ctx-test', async rr => {
    rr.res.data = 'ok';
});

var h = ant.ants('localhost', 2021, 2);
