const awy = require('../awy2.js');
const fs = require('fs');

aserv = new awy();

//aserv.config.daemon = true;
aserv.config.parse_upload = true;

function moveUploadFile(uf) {
    fs.writeFileSync(
        './upload/' + uf.filename,
        uf.data,
        {encoding : 'binary'}
    );
}

//针对/upload路由的中间件，需要URL携带参数utoken=I-like-awy才可以请求成功。
aserv.add(async (rr, next) => {
    if (rr.req.GetQueryParam('utoken') === 'I-like-awy') {
        await next(rr);
    } else {
        rr.res.Body = 'You need to say: I like awy\n';
    }
}, ['/upload']);

//针对/upload2路由的中间件，单文件上传检测文件大小不能超过2M。
aserv.add(async (rr, next) => {
    var img = rr.req.GetFile('image');
    if (!img) {
        rr.res.Body = 'image not found';
    } else if (Buffer.byteLength(img.data, 'binary') > 2000000 ) {
        rr.res.Body = 'image size too large';
    } else {
        await next(rr);
    }

}, ['/upload2']);


//GET请求IsUpload为false，并且不会有GetFile方法。
aserv.get('/', async rr => {
    console.log(rr.req.IsUpload, typeof rr.req.GetFile);
    rr.res.Body = 'Helo';
});

aserv.post('/pt', async rr => {
    rr.res.Body = rr.req.GetBody();
});

aserv.post('/upload', async rr => {
    for(var k in rr.req.UploadFiles) {
        for (var i=0; i < rr.req.UploadFiles[k].length; i++) {
            moveUploadFile(rr.req.UploadFiles[k][i]);            
        }
    }
});

aserv.post('/upload2', async rr => {

    var f = rr.req.GetFile('image');
    if (f) {
        var flag = false;
        await rr.req.MoveFile(f,{
            path : './upload/images'
        })
        .then(ret => {
            console.log('end upload');
            flag = 'ok';
            rr.res.Body = ret;
        }, err => {
            console.log(err);
            throw err;
        })
        .catch(err => {
            console.log(err);
            rr.res.Body = 'upload image failed';
        });

    } else {
        rr.res.Body = 'Error: file not found';
    }
});

aserv.run('127.0.0.1', 2021);

