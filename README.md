### awy框架

awy是一个NodeJS环境的Web服务端框架，很简单，也很小。基于async和await关键字。其核心就是一个基于中间件模式根据路由分发请求的处理过程。

awy2.js是支持HTTP/2协议的版本，并且只能使用HTTP/2。npm安装：npm i awy2。接口和awy完全兼容。目前几乎所有的浏览器都支持HTTP/2，多数情况后端无需考虑协议降级。

#### 支持功能

* 中间件
* 路由
* 中间件按照路由规则匹配执行
* 解析Body数据
* 解析上传的文件
* 启用守护进程模式
* 配置HTTPS

#### API参考

[awy核心API参考](https://awy.linuslinux.com/#api)

#### !提醒

awy-old.js是早期版本，不建议使用，awy-trash是将要删除的。awy2.js是支持HTTP/2协议的，目前还在测试中，并且不支持降级，只能是HTTP/2协议。


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

    await rr.req.MoveFile(uf, {
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

awy的中间模式可以用下图描述：

![](/images/middleware.png)

awy中间件添加方式很简单。

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

awy的路由非常简单，除了基本的字符串，支持使用:表示变量，\*匹配任意路径。

**一定要注意的是：\* 和 : 不能同时出现在路由字符串中。**

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

/static/*
    这种情况，/static/后面可以跟任意路径都会通过此路由绑定的函数处理。
    但是/*则会匹配所有路由，请注意不要出现冲突的情况。

使用*可以实现扩展路由的功能，如果你使用 /* 接管所有的路径，之后可以在请求中进行更具体的路由派发。

或者使用中间件接管路由分发。

const awy = require('awy');

var ant = new awy();

ant.map(['GET', 'POST'], '/*', async rr => {
    //进行路由分发。
    //req.ORGPATH存储请求真实的路径信息。
    await dispatchRoute(rr.req.ORGPATH);
});

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
    body_max_size   : 8000000,

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

#### 在后台执行

run接口运行后，只能作为当前shell的子进程执行，如果加上&运行命令，尽管现在最新的bash把后台进程作为单独的一个执行线程独立出去，但是实际测试发现，在执行一段时间后会退出。具体原因还没有深入研究。不过比较保险的做法是创建守护进程。

这个操作使用ants接口可以快速实现，ants接口的前两个参数和run一致：接受host和port。第三个参数是一个整数表示要创建几个子进程处理请求，不填写默认为0，这种情况会根据CPU核心数创建子进程。

ants接口运行后，Master进程负责收集子进程处理请求的日志信息并写入到日志文件，这需要config中log_type设置为file，并且设置log_file以及error_log_file的路径：

```

const awy = require('awy');

var ant = new awy();

ant.config.log_type = 'file';
ant.config.log_file = './access.log';
ant.config.error_log_file = './error.log';

//....

ant.ants('0.0.0.0', 80);

```

ants运行后，Master进程会把stdout和stderr重定向到指定的文件，而子进程处理请求使用console.log仍然会输出到终端。
