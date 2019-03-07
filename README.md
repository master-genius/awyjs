### awy框架

awy是一个使用NodeJS开发的Web框架，很简单，也很小。基于async和await关键字。

#### 支持功能
* 中间件
* 路由
* 中间件按照路由规则匹配执行
* 解析Body数据
* 解析上传的文件
* 启用守护进程模式
* 配置HTTPS


### 提醒

文件awy-old.js是之前的版本，在使用上和awy.js是兼容的，只是新版本在内部设计上做了一些优化调整。


#### 使用示例

``` JavaScript

const awy = require('awy');

var ar = new awy();

/*
一定要注意的是：
    回调函数要写成async rr的形式。
rr是打包了request和response的对象：
    {
        req,
        res
    }
    
*/

ar.get('/', async rr => {
    rr.res.Body = 'success';        
});

ar.run('localhost', 8080);

```

```

curl 'http://localhost:8080/'

输出结果：
  success

```

#### 获取URL参数（QueryString参数）

``` JavaScript

const awy = require('awy');

var ar = new awy();

ar.get('/test', async rr => {
    //获取name，如果不存在则默认返回空字符串。
    //如果第二个参数不填写，则name不存在会返回null。
    var name = rr.req.GetQueryParam('name', '');
    console.log(name);
    rr.res.Body = name;
});

ar.run('localhost', 8080);

```

```

curl 'http://localhost:8080/test?name=helo'

输出结果：
  helo

```

#### 获取POST提交的数据

``` JavaScript

const awy = require('awy');

var ar = new awy();

ar.post('/pt', async rr => {
    var username = rr.req.GetBodyParam('username', '');
    rr.res.Body = username;
});

ar.run('localhost', 8080);

```

```

curl 'http://localhost:8080/pt' -d 'username=albert'

返回结果：
  albert

```

#### 上传文件

上传的文件会被解析到rr.req.UploadFiles，结构如下：

``` JavaScript

{
    "image" : [
        {
            "filename"      : "a.png",
            "content-type"  : "image/png",
            "data"          : "......"
        },

        {
            "filename"      : "b.png",
            "content-type"  : "image/png",
            "data"          : "......"
        }
    ],

    "file" : [
        
        {
            "filename"      : "w.txt",
            "content-type"  : "text/plain",
            "data"          : "......"
        },

        {
            "filename"      : "x.c",
            "content-type"  : "text/plain",
            "data"          : "......"
        }
    ]
}

/*
   如果要POST上传文件，name属性设置为image，可以通过rr.req.UploadFiles['image'][0]访问第一个文件。
*/

```

##### 上传文件的处理

``` JavaScript

const awy = require('awy');

var ar = new awy();

/*
开启解析文件数据选项，如果想使用其他处理方式，
可以设置为false，交给其他中间件处理。
可以通过req.GetRawBody()或者req.BodyRawData
获取原始的上传数据。
*/
ar.config.parse_upload = true;

ar.post('/upload', async rr => {
    //GetFile接受两个参数，第二个参数是索引值，默认为0。
    //每次上传一个文件的情况居多，所以默认获取第一个。
    //第一个参数是索引的名称。
    //如果文件不存在返回null。
    var uf = rr.req.GetFile('image');

    if (!uf) {
        rr.res.Body = 'Error: file not found';
        return ;
    }

    await rr.req.MoveFile({
        path : './upload/images'
    })
    .then(ret => {
        rr.res.Body = ret;
    }, err => {
        rr.res.Body = err.message;
    })
    .catch(err => {
        rr.res.Body = err.message;
    });

});

ar.run('localhost', 8080);


```

```
//文件tmp/a.png替换为其他存在的文件。
curl 'http://localhost:8080/upload' -F 'image=@tmp/a.png'

```


#### 中间件

awy支持中间件模式，添加方式很简单。

``` JavaScript

const awy = require('awy');

var ar = new awy();
/*
   next表示下一层中间件，
   并且只需要await next(rr);
   就可以等待执行下一层中间件。
   之后还可以继续执行后面的操作，

   如果没有await next(rr);
   则请求到此结束。

   中间件顺序：按照添加的顺序逆序执行。
   所以先执行的中间件放在后面。
*/
ar.add(async (rr, next) => {
    rr.res.Body += 'I am a middleware\n';
    await next(rr);
    rr.res.Body += '[OK]\n';
}, ['/', '/test']);


ar.get('/', async rr => {
    rr.res.Body += 'Hello world\n'; 
});

ar.get('/test', async rr => {
    rr.res.Body += 'This is test page\n';
});

ar.get('/notmid', async rr => {
    rr.res.Body += 'No middleware running\n';
});

```

```

curl 'http://localhost:8080/'

 I am a middleware
 Hello world
 [OK]


curl 'http://localhost:8080/test'

 I am a middleware
 This is test page
 [OK]


curl 'http://localhost:8080/notmid'

 No middleware running

```

#### 路由

awy的路由非常简单，除了基本的字符串，仅仅使用:支持参数类型。

```

/content/:id
    访问方式：/content/123

/rs/:id/:group
    此时如果访问路径为/rs/1234/linux，
    则实际会执行/rs/:id/:group，
    参数解析到req.RequestARGS：
        {
            id    : "1234",
            group : "linux"
        }

```

#### RESTFul

``` JavaScript

const awy = require('awy');

var as = new awy();

as.get('/content/:id', async rr => {
   ....
});

as.post('/content', async rr => {
    ...
});

as.put('/content/:id', async rr => {
    ...
});

as.map(['GET', 'PUT', 'DELETE'], '/resource/:id', async rr => {
    ...
});


```

#### 配置选项

框架使用一些选项控制某些功能，选项信息如下。

``` JavaScript

{
    //此配置表示POST/PUT提交表单的最大字节数，也是上传文件的最大限制，
    post_max_size   : 8000000,

    //开启守护进程，守护进程用于上线部署，要使用ants接口，run接口不支持
    daemon          : false,

    log_file        : './access.log',

    error_log_file  : './error.log',

    /*
        调用ants接口，如果设置路径不为空字符串，
        则会把pid写入到此文件，可用于服务管理。
    */
    pid_file        : '',

    /*
        日志类型：
            stdio   标准输入输出，可用于调试
            ignore  没有
            file    文件，此时会使用log_file以及error_log_file 配置的文件路径

        这个选项以及两个日志文件配置只有在开启daemon的情况下才会生效
    */
    log_type        : 'stdio',

    /*
        暂时只是实现了mem模式，文件会被放在内存里。
    */
    upload_mode     : 'mem',

    //自动解析上传的数据
    parse_upload    : false,

    //开启HTTPS
    https_on        : false,

    //HTTPS密钥和证书的路径
    https_options   : {
        key     : '',
        cert    : ''
    },
};

```

