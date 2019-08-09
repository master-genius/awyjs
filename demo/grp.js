const awy = require('../awy.js');

var ant = new awy();

var api = ant.group('/api');

api.get('/a', async rr => {
    rr.res.Body = {
        a : 1, b: 2
    };
});

api.get('/xyz', async rr => {
    console.log(rr.req.RequestGroup);
    rr.res.Body = 'xyz';

});


api.add(async (rr, next) => {
    console.log('api say : helo');
    await next(rr);
});

ant.add(async (rr, next) => {
    console.log('global: hey');
    await next(rr);
});

ant.get('/api/we', async rr => {
    console.log(rr.req.RequestGroup, 'nothing to say');
    rr.res.Body = 'success';
});

ant.options('/*', async rr => {
    console.log('options');
});

api.add(async (rr, next) => {
    console.log('api sub : running');
    await next(rr);
}, /xy/i);

/* console.log(ant.api_group_table);

console.log(ant.ApiTable);

console.log(ant.mid_group);
 */
ant.run('localhost', 8099);

