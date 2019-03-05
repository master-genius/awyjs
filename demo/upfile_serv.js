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

aserv.add(async (rr, next) => {
    if (rr.req.GetQueryParam('utoken') === 'I-like-awy') {
        await next(rr);
    } else {
        rr.res.Body = 'You need to say: I like awy\n';
    }
}, ['/upload']);

aserv.post('/upload', async rr => {
    for(var k in rr.req.UploadFiles) {
        for (var i=0; i < rr.req.UploadFiles[k].length; i++) {
            moveUploadFile(rr.req.UploadFiles[k][i]);            
        }
    }
});

aserv.post('/upload2', async rr => {
    console.log(rr.req.GetBody());

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
        })
        .catch(err => {
            console.log(err);
        });
        console.log(flag);
    } else {
        rr.res.Body = 'Error: file not found';
    }
});

aserv.run('127.0.0.1', 2021);

