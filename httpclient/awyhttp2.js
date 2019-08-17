/* const http = require('http');
const https = require('https'); */
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

    //上传文件最大数据量，JS限制最大字符串不能超过 1073741824
    this.max_upload_size = 1073000000;

    //单个文件最大上传大小
    this.max_file_size = 220000000;
    
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

    this.methodList = ['GET','POST','PUT','DELETE','OPTIONS'];

    this.parseUrl = function (url, options = {}) {
        var urlobj = new urlparse.URL(url);
        var headers = {
            ':method' : 'GET',
            ':path': urlobj.pathname+urlobj.search,
        };

        if (options.method && this.methodList.indexOf(options.method) >= 0) {
            headers[':method'] = options.method;
        }
        if (options.headers) {
            for (var k in options.headers) {
                headers[k] = options.headers[k];
            }
        }

        return {
            url : urlobj,
            headers:headers
        };
    };

    this.initConn = function (url, options = null) {
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

        return h;
    };

    this.init = function (url, conn_options=null) {
        var ht = {};
        var parseurl = this.parseUrl(url);
        ht.headers = parseurl.headers;
        ht.url = parseurl.url;
        ht.host = 'https://' + ht.url.host;
        ht.tmp_headers = {};
        ht.bodyData = '';

        ht.session = the.initConn(ht.host, conn_options);

        ht.close = function () {
            if (ht.session && !ht.session.closed) {
                ht.session.close();
            }
        };

        ht.payload = async function (opts) {
            var headers = {};
            for (var k in ht.headers) {
                headers[k] = ht.headers[k];
            }

            if (opts.path) {
                headers[':path'] = opts.path;
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

            if (method == 'POST' 
                || method == 'PUT' 
                || (method == 'DELETE' && opts.data)
            ) {
                ht.bodyData = '';
                if (headers['content-type'] === undefined) {
                    headers['content-type'] = 'application/x-www-form-urlencoded';
                    if (typeof opts.data === 'string') {
                        headers['content-type'] = 'text/plain';
                    }
                }

                if (headers['content-type'] == 'application/x-www-form-urlencoded') {
                    
                    ht.bodyData = Buffer.from(qs.stringify(opts.data)).toString('binary');
                    headers['content-length'] = ht.bodyData.length;

                } else if (headers['content-type'] === 'multipart/form-data') {
                    var upload_data = {};
                    if (opts.data.files) {
                        upload_data.files = the.preLoadFiles(opts.data.files);
                    }
                    if (opts.data.form) {
                        upload_data.formdata = opts.data.form;
                    }
                    ht.bodyData = the.makeUploadData(upload_data);
                    headers['content-type'] = ht.bodyData['content-type'];
                    headers['content-length'] = ht.bodyData['content-length'];
                    ht.bodyData = ht.bodyData['body-data'];
                    upload_data = {};
                } else {
                    ht.bodyData = Buffer.from(
                            typeof opts.data === 'object' 
                            ? JSON.stringify(opts.data) 
                            : opts.data
                        ).toString('binary');
                    headers['content-length'] = ht.bodyData.length;
                }
            }

            ht.tmp_headers = headers;
        };

        ht.reqStream = function(opts) {
            ht.payload(opts);
            if (opts.request_options) {
                ht.stream = ht.session.request(ht.tmp_headers, opts.request_options);
            } else {
                ht.stream = ht.session.request(ht.tmp_headers);
            }

            if (opts.timeout) {
                ht.stream.setTimeout(opts.timeout);
            }

            ht.stream.on('end', () => {
                if (opts.end) {
                    ht.session.close();
                }
                //ht.stream.close();
            });
            
            return ht.stream;
        };

        ht.request = async function(opts) {
            return new Promise((rv, rj) => {
                if (ht.session === null || ht.session.closed) {
                    ht.session = the.initConn(ht.host, conn_options);
                }
                var t = ht.reqStream(opts);
                t.on('error', (err) => {
                    t.close();
                    rj(err);
                });
                t.on('frameError', (err) => {
                    t.close();
                    rj(err);
                });
                if (opts.onResponse && typeof opts.onResponse === 'function') {
                    t.on('response', opts.onResponse);
                }

                var retData = '';

                t.on('data', (data) => {
                    if (opts.writeStream) {
                        opts.writeStream(data, opts.writeStreamEncoding || 'binary');
                    } else {
                        retData += data.toString(opts.encoding || 'utf8');
                    }
                });

                t.on('end', () => {
                    if (opts.endSession) {
                        ht.session.close();
                    }
                    rv(retData);
                });

                if (opts.events && typeof opts.events === 'object') {
                    for(let x in opts.events) {
                        if (x === 'error' || x === 'frameError') {
                            continue;
                        }
                        if (typeof opts.events[x] === 'function') {
                            t.on(x, opts.events[x]);
                        }
                    }
                }

                if (ht.bodyData.length > 0 
                    && (ht.tmp_headers[':method'] == 'POST'
                        || ht.tmp_headers[':method'] == 'DELETE'
                        || ht.tmp_headers[':method'] == 'PUT'
                    )
                ) {
                    //t.write(ht.bodyData, 'binary');
                    t.end(ht.bodyData, 'binary');
                }
            })
            .then((r) => {
                return r;
            }, (err) => {
                throw err;
            });
        };

        ht.get = async function(opts = {method : 'GET', timeout:35000}) {
            return ht.request(opts);
        };

        ht.post = async function(opts = {}) {
            opts.method = 'POST';
            return ht.request(opts);
        };

        ht.put = async function(opts = {}) {
            opts.method = 'PUT';
            return ht.request();
        };

        ht.delete = async function(opts={}) {
            opts.method = 'DELETE';
            return ht.request(opts);
        };

        ht.upload = async function(opts = {}) {
            if (opts.method === undefined) {
                opts.method = 'POST';
            }
            if (opts.method !== 'POST' && opts.method !== 'PUT') {
                throw new Error('method not be allowed');
            }
            if (!opts.headers) {
                opts.headers = {};
            }
            opts.headers['content-type'] = 'multipart/form-data';
            return ht.request(opts);
        };

        ht.download = async function(opts = {}) {
            if (!opts.method) {
                opts.method == 'GET';
            }
            if (opts.method!=='GET' && opts.method!=='POST' && opts.method=='PUT') {
                throw new Error('method must be GET|POST|PUT');
            }
            var downStream = null;
            if (opts.target) {
                downStream = fs.createWriteStream(opts.target, {encoding:'binary'});
            } else {
                if (!opts.dir) {
                    opts.dir = './';
                } else if (opts.dir[opts.dir.length-1] !== '/'){
                    opts.dir += '/';
                }
            }

            if (opts.progress === undefined) {
                opts.progress = true;
            }
            var filename = '';
            var total_length = 0;
            var sid = null;
            return new Promise((rv, rj) => {
                var t = ht.reqStream(opts);
                t.on('error', (err) => {
                    t.close();
                    rj(err);
                });
                t.on('frameError', (err) => {
                    t.close();
                    rj(err);
                });

                t.on('response', (headers, flags) => {
                    console.log(headers);
                    if(headers['content-disposition']) {
                        var name_split = headers['content-disposition'].split(';').filter(p => p.length > 0);
            
                        for(let i=0; i<name_split.length; i++) {
                            if (name_split[i].indexOf('filename*=') >= 0) {
                                filename = name_split[i].trim().substring(10);
                                filename = filename.split('\'')[2];
                                filename = decodeURIComponent(filename);
                            } else if(name_split[i].indexOf('filename=') >= 0) {
                                filename = name_split[i].trim().substring(9);
                            }
                        }
    
                    }

                    if (!filename) {
                        var nh = crypto.createHash('sha1');
                        nh.update(`${(new Date()).getTime()}--`);
                        filename = nh.digest('hex');
                    }

                    if (headers['content-length']) {
                        total_length = parseInt(headers['content-length']);
                    }

                    if (downStream === null) {
                        try {
                            fs.accessSync(opts.dir+filename);
                            filename = `${(new Date()).getTime()}-${filename}`;
                        } catch(err){
                        }
                        downStream = fs.createWriteStream(
                            opts.dir+filename,
                            {encoding:'binary'}
                        );
                    }
                });
                

                var progressCount = 0;
                var retData = '';
                var down_length = 0;
                sid = setInterval(() => {progressCount+=1;}, 20);
                t.on('data', (data) => {
                    //console.log(data.toString());
                    if (downStream === null) {
                        retData += data.toString('binary');
                        down_length = retData.length;
                    } else {
                        if (retData.length > 0) {
                            downStream.write(retData, 'binary');
                            retData = '';
                        }
                        down_length += data.length;
                        downStream.write(data, 'binary');
                    }
                    if (opts.progress && total_length > 0) {
                        if (down_length >= total_length) {
                            console.clear();
                            console.log('100.00%');
                        }
                        else if (progressCount > 25) {
                          console.clear();
                          console.log(`${((down_length/total_length)*100).toFixed(2)}%`);
                          progressCount = 0;
                        }
                    }
                });

                t.on('end', () => {
                    ht.session.close();
                    rv();
                });

                if (ht.bodyData.length > 0 
                    && (ht.tmp_headers[':method'] == 'POST'
                        || ht.tmp_headers[':method'] == 'DELETE'
                        || ht.tmp_headers[':method'] == 'PUT'
                    )
                ) {
                    t.end(ht.bodyData, 'binary');
                }
            })
            .then((r) => {
                console.log('done');
            }, (err) => {
                throw err;
            })
            .catch(err => {
                console.log(err);
            })
            .finally(() => {
                if (downStream) {
                    downStream.end();
                }
                clearInterval(sid);
            });
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
    this.makeUploadData = function (r) {
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
};
