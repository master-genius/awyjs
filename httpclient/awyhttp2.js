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

    //最大同时上传文件数量限制
    this.max_upload_limit = 10;

    //上传文件最大数据量：2Gb
    this.max_upload_size = 2147483648;

    //单个文件最大上传大小：1Gb
    this.max_file_size = 1073741824;
    
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
        'go'    : 'text/plain',
        'cpp'   : 'text/plain',
        'json'  : 'text/plain',
        'php'   : 'text/plain',
        'java'  : 'text/plain',
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

    this.init = function (url, options = null) {
        var h = null;
        if (options) {
            h = http2.connect(url, options);
        } else {
            h = http2.connect(url);
        }

        h.on('error', (err) => {
            console.log(err);
            h.close();
        });
        h.on('frameError', (err) => {
            console.log(err);
        });

        var ht = {
            session : h,
        };
        /*
            opts
                encoding
                data
                timeout
                request_options : <clienthttp2session.request's options>
        */
        h.parsedHeaders = this.parseUrl(url);
        h.startReq = function (opts, callback = null) {
            var headers = {};
            for (var k in h.parsedHeaders) {
                headers[k] = h.parsedHeaders[k];
            }

            if (opts.headers && typeof opts.headers === 'object') {
                for (var k in opts.headers) {
                    headers[k] = opts.headers[k];
                }
            }

            if (opts.method && the.methodList.indexOf(opts.method) >= 0) {
                headers[':method'] = opts.method;
            }

            var method = headers[':method'];
            if (method == 'PUT' || method == 'POST') {
                if (opts.data === undefined) {
                    throw new Error('PUT/POST must with body data');
                }
            }

            var bodyData = '';
            var upload_data = {};

            if (method == 'POST' || method == 'PUT' || method == 'DELETE') {
                if (headers['content-type'] === undefined) {
                    headers['content-type'] = 'application/x-www-form-urlencoded';
                }
                if (headers['content-type'] == 'application/x-www-form-urlencoded') {
                    bodyData = Buffer.from(qs.stringify(opts.data)).toString('binary');
                    headers['content-length'] = bodyData.length;
                } else if (h.parsedHeaders['content-type'] === 'multipart/form-data') {
                    if (opts.data.files) {
                        upload_data.files = the.preLoadFiles(opts.data.files);
                    }
                    if (opts.data.form) {
                        upload_data.formdata = opts.data.form;
                    }
                    bodyData = the.makeUploadData(upload_data);
                    headers['content-type'] = bodyData['content-type'];
                    headers['content-length'] = bodyData['content-length'];
                    bodyData = bodyData['data'];
                    upload_data = {};
                } else {
                    bodyData = Buffer.from(JSON.stringify(opts.data)).toString('binary');
                    headers['content-length'] = bodyData.length;
                }
            }
            
            var reqstream;
            if (opts.request_options) {
                reqstream = h.request(headers, opts.request_options);
            } else {
                reqstream = h.request(headers);
            }

            if (opts.timeout) {
                reqstream.setTimeout(opts.timeout);
            }

            var retData = '';
            reqstream.on('error', (err) => {
                console.log(err);
                reqstream.close(http2.constants.NGHTTP2_INTERNAL_ERROR);
            });
            reqstream.on('frameError', (err) => {
                console.log(err);
                reqstream.close(http2.constants.NGHTTP2_INTERNAL_ERROR);
            });

            if (typeof callback === 'function') {
                reqstream.on('data', (data) => {
                    retData += data;
                });
                reqstream.on('end', () => {
                    callback(retData);
                });
            }

            if (opts.events) {
                for(let e in opts.events) {
                    if (typeof opts.events[e] === 'function') {
                        reqstream.on(e, opts.events[e]);
                    }
                }
            }

            reqstream.run = function() {
                return reqstream;
            };

            if (bodyData.length > 0) {
                reqstream.run = function() {
                    reqstream.write(bodyData, 'binary');
                    return reqstream;
                };
            }

            return reqstream;
        };

        ht.simpleRequest = async function(opts) {
            return new Promise((rv, rj) => {
                var t = h.startReq(opts).run();
                t.on('error', (err) => {
                    rj({data : null, error : err});
                });
                t.on('frameError', (err) => {
                    rj({data : null, error : err});
                });

                var retData = '';

                t.on('data', (data) => {
                    retData += data.toString(opts.encoding || 'utf8');
                });

                t.on('end', () => {
                    h.close();
                    rv({data:retData, error:null});
                });
            });
        };

        ht.get = async function(opts = {method : 'GET', timeout:35000}) {
            return ht.simpleRequest(opts);
        };

        ht.post = async function(opts = {}) {
            opts.method = 'POST';
            return ht.simpleRequest(opts);
        };

        ht.put = async function(opts = {}) {
            opts.method = 'PUT';
            return ht.simpleRequest();
        };

        ht.delete = async function(opts={}) {
            opts.method = 'DELETE';
            return ht.simpleRequest(opts);
        };

        ht.upload = async function(opts = {}) {
            if (opts.method === undefined) {
                opts.method = 'POST';
            }
            return ht.simpleRequest(opts);
        };

        ht.download = async function() {

        };

        return ht;
    };

    /*
        options : {
            files : [
                {
                    upload_name,
                    filename,
                    content-type,
                    data
                },
            ],

            formdata : {

            },
        }
    */
    this.makeUploadData = function(r) {
        var bdy = this.boundary();

        var formData = '';
        if (r.formdata !== undefined) {
            if (typeof r.formdata === 'object') {
                for (var k in r.formdata) {
                    formData += `\r\n--${bdy}\r\nContent-Disposition: form-data; name=${'"'}${k}${'"'}\r\n\r\n${r.formdata[k]}`;
                }
            }
        }

        var header_data = '';
        var payload = '';
        var body_data = Buffer.from(formData).toString('binary');
        var content_length = Buffer.byteLength(formData);

        if (r.files && r.files instanceof Array) {
            for (var i=0; i<r.files.length; i++) {
                header_data = `Content-Disposition: form-data; name=${'"'}${r.files[i].upload_name}${'"'}; filename=${'"'}${r.files[i].filename}${'"'}\r\nContent-Type: ${r.files[i].content_type}`;

                payload = `\r\n--${bdy}\r\n${header_data}\r\n\r\n`;

                content_length += Buffer.byteLength(payload) + r.files[i].data.length;
                body_data += Buffer.from(payload).toString('binary') + r.files[i].data;
            }
        }

        var end_data = `\r\n--${bdy}--\r\n`;
        content_length += Buffer.byteLength(end_data);
        body_data += Buffer.from(end_data).toString('binary');

        return {
            'content-type' : `multipart/form-data; boundary=${bdy}`,
            'body-data' : body_data,
            'content-length' : content_length
        };

    };

    /*
        {
            "UPLOAD_NAME" : [
                FILE_LIST
            ]
        }
    */

    this.preLoadFiles = function(files) {
        console.log(files);
        var file_count = 0;
        var total_size = 0;

        var files_data = [];
        var filename = '';
        var name_split = null;
        var content_type = '';

        for (var k in files) {
            for (var i=0; i<files[k].length; i++) {
                if (file_count >= the.max_upload_limit) {
                    throw new Error('too many files, max limit:' + the.max_upload_limit);
                }

                if (total_size >= the.max_upload_size) {
                    throw new Error('too large data, max size:' + the.max_upload_size);
                }

                try {
                    filename = files[k][i];
                    name_split = filename.split('/').filter(p => p.length > 0);
                    content_type = the.mimeType(name_split[name_split.length - 1]);
                    var data = fs.readFileSync(filename, {encoding:'binary'});
                    files_data.push({
                        'upload_name' : k,
                        'content-type' : content_type,
                        'filename' : name_split[name_split.length - 1],
                        'data' : data
                    });
                    file_count += 1;
                    total_size += data.length;
                    if (data.length > the.max_file_size) {
                        throw new Error('too large file, max file size:' + the.max_file_size);
                    }
                } catch (err) {
                    console.log(err);
                    file_count -= 1;
                }
            }
        }

        return files_data;
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
