const fs = require('fs');
const crypto = require('crypto');

/*
    这个模块用于awy框架的登录会话，中间件调用一定要在awy-cookie中间件之后。
    整体的过程就是在基于cookie中间件的解析结果，如果检测到cookie中有会话ID
    则寻找文件并读取数据，解析成JSON对象添加到rr.session；如果cookie中
    没有会话ID或者读取文件失败则创建会话文件并发送Set-Cookie头部信息保存会话ID。

    中间件提供的login和logout操作仅仅是用于设置或清除数据的操作。

    实际的登录操作是在对比用户信息后，如果通过则调用此中间件login函数
    把用户信息保存即可。

*/

module.exports = new function () {

    var the = this;

    this.config = {
        expires : false,

        domain  : false,

        path    : '/',

        cookie_dir : '/tmp',

        prefix : 'awysess_'

    };

    this.mid = async function(rr, next) {
        
        var sess_file = '';
        var sessid = rr.req.GetCookieParam('AWY_SESSIONID');
        var sess_state = false;

        if (sessid) {
            sess_file = the.config.cookie_dir 
                + '/' + the.config.prefix
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

            sess_file = the.config.prefix + sessid;

            var set_cookie = `AWY_SESSIONID=${sessid};`;
            if (the.config.expires) {
                var t = new Date(Date.now() + the.config.expires *1000);
                set_cookie += `Expires=${t.toString()};`;
            }

            if (the.config.path) {
                set_cookie += `Path=${the.config.path};`;
            } else {
                set_cookie += 'Path=/;';
            }

            if (the.config.domain) {
                set_cookie += `Domain=${the.config.domain}`;
            }

            await new Promise((rv, rj) => {
                fs.writeFile(the.config.cookie_dir + '/' + sess_file, '{}', err => {
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

    this.login = async function(req, u) {
        var sessid = req.GetCookieParam('AWY_SESSIONID', '');
        if (!sessid) {
            return false;
        }

        var sess_file = the.config.cookie_dir + '/' + the.config.prefix + sessid;

        await new Promise((rv, rj) => {
            fs.writeFile(sess_file, JSON.stringify(u), err => {
                if (err) {
                    rj(err);
                } else {
                    login_state = true;
                    rv(u);
                }
            });
        }).then(data => {
            req.session = data;
        }, err => {

        });
        
        return login_state;
    };

    this.logout = async function(req) {
        var sessid = req.GetCookieParam('AWY_SESSIONID', '');
        if (!sessid) {
            return false;
        }

        var status = false;
        var sess_file = the.config.cookie_dir + '/' + the.config.prefix + sessid;

        await fs.writeFile(sess_file, '{}', err => {
            if (err) {
                rj(err);
            } else {
                rv(true);
            }
        }).then(data => {
            req.session = {};
            status = true;
        }, err => {
            
        });
        return status;
    };

};
