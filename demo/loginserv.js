const awy = require('../awy2.js');
const awy_cookie = require('../middleware/awy-cookie.js');
const awysession = require('../middleware/awy-session2.js');
const fs = require('fs');

var as = new awy();

as.config.parse_upload = true;
as.config.pid_file = './awy.pid';


as.add(async (rr, next) => {
    if (rr.session['username'] === undefined) {
        //rr.res.statusCode = 301;
        //rr.res.setHeader('Location', '/login');
        rr.res.redirect('/login');
    } else {
        await next(rr);
    }
}, ['/user']);

as.add(async (rr, next) => {
    if (rr.session['username'] !== undefined) {
        //rr.res.statusCode = 301;
        //rr.res.setHeader('Location', '/user');
        rr.res.redirect('/user');
    } else {
        await next(rr);
    }
}, ['/login']);

as.add(awysession.mid);
as.add(awy_cookie);

//使用中间件给res添加重定向函数
as.add(async (rr, next) => {
    rr.res.redirect = function(url) {
        rr.res.statusCode = 301;
        rr.res.setHeader('Location', url);
    };
    await next(rr);
});

/*
    这是一个测试数据，实际的过程是在数据库中查询用户信息。
*/
var userLog = new function() {
    var the = this;

    this.users = {
        'brave' : {
            username : 'brave',
            passwd   : 'helo123',
            user_id  : 1001,
        },
        'bruce' : {
            username : 'bruce',
            passwd   : 'helo125',
            user_id  : 1002,
        },
    };

    this.login = async function (req, username, passwd) {
        if (the.users[username] === undefined) {
            return false;
        }
        
        var u = the.users[username];
        if (u.passwd !== passwd) {
            return false;
        }
        
        var login_state = await awysession.login(req, u);
        
        return login_state;
    };

};

as.map(['GET', 'POST'], '/login', async rr => {
    if (rr.req.method === 'GET') {
        await new Promise((rv, rj) => {
            fs.readFile('./view/login.html', {encoding:'utf8'}, (err, data) => {
                if (err) {
                    rj(err);
                } else {
                    rv(data);
                }
            });
        }).then(data => {
            rr.res.Body = data;
        }, err => {
            rr.res.Body = 'Error: page not found';
        });
    } else {
        var {username, passwd} = rr.req.BodyParam;

        var is_ok = await userLog.login(rr.req, username, passwd);
        
        if (is_ok) {
            //rr.res.statusCode = 301;
            //rr.res.setHeader('Location', '/user');
            rr.res.redirect('/user');
        } else {
            rr.res.Body = {
                status : 10,
                errinfo : 'failed login'
            };
        }

    }
});

as.get('/user', async rr => {
    rr.res.Body = rr.session;
});

as.get('/cookie/test', async rr => {
    rr.res.Body = rr.req.CookieParam;
});

as.get('/headers', async rr => {
    console.log(rr.req);
    rr.res.Body = rr.req.headers;
});

//default 127.0.0.1:2020
as.ants();

