const awy = require('./awy.js');

var as = new awy();

as.config.parse_upload = true;
as.config.pid_file = './awy.pid';


as.add(async (rr, next) => {
    rr.res.write('Linux\n');
    await next(rr);
    rr.res.Body += '\nok';
}, ['/', '/test']);

as.get('/', async rr => {
    rr.res.Body = 'success';
});

as.get('/test', async rr => {
    rr.res.Body += 'This is test page';
});

as.post('/test', async rr => {
    rr.res.Body += 'This is test page for POST : ' + rr.req.GetRawBody();
});


as.get('/test/:id/:name', async rr => {
    rr.res.Body += 'This is test page with args' + JSON.stringify(rr.req.RequestARGS);
});

as.post('/postdata', async rr => {
    rr.res.Body = rr.req.GetBody();
});

as.map(['POST', 'PUT'], '/upload', async rr => {
    console.log(rr.req.GetFile('file'));
    console.log(rr.req.GetRawBody());
    rr.res.Body = 'ok';
});


//default 127.0.0.1:2020
as.ants();

