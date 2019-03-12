const awy = require('../awy.js');
const awy_cookie = require('../middleware/awy-cookie.js');
const awy_sess = require('../middleware/awy-session2.js');

var as = new awy();

as.config.parse_upload = true;
as.config.pid_file = './awy.pid';

/*
as.add(async (rr, next) => {
    rr.res.write('Linux\n');
    await next(rr);
    rr.res.Body += '\nok';
}, ['/', '/test']);
*/

as.add(awy_sess.mid);
as.add(awy_cookie);

as.get('/', async rr => {
    rr.res.Body = 'success';
});

as.get('/html', async rr => {
    rr.res.Body = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <title>Test</title>
            </head>
            <body>
                <div>
                    <p>Hello</p>
                </div>
            </body>
        </html>
    `;
});

as.get('/cookie/test', async rr => {
    rr.res.Body = rr.req.CookieParam;
});


as.get('/headers', async rr => {
    console.log(rr.req.headers);
    rr.res.Body = rr.req.headers;
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
