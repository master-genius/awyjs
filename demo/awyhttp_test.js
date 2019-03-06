const awyhttp = require('awyhttp');


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

var img_url = 'https://api.w3xm.top/media/images/u/u195f09b89a97fe441699debbe2b4600f21027072.png';

awyhttp.download(img_url, {
    method : 'GET',
    target : '/home/wy/tmp/dtest.png'
}).then(data => {
    console.log(data);
}, err => {
    console.log(err);
}).catch(err => {
    console.log(err);
});
