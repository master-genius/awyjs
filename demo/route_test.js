const awy = require('../awy.js');

var ant = new awy();

/*
ant.get('/*', async rr => {
    rr.res.Body = rr.req.ORGPATH + ' ' + rr.req.ROUTEPATH;
});
*/

ant.get('/static/:type/*', async rr => {
    rr.res.Body = rr.req.ORGPATH + ' ' + rr.req.ROUTEPATH;
});

ant.get('/content/w/*', async rr => {
    rr.res.Body = rr.req.ORGPATH + ' ' + rr.req.ROUTEPATH;
});

ant.get('/rs/:type/:id', async rr => {
    rr.res.Body = rr.req.ORGPATH + ' ' + rr.req.ROUTEPATH;
});


ant.run('localhost', 2019);

