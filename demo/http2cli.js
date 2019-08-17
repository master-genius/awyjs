const h2cli = require('../httpclient/awyhttp2');

var h = h2cli.init('https://localhost:5678/download');

h.download({
    method : 'GET',
    dir : process.env.HOME+'/downloads/'
});

/* 
var h = h2cli.init('https://localhost:2022/');

h.get()
.then((data) => {
    console.log(data);
});

h.post({
    path : '/pt',
    data : 'age=29',
})
.then(data => {
    console.log(data);
    //h.close();
});

h.upload({
    path :'/upf',
    data : {
        files : {
            "image" : [
                '/home/wy/tmp/images/流星划过星系.jpg'
            ],
            "file" : [
                '/home/wy/videos/毒液.mp4'
            ],

            "video" : [
                '/home/wy/videos/太极宗师片头曲.mkv',
                '/home/wy/videos/太极宗师片尾曲.mkv'
            ]
        }
    },
    events : {
        'close' : () => {
            console.log('closed');
        },
        
        'headers' : (headers, flags) => {
            console.log(headers, flags);
        }
    }
})
.then(data => {
    console.log(data);
    h.close();
});
 */