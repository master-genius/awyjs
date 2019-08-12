const h2cli = require('../httpclient/awyhttp2');

var filesData = h2cli.preLoadFiles({
    'image' : [
        '/home/wy/tmp/images/流星划过星系.jpg',
        '/home/wy/tmp/images/kaola.jpg',
        '/home/wy/tmp/linux-shot/mocp-4.png'
    ],

    'source-code' : [
        '/home/wy/c/a.c',
        '/home/wy/node/t.js'
    ]
});

for(var i=0; i<filesData.length; i++) {
    console.log(filesData[i]['content-type'], 
        filesData[i]['filename'],
        filesData[i]['upload_name'],
        filesData[i]['data'].length
    );
}

var body_data = h2cli.makeUploadData({"files":filesData});

console.log(body_data['content-type'], 
    body_data['body-data'].length, 
    body_data['body-data'].substring(0,150)
);
