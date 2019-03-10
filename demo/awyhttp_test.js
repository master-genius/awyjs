const awyhttp = require('../httpclient/awyhttp.js');


awyhttp.get('http://localhost:2021/')
.then(data => {
    console.log(data);
}, err => {
    console.log(err);
}).catch(err => {
    console.log(err);
});

awyhttp.post('http://localhost:2021/pt', {
    data : {
        name : 'Albert Einstein',
        identity : 'physics'
    }
})
.then(data => {
    console.log(data);
}, err => {
    console.log(err);
});

awyhttp.upload('http://localhost:2021/upload2', {
    file : '/home/wy/tmp/fengye.jpg',
    upload_name : 'image'
})
.then(data => {
    console.log(data);
}, err => {
    console.log(err);
});


var img_url = 'http://www.bjp.org.cn/picture/0/1903071209325972565.jpg';

awyhttp.download(img_url, {
    method : 'GET',
    target : '/home/wy/tm/1903071209325972565.jpg'
}).then(data => {
    console.log('ok');
}, err => {
    console.log(err);
}).catch(err => {
    console.log(err);
});
