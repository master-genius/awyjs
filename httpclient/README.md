### 超级简单的HTTP客户端请求库


为了可以降低回调深度，并且能够更好的集成async和await。请求返回的结果是Promise。
最开始是为了方便的请求微信接口而设计，目前针对GET, POST,PUT, DELETE请求封装了方便实用的接口。

get、post、put、delete、download都支持http.request参数options的选项。

#### GET请求

``` JavaScript

const awyhttp = require('awyhttp');

//访问http://localhost:2021需要先启动demo中的upfile_serv.js服务。
//支持options和encoding参数，encoding默认为utf8
awyhttp.get('http://localhost:2021/')
.then(data => {
    console.log(data);
}, err => {
    console.log(err);
}).catch(err => {
    console.log(err);
});


```

#### POST请求

``` JavaScript

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

```

#### 上传文件

``` JavaScript

awyhttp.upload('http://localhost:2021/upload2', {
    file : '/home/wy/tmp/fengye.jpg',
    upload_name : 'image'
})
.then(data => {
    console.log(data);
}, err => {
    console.log(err);
});


```

#### 下载文件

``` JavaScript

var img_url = 'http://www.bjp.org.cn/picture/0/1903071209325972565.jpg';

/*
    设置好目标路径后，内部会创建一个可写流，数据是实时写入到文件的。
*/
awyhttp.download(img_url, {
    method : 'GET',
    target : '/home/wy/tmp/1903071209325972565.jpg'
}).then(data => {
    console.log('ok');
}, err => {
    console.log(err);
}).catch(err => {
    console.log(err);
});


```

#### POST请求超时

``` JavaScript

awyhttp.post('http://localhost:2021/pt', {
    data : {
        name : 'Albert Einstein',
        identity : 'physics'
    },
    timeout: 5000
})
.then(data => {
    console.log(data);
}, err => {
    console.log(err);
});

```
