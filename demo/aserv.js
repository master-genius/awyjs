const awy = require('./awy-min.js');

var as = new awy();

as.add(async (rr, next) => {
    rr.res.write('Linux\n');
    await next(rr);
    rr.res.Body += '\nok';
}, ['/', '/test']);

as.get('/', async rr => {
    rr.res.Body = 'success';
});

as.get('/test', async rr => {
    rr.res.Body = 'This is test page';
});

as.post('/postdata', async rr => {
    rr.res.Body = rr.req.GetBody();
});


//default 127.0.0.1:2020
as.run();

