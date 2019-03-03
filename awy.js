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
        //此配置表示POST/PUT提交表单的最大字节数，也是上传文件的最大限制，
        post_max_size   : 8000000,

        //开启守护进程，守护进程用于上线部署，要使用ants接口，run接口不支持
        daemon          : false,

        /*
            开启守护进程模式后，如果设置路径不为空字符串，
            则会把pid写入到此文件，可用于服务管理。
        */
        pid_file        : '',

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

        //自动解析上传的文件数据
        parse_upload    : false,

        //开启HTTPS
        https_on        : false,

        //HTTPS密钥和证书的路径
        https_options   : {
            key     : '',
            cert    : ''
        },
    };

    this.flag = {
        last_middleware : false
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
        this.map(['GET','POST','PUT','DELETE'], api_path, callback);
    };

    this.map = function(marr, api_path, callback) {
        for(var i=0; i<marr.length; i++) {
            this.addPath(api_path, marr[i], callback);
        }
    };

    this.addPath = function(api_path, method, callback) {

        if (this.ApiTable[api_path] === undefined) {
            this.ApiTable[api_path] = {};
        }

        switch (method) {
            case 'GET':
            case 'POST':
            case 'PUT':
            case 'DELETE':
                this.ApiTable[api_path][method] = callback;
                return ;
            default:;
        }
    };
    
    this.findPath = function(path) {
        var path_split = path.split('/');
        path_split = path_split.filter(p => p.length > 0);

        var ap = [];
        var ind = 0;
        var next = 0;
        var args = {};
        for (var k in the.ApiTable) {
            if (k.search(':') < 0) {
                continue;
            }
            ap = k.split('/').filter(p => p.length > 0);
            if (ap.length !== path_split.length) {
                continue;
            }
            next = false;
            args = {};
            for(ind=0; ind < ap.length; ind++) {
                if (ind >= path_split.length) {
                    break;
                }
                if (ap[ind].search(':') >= 0) {
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
        req.ORGPATH = path;
        /*
            路由处理会自动处理末尾的/，
            /content/123和/content/123/是同一个请求
        */
        if (the.ApiTable[path] === undefined) {
            if (path[path.length-1] === '/') {
                var lpath = path.substring(0, path.length-1);
                if (the.ApiTable[lpath] !== undefined) {
                    route_key = lpath;
                }
            } else if(the.ApiTable[`${path}/`] !== undefined) {
                route_key = `${path}/`;
            }

        } else {
            route_key = path;
        }
        
        /*
            如果发现了路径，但是路径和带参数的路径一致。
            这需要作为参数处理，此时重置为null。
        */
        if (route_key && route_key.indexOf(':') >= 0) {
            route_key = null;
        }
        
        if (route_key === null) {
            pk = the.findPath(path);
            if (pk !== null) {
                req.RequestARGS = pk.args;
                route_key = pk.key;
            }
        }

        if (route_key === null) {
            res.statusCode = 404;
            res.end("request not found");
            return ;
        }
        
        req.PATHINFO = route_key;

        var R = the.ApiTable[route_key];
        req.RequestCall = R[req.method];

        if (R[req.method] === undefined
           || typeof R[req.method] !== 'function'
        ) {
            res.end(`Error: method not be allowed : ${req.method}`);
            return ;
        }

        if (
            (req.method === 'POST' || req.method === 'PUT' )
            && req.IsUpload === true
            && the.config.parse_upload === true
        ) {
            the.parseUploadData(req, res);
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
                    (typeof preg === 'string' && preg !== rr.req.PATHINFO)
                    ||
                    (preg instanceof RegExp && !preg.test(rr.req.PATHINFO))
                    ||
                    (preg instanceof Array && preg.indexOf(rr.req.PATHINFO) < 0)
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
    
    /* parse upload file, not in ranges */
    this.parseUploadData = function(req, res) {
        var bdy = req.headers['content-type'].split('=')[1];
        bdy = bdy.trim();
        bdy = `--${bdy}`;
        end_bdy = bdy + '--';

        //file end flag
        var end_index = req.BodyRawData.search(end_bdy);
        var bdy_crlf = `${bdy}\r\n`;

        var file_end = 0;
        var data_buf = '';

        while(1) {
            file_end = req.BodyRawData.substring(bdy_crlf.length).search(bdy);
            if ((file_end + bdy_crlf.length) >= end_index) {
                data_buf = req.BodyRawData.substring(bdy_crlf.length, end_index);
                this.parseSingleFile(data_buf, req);
                data_buf = '';
                break;
            }

            data_buf = req.BodyRawData.substring(bdy_crlf.length, file_end+bdy_crlf.length);
            this.parseSingleFile(data_buf, req);
            data_buf = '';

            req.BodyRawData = req.BodyRawData.substring(file_end+bdy_crlf.length);
            end_index = req.BodyRawData.search(end_bdy);
            if (end_index < 0) {
                break;
            }
        }
        
    };

    this.parseSingleFile = function(data, req) {
        var file_start = 0;
        var last_index = 0;
        last_index = data.search("\r\n\r\n");

        var header_data = data.substring(0, last_index);
        header_data = Buffer.from(header_data, 'binary').toString('utf8');
        
        file_start = last_index + 4;

        var file_data = data.substring(file_start, data.length-2);
        data = '';
        //parse header
        if (header_data.search("Content-Type") < 0) {
            //post form data, not file data
            var form_list = header_data.split(";");
            var tmp;
            for(var i=0; i<form_list.length; i++) {
                tmp = form_list[i].trim();
                if (tmp.search("name=") > -1) {
                    var name = tmp.split("=")[1].trim();
                    name = name.substring(1, name.length-1);
                    req.BodyParam[name] = file_data;
                    break;
                }
            }
        } else {
            //file data
            var form_list = header_data.split("\r\n").filter(s => s.length > 0);
            var tmp_name = form_list[0].split(";");
            var file_post = {
                filename        : '',
                'content-type'  : '',
                data            : '',
            };

            var name = '';
            for (var i=0; i<tmp_name.length; i++) {
                if (tmp_name[i].search("filename=") > -1) {
                    file_post.filename = tmp_name[i].split("=")[1].trim();
                    file_post.filename = file_post.filename.substring(1, file_post.filename.length-1);
                } else if (tmp_name[i].search("name=") > -1) {
                    name = tmp_name[i].split("=")[1].trim();
                    name = name.substring(1, name.length-1);
                }
            }

            if (name == '') {
                file_data = '';
                return ;
            }

            file_post['content-type'] = form_list[1].split(":")[1].trim();
            file_post.data = file_data;
            if (req.UploadFiles[name] === undefined) {
                req.UploadFiles[name] = [file_post];
            } else {
                req.UploadFiles[name].push(file_post);
            }
        }

    };

    this.reqHandler = function (req, res) {

        req.ParseExtName = function(filename) {
            if (filename.search(".") < 0) {
                return '';
            }
            name_slice = filename.split('.');
            if (name_slice.length <= 0) {
                return '';
            }
            return name_slice[name_slice.length-1];
        };

        req.GenFileName = function(filename, pre_str='') {
            var org_name = `${pre_str}${Date.now()}`;
            var hash = crypto.createHash('sha1');
            hash.update(org_name);
            return hash.digest('hex') + '.' + req.ParseExtName(filename);
        };

        req.GetFile = function(name, ind = 0) {
            if (req.UploadFiles[name] === undefined) {
                return null;
            }
            if (ind < 0 || ind >= req.UploadFiles[name].length) {
                return null;
            }
            return req.UploadFiles[name][ind];
        };

        /*
            options:
                path   
                filename

        */
        req.MoveFile = function (upf, options) {
            if (!options.filename) {
                options.filename = req.GenFileName(upf.filename);
            }

            var target = options.path + '/' + options.filename;
            
            return new Promise((rv, rj) => {
                fs.writeFile(target, upf.data, {encoding : 'binary'}, err => {
                    if (err) {
                        rj(err);
                    } else {
                        rv({
                            filename : options.filename,
                            target : target
                        });
                    }
                });
            });
        };

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
        } else if (req.method == 'POST' || req.method == 'PUT' || req.method == 'DELETE') {
            
            req.IsUpload = the.checkUploadHeader(req.headers['content-type']);
            
            req.on('data',(data) => {
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
                        req.BodyParam = (new Buffer(req.BodyRawData, 'binary')).toString('utf8');
                    }
                }

                return the.execRequest(get_params.pathname, req, res);
            });
            
            req.on('error', (err) => {
                req.BodyRawData = '';
                req.resume();
                //console.log(err);
                return ;
            });

        } else {
            res.statusCode = 405;
            res.setHeader('Allow', ['GET','POST', 'PUT', 'DELETE']);
            res.end('Method not allowed');
        }

    };

    this.addFinalResponse = function() {
        var fr = async function(rr, next) {
            await next(rr);
            rr.res.send(rr.res.Body);
        };
        the.add(fr);
    };

    this.run = function(host = 'localhost', port = 2020) {
        if (this.flag.last_middleware === false) {
            this.addFinalResponse();
        }

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
        /*
            添加最后的中间件处理响应，并设置标记为true
            此时，再次调用run不会继续添加此中间件。
        */
        the.addFinalResponse();
        the.flag.last_middleware = true;
        
        if (cluster.isMaster) {
            if (num <= 0) {
                num = os.cpus().length;
            }

            if (typeof the.config.pid_file === 'string'
                && the.config.pid_file.length > 0
            ) {
                fs.writeFile(the.config.pid_file, process.pid, (err) => {
                    if (err) {
                        console.log(err);
                    }
                });
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

