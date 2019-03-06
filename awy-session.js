const fs = require('fs');
const crypto = require('crypto');

module.exports = async function(rr, next) {
    if (!rr.cookie) {
        rr.cookie = {
            expires : false,
            //domain  : rr.req.headers['host'],
            domain  : false,
            path    : '/',
            cookie_dir : '/tmp'
        };
    }
    
    var sess_file = '';
    var sessid = rr.req.GetCookieParam('AWY_SESSIONID');
    var sess_state = false;

    if (sessid) {
        sess_file = rr.cookie.cookie_dir 
            + '/' + 'awy_sess_' 
            + sessid;

        await new Promise((rv, rj) => {
            fs.readFile(sess_file, (err, data) => {
                if (err) {
                    rj(err);
                } else {
                    sess_state = true;
                    rv(data);
                }
            });
        }).then(data => {
            rr.session = JSON.parse(data);
        }, err => {
            sess_state = false;
        });
    }

    if (sessid === undefined || sess_state === false) {
        
        rr.session = {};

        var org_name = `${rr.req.headers['host']}_${Date.now()}__${Math.random()}`;
        var hash = crypto.createHash('sha1');
        hash.update(org_name);
        var sessid = hash.digest('hex');

        sess_file = 'awy_sess_' + sessid;

        var set_cookie = `AWY_SESSIONID=${sessid};`;
        if (rr.cookie.expires) {
            var t = new Date(Date.now() + rr.cookie.expires *1000);
            set_cookie += `Expires=${t.toString()};`;
        }

        if (rr.cookie.path) {
            set_cookie += `Path=${rr.cookie.path};`;
        } else {
            set_cookie += 'Path=/;';
        }

        if (rr.cookie.domain) {
            set_cookie += `Domain=${rr.cookie.domain}`;
        }

        await new Promise((rv, rj) => {
            fs.writeFile(rr.cookie.cookie_dir + '/' + sess_file, '{}', err => {
                if (err) {
                    rj(err);
                } else {
                    rv(true);
                }
            });
        }).then(data => {
            rr.res.setHeader('Set-Cookie', set_cookie);
        }, err => {

        });

    }

    await next(rr);

};
