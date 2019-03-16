const fs = require('fs');
const qs = require('querystring');
const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');
const cluster = require('cluster');
const os = require('os');
const {spawn} = require('child_process');

module.exports = function () {
    
    var the = this;

    this.config = {
        //此配置表示POST/PUT提交表单的最大字节数，也是上传文件的最大限制，
        body_max_size   : 8000000,

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
        */
        log_type        : 'ignore',

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


    /*
        由于在路由匹配时会使用/分割路径，所以在添加路由时先处理好。
        允许:表示变量，*表示任何路由，但是二者不能共存，因为无法知道后面的是变量还是路由。
        比如：/static/*可以作为静态文件所在目录，但是后面的就直接作为*表示的路径，
        并不进行参数解析。
    */
    this.addPath = function(api_path, method, callback) {

        if (this.ApiTable[api_path] === undefined) {
            this.ApiTable[api_path] = {
                isArgs:  false,
                isStar:  false,
                routeArr: [],
                ReqCall: {},
            };
            if (api_path.indexOf(':') >= 0) {
                this.ApiTable[api_path].isArgs = true;
            }
            if (api_path.indexOf('*') >= 0) {
                this.ApiTable[api_path].isStar = true;
            }

            if(this.ApiTable[api_path].isStar && this.ApiTable[api_path].isArgs) {
                var errinfo = `: * can not in two places at once ->  ${api_path}`;
                throw errinfo;
            }

            this.ApiTable[api_path].routeArr = api_path.split('/').filter(p => p.length > 0);
        }

        switch (method) {
            case 'GET':
            case 'POST':
            case 'PUT':
            case 'DELETE':
                this.ApiTable[api_path].ReqCall[method] = callback;
                return ;
            default:;
        }
    };

    /*
        如果路径超过2000字节长度，并且分割数组太多，length超过8则不处理。
    */
    this.findPath = function(path) {
        if (path.length > 2000) {
            return null;
        }
        var path_split = path.split('/');
        path_split = path_split.filter(p => p.length > 0);
        if (path_split.length > 8) {
            return null;
        }

        var next = 0;
        var args = {};
        var rt = null;
        for (var k in the.ApiTable) {
            rt = the.ApiTable[k];
            if (rt.isArgs === false && rt.isStar === false) {
                continue;
            }

            if (
              (rt.routeArr.length !== path_split.length && rt.isStar === false)
              ||
              (rt.routeArr.length > path_split.length)
            ) {
                continue;
            }

            next = false;
            args = {};
            
            if (rt.isStar) {
                for(var i=0; i<rt.routeArr.length; i++) {
                    if (rt.routeArr[i] == '*') {
                        args.starPath = path_split.slice(i+1).join('/');
                    } else if(rt.routeArr[i] !== path_split[i]) {
                        next = true;
                        break;
                    }
                }
            } else {
                for(var i=0; i<rt.routeArr.length; i++) {
                    if (rt.routeArr[i][0] == ':') {
                        args[rt.routeArr[i].substring(1)] = path_split[i];
                    } else if (rt.routeArr[i] !== path_split[i]) {
                        next = true;
                        break;
                    }
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
            res.end('');
            return ;
        }
        
        req.ROUTEPATH = route_key;

        var R = the.ApiTable[route_key].ReqCall;
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
        /*
            直接跳转下层中间件，根据匹配规则如果不匹配则执行此函数。
        */
        var jump = async function(rr, next) {
            await next(rr);
            return rr;
        };

        var last = this.mid_chain.length - 1;
        var realMidCall = async function(rr) {

            if (preg) {
                if (
                    (typeof preg === 'string' && preg !== rr.req.ROUTEPATH)
                    ||
                    (preg instanceof RegExp && !preg.test(rr.req.ROUTEPATH))
                    ||
                    (preg instanceof Array && preg.indexOf(rr.req.ROUTEPATH) < 0)
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
        multipart/byteranges不支持
    */
    this.checkUploadHeader = function(headerstr) {
        var preg = /multipart.* boundary.*=/i;
        if (preg.test(headerstr)) {
            return true;
        }
        return false;
    };
    
    /*
        解析上传文件数据的函数，此函数解析的是整体的文件，
        解析过程参照HTTP/1.1协议。
    */
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

    //解析单个文件数据
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
                    req.BodyParam[name] = BUffer.from(file_data, 'binary').toString('utf8');
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

    this.parseExtName = function (filename) {
        if (filename.search(".") < 0) {
            return '';
        }
        name_slice = filename.split('.');
        if (name_slice.length <= 0) {
            return '';
        }
        return name_slice[name_slice.length-1];
    };

    this.genFileName = function(filename, pre_str='') {
        var org_name = `${pre_str}${Date.now()}`;
        var hash = crypto.createHash('sha1');
        hash.update(org_name);
        return hash.digest('hex') + '.' + the.parseExtName(filename);
    };

    this.sendReqLog = function(req, req_type = 'ok') {
        var real_ip = req.socket.remoteAddress;
        if (req.headers['x-real-ip']) {
            real_ip = req.headers['x-real-ip'];
        }
        var msg_log = null;
        if (req_type == 'error') {
            msg_log = {
                type : 'error',
                time : (new Date()).toString(),
                method : req.method,
                url : req.url,
                remote_addr : real_ip,
                errmsg : err.message
            };
        } else {
            msg_log = {
                type : 'access',
                time : (new Date()).toString(),
                method : req.method,
                url : req.url,
                remote_addr : real_ip
                
            };
        }
        process.send(msg_log);
    }

    this.reqHandler = function (req, res) {

        /*
            这两个函数因为和请求数据无关，被移出到上一层。
            并且使用添加两个属性指向它们，这样不影响代码的调用方式。
        */
        req.ParseExtName = the.parseExtName;
        req.GenFileName = the.genFileName;

        req.IsUpload = false;
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
            req.IsUpload = the.checkUploadHeader(req.headers['content-type']);
        }

        if (req.IsUpload && the.config.parse_upload) {

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

        }
        
        res.Body = '';

        var get_params = url.parse(req.url,true);
        if (get_params.pathname == '') {
            get_params.pathname = '/';
        }
        
        req.QueryParam = get_params.query;
        req.ORGPATH = get_params.pathname;
        req.ROUTEPATH = '';
        req.BodyParam = {};
        req.UploadFiles = {};
        req.BodyRawData = '';

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

        if (req.method=='GET'){
            if (cluster.isWorker && the.config.log_type !== 'ignore') {
                the.sendReqLog(req);
            }
            return the.execRequest(get_params.pathname, req, res);
        } else if (req.method == 'POST' || req.method == 'PUT' || req.method == 'DELETE') {
            
            req.on('data',(data) => {
                req.BodyRawData += data.toString('binary');
                if (req.BodyRawData.length > the.config.body_max_size) {
                    req.BodyRawData = '';
                    res.statusCode = 413;
                    res.end(
                        'Request data too large, out of limit:'
                        +'(' + (the.config.body_max_size/1000) + 'Kb)'
                    );
                    req.aborted = true;
                    req.destroy(new Error('body data too large'));
                }
            });
        
            req.on('end',() => {
                if (req.aborted) {
                    if (!res.finished) {
                        res.end('');
                    }
                    return ;
                }
                if (cluster.isWorker && the.config.log_type !== 'ignore') {
                    the.sendReqLog(req);
                }
                if (! req.IsUpload) {

                    if (req.headers['content-type'].indexOf('application/x-www-form-urlencoded') >= 0) {
                        req.BodyParam = qs.parse(
                                Buffer.from(req.BodyRawData, 'binary').toString('utf8')
                            );
                    } else {
                        req.BodyParam = Buffer
                                        .from(req.BodyRawData, 'binary')
                                        .toString('utf8');
                    }
                }

                return the.execRequest(get_params.pathname, req, res);
            });
            
            req.on('error', (err) => {
                req.BodyRawData = '';
                if (cluster.isWorker && the.config.log_type !== 'ignore') {
                    the.sendReqLog(req, 'error');
                }
                return ;
            });

        } else {
            res.statusCode = 405;
            res.setHeader('Allow', ['GET','POST', 'PUT', 'DELETE']);
            res.end('Method not allowed');
        }

    };

    /*
        这是最终添加的请求中间件。基于洋葱模型，
        这个中间件最先执行，所以最后会返回响应结果，
        一开始挂在res上的send函数被剔除，在此处直接
        检测res.Body类型返回数据。
        如果response的Header没有设置Content-Type则设置默认值。
    */
    this.addFinalResponse = function() {
        var fr = async function(rr, next) {
            if (!rr.res.getHeader('Content-Type')) {
                rr.res.setHeader('Content-Type', 'text/plain,text/html;charset=utf8');
            }
            await next(rr);
            
            if (rr.res.Body === null || rr.res.Body === false) {
                rr.res.end();
            } else if (typeof rr.res.Body === 'object') {
                rr.res.end(JSON.stringify(rr.res.Body));
            } else if (rr.res.Body instanceof Array) {
                rr.res.end(JSON.stringify(rr.res.Body));
            } else if (typeof rr.res.Body === 'string') {
                rr.res.end(rr.res.Body);
            } else {
                rr.res.end('');
            }
        };
        the.add(fr);
    };

    this.run = function(host = 'localhost', port = 2020) {
        //添加最终的中间件
        this.addFinalResponse();

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

    /*
        这个函数是可以用于运维部署，此函数默认会根据CPU核数创建对应的子进程处理请求。
        子进程会调用run函数。
    */
    this.ants = function(host='127.0.0.1', port=2020, num = 0) {
        if (process.argv.indexOf('--daemon') > 0) {

        } else if (the.config.daemon) {
            var args = process.argv.slice(1);
            args.push('--daemon');
            const serv = spawn (
                    process.argv[0],
                    args,
                    {
                        detached : true,
                        stdio : ['ignore', 1, 2]
                    }
                );
            serv.unref();
            return true;
        }
        
        if (cluster.isMaster) {
            if (num <= 0) {
                num = os.cpus().length;
            }

            if (typeof the.config.pid_file === 'string'
                && the.config.pid_file.length > 0
            ) {
                fs.writeFile(the.config.pid_file, process.pid, (err) => {
                    if (err) {
                        console.error(err);
                    }
                });
            }

            for(var i=0; i<num; i++) {
                cluster.fork();
            }

            if (cluster.isMaster) {
                /*
                    如果日志类型为file，并且设置了日志文件，
                    则把输出流重定向到文件。
                    但是在子进程处理请求仍然可以输出到终端。
                */
                if (the.config.log_type == 'file') {
                    if(typeof the.config.log_file === 'string'
                        && the.config.log_file.length > 0
                    ) {
                        var out_log = fs.createWriteStream(
                            the.config.log_file, 
                            {flags : 'a+' }
                          );
                        process.stdout.write = out_log.write.bind(out_log);
                    }
                    if(typeof the.config.error_log_file === 'string'
                        && the.config.error_log_file.length > 0
                    ) {
                        var err_log = fs.createWriteStream(
                            the.config.error_log_file, 
                            {flags : 'a+' }
                          );
                        process.stderr.write = err_log.write.bind(err_log);
                    }
                }

                /*
                    检测子进程数量，如果有子进程退出则fork出差值的子进程，
                    维持在一个恒定的值。
                */
                setInterval(() => {
                    var num_dis = num - Object.keys(cluster.workers).length;
                    for(var i=0; i<num_dis; i++) {
                        cluster.fork();
                    }
                }, 5000);

                cluster.on('message', (worker, message, handle) => {
                    if(message.type === 'access') {
                        console.log(message);
                    } else {
                        console.error(message);
                    }
                });
            }
        } else if (cluster.isWorker) {
            this.run(host, port);
        }
    };
};
