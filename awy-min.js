const fs = require('fs');
const qs = require('querystring');
const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');
const cluster = require('cluster');
const os = require('os');
const {spawn} = require('child_process');

var awy = function () {
    
    var the = this;

    this.config = {
        //此配置表示POST提交表单的最大字节数，也是上传文件的最大限制，
        //注意在run函数中设置了上限的最小值，如果用户设置的上限过低则会自动改为最小值。
        post_max_size   : 10000000,

        //静态文件根目录
        static_path     : '',

        //开启静态文件支持
        static_on       : false,

        //忽略路径最后的/
        ignore_last_slash : true,

        //开启守护进程，守护进程用于上线部署，要使用ants接口，run接口不支持
        daemon          : false,

        log_file        : './access.log',

        error_log_file  : './error.log',

        /*
            日志类型：
                stdio   标准输入输出，可用于调试
                ignore  没有
                file    文件，此时会使用log_file以及error_log_file 配置的文件路径

            这个选项以及两个日志文件配置只有在开启daemon的情况下才会生效
        */
        log_type        : 'stdio',

        /*
            mem, path
            暂时只是实现了mem模式，文件会被放在内存里。

        */
        upload_mode     : 'mem',

        upload_tmp_path : '/tmp',

        //默认上传路径，自动上传函数会使用
        upload_path     : './upload',

        //开启HTTPS
        https_on        : false,

        //HTTPS密钥和证书的路径
        https_options   : {
            key     : '',
            cert    : ''
        },

    };

    this.ApiTable = {};
    
    this.get = function(api_path, callback) {
        this.addPath(api_path, 'GET', callback);
    };

    this.post = function(api_path, callback) {
        this.addPath(api_path, 'POST', callback);
    };
    
    this.put = function(api_path, callback) {
        this.addPath(api_path, 'PUT', callback);
    };

    this.delete = function(api_path, callback) {
        this.addPath(api_path, 'DELETE', callback);
    };

    this.any = function(api_path, callback) {
        this.addPath(api_path, 'ANY', callback);
    };

    this.addPath = function(api_path, method, callback) {
        var i = api_path.search('@');
        if (i >= 0) {
            var pt = api_path.split('/').filter(p => p.length > 0);
            if (pt[pt.length-1].search('@') < 0) {
                throw new Error('path route illegal : @VAR must at the last');
            }
            if (api_path.substring(0,i).search('@') >= 0) {
                throw new Error('path route illegal : too many @');
            }
        }

        this.ApiTable[api_path] = {
            method      : method,
            callback    : callback
        };
    };
    
    this.findPath = function(path) {
        var path_split = path.split('/');
        path_split = path_split.filter(p => p.length > 0);

        var ap = [];
        var ind = 0;
        var next = 0;
        var args = {};
        for (var k in the.ApiTable) {
            if (k.search(':') < 0 && k.search('@') < 0) {
                continue;
            }
            ap = k.split('/').filter(p => p.length > 0);
            if (ap.length !== path_split.length) {
                if (k.search('@') < 0) {
                    continue;
                }

                if (ap.length-1 !== path_split.length) {
                    continue;
                }

            }
            next = false;
            args = {};
            for(ind=0; ind < ap.length; ind++) {
                if (ind >= path_split.length) {
                    break;
                }
                if (ap[ind].search(':') >= 0 || ap[ind].search('@') >= 0) {
                    args[ap[ind].substring(1)] = path_split[ind];
                } else if (ap[ind] !== path_split[ind]) {
                    next = true;
                    break;
                }
            }

            if (next) {
                continue;
            }
            return {
                key : k,
                args : args
            };
        }

        return null;
    };
    
    this.execRequest = function (path, req, res) {
        var pk = null;
        var route_key = null;
        req.REALPATH = path;
        /*  */
        if (the.ApiTable[path] === undefined) {
            if (the.config.ignore_last_slash
                && path[path.length-1] !== '/'
                && the.ApiTable[`${path}/`] !== undefined
            ) {
                route_key = `${path}/`;
            } else {
                pk = the.findPath(path);
                if (pk !== null) {
                    req.RequestARGS = pk.args;
                    route_key = pk.key;
                } else {
                    res.statusCode = 404;
                    res.end("request not found");
                    return ;
                }
            }
        } else {
            route_key = path;
        }

        if (route_key !== null) {
            var R = the.ApiTable[route_key];
            req.RequestCall = the.ApiTable[route_key].callback;

            if (R.method !== 'ANY' && req.method != R.method) {
                res.end(`Error: method not be allowed : ${req.method}`);
                return ;
            }
    
            if (req.method === 'POST' && req.IsUpload === true) {
                //console.log(req.upload_data);
                //the.parseUploadData(req, res);
            }

        }
        
        return the.runMiddleware({
            req : req,
            res : res
        });
    };
    

    this.mid_chain = [
        async function(rr) {
            return rr;
        },

        async function(rr, next) {
            if (typeof rr.req.RequestCall === 'function'
                && rr.req.RequestCall.constructor.name === 'AsyncFunction'
            ) {
                await rr.req.RequestCall(rr);
            }
            return rr;
        }
    ];
    
    /*
        添加中间件，第二个参数允许设置针对哪些路由起作用
    */
    this.add = function(midcall, preg = null) {
        
        var jump = async function(rr, next) {
            await next(rr);
            return rr;
        };

        var last = this.mid_chain.length - 1;
        var realMidCall = async function(rr) {

            if (preg) {
                if (
                    (typeof preg === 'string' && preg !== rr.req.REALPATH)
                    ||
                    (preg instanceof RegExp && !preg.test(rr.req.REALPATH))
                    ||
                    (preg instanceof Array && preg.indexOf(rr.req.REALPATH) < 0)
                ) {
                    await jump(rr, the.mid_chain[last]);
                    return rr;
                }
            }
            await midcall(rr, the.mid_chain[last]);
            return rr;
        };

        this.mid_chain.push(realMidCall);
    };
    
    this.runMiddleware = function (rr) {
        var finalResponse = async function(rr, next) {
            await next(rr);
            rr.res.send(rr.res.Body);
        };
        the.add(finalResponse);
        var last = the.mid_chain.length - 1;
        return the.mid_chain[last](rr, the.mid_chain[last-1]);
    };
    
    /*
        multipart/form-data
        multipart/byteranges
    */
    this.checkUploadHeader = function(headerstr) {
        var preg = /multipart.* boundary.*=/i;
        if (preg.test(headerstr)) {
            return true;
        }
        return false;
    };

    this.reqHandler = function (req, res) {
        res.send = function(data) {
            if (typeof data === 'object') {
                res.end(JSON.stringify(data));
            } else if (data instanceof Array) {
                res.end(JSON.stringify(data));
            } else if (typeof data === 'string'){
                res.end(data);
            } else {
                res.end('');
            }
        };
        res.Body = '';

        var get_params = url.parse(req.url,true);
        
        req.BodyParam = {};
        req.UploadFiles = {};

        req.QueryParam = get_params.query;
        req.PATHINFO = get_params.pathname;

        req.GetQueryParam = function(key, defval = null) {
            if (req.QueryParam && req.QueryParam[key]) {
                return req.QueryParam[key];
            }
            return null;
        };

        req.GetBodyParam = function(key, defval) {
            if (req.BodyParam && req.BodyParam[key]) {
                return req.BodyParam[key];
            }
            return null;
        };

        req.GetRawBody = function() {
            return req.BodyRawData;
        };

        req.GetBody = function () {
            return req.BodyParam;
        };

        req.BodyRawData = '';

        if (get_params.pathname == '') {
            get_params.pathname = '/';
        }

        req.IsUpload = false;

        if (req.method=='GET'){
            return the.execRequest(get_params.pathname, req, res);
        } else if (req.method=='POST') {
            
            req.IsUpload = the.checkUploadHeader(req.headers['content-type']);
            
            req.on('data',(data)=>{
                req.BodyRawData += data.toString('binary');
                if (req.BodyRawData.length > the.config.post_max_size) {
                    req.BodyRawData = '';
                    res.statusCode = 413;
                    res.end(`
                            Request data too large, 
                            out of limit(${the.config.post_max_size/1000}Kb)
                        `);
                    req.destroy();
                    return ;
                }
            });
        
            req.on('end',()=>{
                if (! req.IsUpload) {

                    if (req.headers['content-type'].indexOf('application/x-www-form-urlencoded') >= 0) {
                        req.BodyParam = qs.parse(req.BodyRawData);
                    } else {
                        req.BodyParam = (new Buffer(req.BodyRawData)).toString('utf8');
                    }
                } else {
                    //req.IsUpload = true;
                    //req.BodyRawData;
                }

                return the.execRequest(get_params.pathname, req, res);
            });
            /*
                这段代码考虑到需要处理error事件，但并没有进行严格的测试。
            */
            req.on('error', (err) => {
                req.BodyRawData = '';
                req.resume();
                //console.log(err);
                return ;
            });
        } else {
            res.statusCode = 405;
            res.setHeader('Allow', ['GET','POST']);
            res.end('Method not allowed');
        }

    };


    this.run = function(host = 'localhost', port = 2020) {
        
        var opts = {};
        var serv = null;
        if (the.config.https_on) {
            try {
                opts = {
                    key  : fs.readFileSync(the.config.https_options.key),
                    cert : fs.readFileSync(the.config.https_options.cert)
                };
                serv = https.createServer(opts, the.reqHandler);
            } catch(err) {
                console.log(err);
                process.exit(-1);
            }
        } else {
            serv = http.createServer(the.reqHandler);
        }

        serv.on('clientError', (err, sock) => {
            sock.end("Bad Request");
        });

        serv.listen(port, host);
    };

    this.ants = function(host='127.0.0.1', port=2020, num = 0) {
        if (process.argv.indexOf('--daemon') > 0) {

        } else if (this.config.daemon) {
            var opt_stdio = ['ignore'];
            if (this.config.log_type == 'file') {
                try {
                    var out_log = fs.openSync(this.config.log_file, 'a+');
                    var err_log = fs.openSync(this.config.error_log_file, 'a+');
                } catch (err) {
                    console.log(err);
                    return false;
                }
                opt_stdio = ['ignore', out_log, err_log];
            } else if (this.config.log_type == 'stdio') {
                opt_stdio = ['ignore', 1, 2];
            }

            var args = process.argv.slice(1);
            args.push('--daemon');
    
            const serv = spawn (
                    process.argv[0],
                    args,
                    {
                        detached : true,
                        stdio : opt_stdio
                    }
                );
            serv.unref();
            return true;
        }
        
        if (cluster.isMaster) {
            if (num <= 0) {
                num = os.cpus().length;
            }
            for(var i=0; i<num; i++) {
                cluster.fork();
            }
        } else if (cluster.isWorker){
            this.run(host, port);
        }
    };
};

module.exports = awy;

