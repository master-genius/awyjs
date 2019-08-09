const http = require('http');
const https = require('https');
const http2 = require('http2');
const crypto = require('crypto');
const fs = require('fs');
const urlparse = require('url');
const qs = require('querystring');

//针对HTTPS协议，不验证证书
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

module.exports = new function() {

    var the = this;
    
    this.mime_map = {
        'css'   : 'text/css',
        'der'   : 'application/x-x509-ca-cert',
        'gif'   : 'image/gif',
        'gz'    : 'application/x-gzip',
        'h'     : 'text/plain',
        'htm'   : 'text/html',
        'html'  : 'text/html',
        'jpg'   : 'image/jpeg',
        'jpeg'  : 'image/jpeg',
        'png'   : 'image/png',
        'js'    : 'application/x-javascript',
        'mp3'   : 'audio/mpeg',
        'mp4'   : 'video/mp4',
        'c'     : 'text/plain',
        'exe'   : 'application/octet-stream',
        'txt'   : 'text/plain',
        'wav'   : 'audio/x-wav',
        'svg'   : 'image/svg+xml',
        'tar'   : 'application/x-tar',
    };

    this.default_mime   = 'application/octet-stream';

    this.extName = function(filename) {
        var name_split = filename.split('.').filter(p => p.length > 0);
        if (name_split.length < 2) {
            return '';
        }

        return name_split[name_split.length - 1];
    };

    this.mimeType = function(filename) {
        var extname = this.extName(filename);
        extname = extname.toLowerCase();
        if (extname !== '' && this.mime_map[extname] !== undefined) {
            return this.mime_map[extname];
        }
        return this.default_mime;
    };
/* 
    this.parseUrl = function(url) {
        var u = new urlparse.URL(url);

        var opts = {
            protocol    : u.protocol,
            host        : u.host,
            hostname    : u.hostname,
            port        : u.port,
            path        : u.pathname,
            method      : '',
            search      : u.search,
            headers     : {
            
            },
            href : u.href,
            searchParams : u.searchParams,
            origin : u.origin
        };
        if (u.search.length > 0) {
            opts.path += u.search;
        }

        if (u.protocol === 'https:') {
            opts.requestCert = false;
            opts.rejectUnauthorized = false;
        }

        return opts;
    };
 */
    this.methodList = ['GET','POST','PUT','DELETE','OPTIONS'];

    /*
        options
            encoding
            req
            conn

    */

    this.connect = function (url, options) {
        var h = http2.connect(url, options);
        /*
            opts
                encoding
                data
                timeout
                <clienthttp2session.request's options>
        */
        h.req = async function (headers, opts) {

        };

        return h;
    };

    this.request = async function (url, options = {encoding:'utf8'}) {
        if (!options.req) {
            options.req = {};
        }
        var pr = this.preRequest(url, options);
        var session = null;
        if (options.conn) {
            session = http2.connect(pr, options.conn);
        } else {
            session = http2.connect(pr);
        }



    };

    /*
        options
            headers
            method
            data
            encoding
            <http2.request's options>
        
    */

    this.parseUrl = function (url, options = {}) {
        var urlobj = new urlparse.URL(url);
        var headers = {
            ':method' : 'GET',
            ':path': urlobj.path+urlobj.search,
        };

        if (options.method && this.methodList.indexOf(options.method) >= 0) {
            headers[':method'] = options.method;
        }
        if (options.headers) {
            for (var k in options.headers) {
                headers[k] = options.headers[k];
            }
        }

        return headers;
    };


    /*
        options = {
            encoding,
            onData
        }
    */
    this.get = function(url, options, encoding='utf8') {

        var opts = this.parseUrl(url);
        opts.method = 'GET';

        for(var k in options) {
            opts[k] = options[k];
        }

        var h = (opts.protocol === 'https:') ? https : http;
        return new Promise((rv, rj) => {
            h.get(url, opts, (res) => {

                let error = null;
                if (res.statusCode !== 200) {
                    error = new Error(
                            `request failed, status code:${res.statusCode}`);
                }

                if (error) {
                    res.resume();
                    rj(error);
                }

                res.setEncoding(encoding);
                var get_data = '';

                res.on('data', (data) => {
                    if (options.onData !== undefined && typeof options.onData === 'function') {
                        options.onData(data);
                    }

                    get_data += data.toString(encoding);
                });

                res.on('end', () => {
                    rv(get_data);
                });

                res.on('error', (err) => {
                    get_data = '';
                    rj(err);
                });

            }).on('error', (err) => {
                rj(err);
            });
        });

    };

    /*
        options = {
            data,
            headers,
            encoding,
            onData
        }
    */

    this.post = function(url, options = {}) {
        options.method = 'POST';
        return the.request(url, options);
    };

    this.put = function(url, options = {}) {
        options.method = 'PUT';
        return the.request(url, options);
    };

    this.delete = function(url, options = {}) {
        options.method = 'DELETE';
        return the.request(url, options);
    };

    this.request = function(url, options) {
        if (options.encoding === undefined) {
            options.encoding = 'utf8';
        }

        var opts = this.parseUrl(url);
        var h = (opts.protocol === 'https:') ? https : http;
        opts.method = options.method;
        opts.headers = {
            'content-type'  : 'application/x-www-form-urlencoded',
        };

        if (options.headers !== undefined) {
            for(var k in options.headers) {
                opts.headers[k] = options.headers[k];
            }
        }
        var post_data = '';
        if (options.data) {
            if (opts.headers['content-type'] === 'application/x-www-form-urlencoded') {
                post_data = qs.stringify(options.data);
            } else {
                if (typeof options.data === 'object') {
                    post_data = JSON.stringify(options.data);
                } else {
                    post_data = options.data;
                }
            }
            opts.headers['content-length'] = Buffer.byteLength(post_data);
        }

        for(var k in options) {
            if (k!='data' && k!='headers') {
                opts[k] = options[k];
            }
        }
        
        return new Promise ((rv, rj) => {
            var r = h.request(opts, (res) => {
                var res_data = '';

                res.setEncoding(options.encoding);
                res.on('data', (data) => {
                    if (options.onData !== undefined && typeof options.onData === 'function') {
                        options.onData(data);
                    }
                    
                    res_data += data.toString(options.encoding);
                });

                res.on('end', () => {
                    rv(res_data);
                });

                res.on('error', (err) => {
                    rj(err);
                });
            });

            r.on('error', (e) => {
                rj(e);
            });

            if (post_data) {
                r.write(post_data);
            }
            r.end();
        });
    };

    /*
        fields = {
            file            : FILE PATH,
            upload_name     : FILE INDEX NAME,
            form            : FORM DATA,
        }
    */
    this.upload = function(url, fields) {
        var opts = this.parseUrl(url);
        var h = (opts.protocol === 'https:') ? https : http ;

        opts.method = 'POST';
        opts.headers = {
            'content-type'  : 'multipart/form-data; '
        };
       
        return new Promise((rv, rj) => {
            if (fields.file === undefined) {
                rj(new Error('file not found'));
            } else {
                try {
                    fs.accessSync(fields.file, fs.constants.F_OK|fs.constants.R_OK);
                    
                    var name_split = fields.file.split('/').filter(p => p.length > 0);
                    var filename   = name_split[name_split.length - 1];
                    var mime_type  = this.mimeType(filename);

                    fs.readFile(fields.file, (err, data) => {
                        if (err) {
                            rj(err);
                        } else {
                            var retdata = {
                                data        : data.toString('binary'),
                                options     : opts,
                                filename    : filename,
                                pathname    : fields.file,
                                name        : fields.upload_name,
                                httpr       : h,
                                mime_type   : mime_type
                            };
                            if (fields.form !== undefined) {
                                retdata.formdata = fields.form;
                            }

                            rv(retdata);
                        }
                    });
                } catch (err) {
                    rj(err);
                }
            }

        }).then((r) => {
            var bdy = this.boundary();

            var formData = '';
            if (r.formdata !== undefined) {
                if (typeof r.formdata === 'object') {
                    for (var k in r.formdata) {
                        formData += `\r\n--${bdy}\r\nContent-Disposition: form-data; name=${'"'}${k}${'"'}\r\n\r\n${r.formdata[k]}`;
                    }
                }
            }

            var header_data = `Content-Disposition: form-data; name=${'"'}${r.name}${'"'}; filename=${'"'}${r.filename}${'"'}\r\nContent-Type: ${r.mime_type}`;
            var payload = `\r\n--${bdy}\r\n${header_data}\r\n\r\n`;
            var end_data = `\r\n--${bdy}--\r\n`;
            r.options.headers['content-type'] += `boundary=${bdy}`;
            r.options.headers['content-length'] = Buffer.byteLength(payload) + Buffer.byteLength(end_data) + fs.statSync(r.pathname).size + Buffer.byteLength(formData);

            return new Promise((rv, rj) => {
                var http_request = r.httpr.request(r.options, (res) => {
                    var ret_data = '';
                    res.setEncoding('utf8');

                    res.on('data', (data) => {
                        ret_data += data;
                    });

                    res.on('end', () => {
                        rv({
                            err : null,
                            data : ret_data
                        });
                    });
                });

                http_request.on('error', (err) => {
                    rv({
                        err : err,
                        data : null
                    });
                });

                if (formData.length > 0) {
                    http_request.write(formData);
                }
                http_request.write(payload);

                var fstream = fs.createReadStream(r.pathname, {bufferSize : 4096});
                fstream.pipe(http_request, {end :false});
                fstream.on('end', () => {
                    http_request.end(end_data);
                });
            });
            
        }, (err) => {
            throw err;
        });
    };

    this.boundary = function() {
        var hash = crypto.createHash('md5');
        hash.update(`${Date.now()}-${Math.random()}`);
        var bdy = hash.digest('hex');

        return `----${bdy}`;
    };

    /*
        method : GET | POST,
        data   : Object if method == POST,
        target : FILE_PATH,
        headers : {}
    */
    this.download = function(url, options) {

        var data_stream = fs.createWriteStream(options.target, {encoding:'binary'});
        if (options.encoding === undefined) {
            options.encoding = 'binary';
        }

        var opts = this.parseUrl(url);
        var h = (opts.protocol === 'https:') ? https : http;
        opts.method = options.method;
        if (opts.method === 'POST') {
            opts.headers = {
                'content-type'  : 'application/x-www-form-urlencoded',
            };
        }

        if (options.headers !== undefined) {
            for(var k in options.headers) {
                opts.headers[k] = options.headers[k];
            }
        }

        var post_data = '';
        if (opts.method === 'POST') {
            if (opts.headers['content-type'] === 'application/x-www-form-urlencoded') {
                post_data = qs.stringify(options.data);
            } else {
                if (typeof options.data === 'object') {
                    post_data = JSON.stringify(options.data);
                } else {
                    post_data = options.data;
                }
            }
            
            opts.headers['content-length'] = Buffer.byteLength(post_data);
        }
        
        return new Promise ((rv, rj) => {
            data_stream.on('error', (err) => {
                r.destroy(err);
            });

            data_stream.on('finish', () => {
                //rv(true);
            });

            var r = h.request(opts, (res) => {

                let error = null;
                if (res.statusCode !== 200) {
                    error = new Error(
                            `request failed, status code:${res.statusCode}`);
                }

                if (error) {
                    res.resume();
                    rj(error);
                }

                res.setEncoding(options.encoding);
                res.on('data', (data) => {
                    data_stream.write(Buffer.from(data, 'binary'));
                });

                res.on('end', () => {
                    data_stream.end();
                    rv(true);
                });

                res.on('error', (err) => {
                    data_stream.end();
                    rj(err);
                });
            });

            r.on('error', (e) => {
                rj(e);
            });

            r.write(post_data);
            r.end();
        });

    };

};
