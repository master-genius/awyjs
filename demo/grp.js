const awxm = require('../aner.js');

var ant = new awxm();

ant.config.https_on = true;
ant.config.cert = '../rsa/localhost-cert.pem';
ant.config.key = '../rsa/localhost-privkey.pem';

ant.config.body_max_size = 600000000;
ant.config.log_type = 'stdio';
ant.config.auto_options = true;
ant.config.cors = '*';


var {router, group} = ant;

var api = group('/api');

api.get('/a', async rr => {
    rr.res.data = {
        a : 1, b: 2
    };
});

api.get('/xyz', async rr => {
    console.log(rr.group);
    rr.res.data = 'xyz';
});


api.add(async (rr, next) => {
    console.log('api say : helo');
    await next(rr);
});

ant.add(async (rr, next) => {
    console.log('global: hey');
    await next(rr);
});

router.get('/api/we', async rr => {
    console.log(rr.req.group, 'nothing to say');
    rr.res.data = 'success';
});

router.options('/*', async rr => {
    console.log('options');
});

api.add(async (rr, next) => {
    console.log('route match : ' + rr.routepath);
    await next(rr);
}, /xy/i);

api.get('a/:c/x', async rr => {
    rr.res.data = rr.args;
});

router.get('x/y/', async rr => {
    rr.res.data = `${rr.path}\n${rr.routepath}`;
});

console.log(ant.api_group_table);

console.log(ant.ApiTable);

console.log(ant.mid_group);

ant.run('localhost', 8099);

