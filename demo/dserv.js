const awy = require('../awy-new.js');

var as = new awy();

as.config.body_max_size = 100000;
as.config.parse_upload = true;
as.config.daemon = true;
as.config.log_type = 'file';
//console.log(process.pid, 'running');

as.add(async (rr, next) => {
    console.log(process.pid);
    await next(rr);
});

as.get('/', async rr => {
    //console.log(as.mid_chain);
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
    //console.log(rr.req);
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

