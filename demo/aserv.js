const awy = require('../awy.js');
//const awy_cookie = require('../middleware/awy-cookie.js');
//const awy_sess = require('../middleware/awy-session2.js');

var as = new awy();

as.config.parse_upload = true;
as.config.pid_file = './awy.pid';
as.config.log_type = 'stdio';

/*
as.add(async (rr, next) => {
    rr.res.write('Linux\n');
    await next(rr);
    rr.res.Body += '\nok';
}, ['/', '/test']);
*/

//as.add(awy_sess.mid);
//as.add(awy_cookie);

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
    rr.res.Body = rr.req.headers;
});

as.get('/test', async rr => {
    rr.res.Body += 'This is test page';
});

as.post('/test', async rr => {
    rr.res.Body += 'This is test page for POST : ' + rr.req.RawBody;
});


as.get('/test/:id/:name', async rr => {
    rr.res.Body += 'This is test page with args' + JSON.stringify(rr.req.Args);
});

as.post('/postdata', async rr => {
    rr.res.Body = rr.req.BodyParam;
});

as.map(['POST', 'PUT'], '/upload', async rr => {
    console.log(rr.req.GetFile('file'));
    console.log(rr.req.RawBody);
    rr.res.Body = 'ok';
});

as.get('/exception', async rr => {
    throw new Error('just for test');
});


as.ants('localhost',9876);
