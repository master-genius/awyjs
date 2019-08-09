### awy框架

awy是一个NodeJS环境的Web服务端框架，很简单，也很小。基于async和await关键字。其核心就是一个基于中间件模式根据路由分发请求的处理过程。

awy2.js是支持HTTP/2协议的版本，并且只能使用HTTP/2。npm安装：npm i awy2。接口和awy完全兼容。目前几乎所有的浏览器都支持HTTP/2，多数情况后端无需考虑协议降级。

#### 支持功能

* 中间件
* 路由
* 路由分组
* 解析Body数据
* 解析上传的文件
* 启用守护进程模式
* 配置HTTPS

#### API和属性参考

**rr.req.Param**
URL参数，JSON键值对存储。

**rr.req.BodyParam**
POST/PUT提交的Body参数，根据content-type不同值，有不同的处理方式，键值对存储或者是其他格式化文本。

**rr.req.RawBody**
Body原始数据，binary编码。

**rr.req.Args**
路由参数。

**rr.req.ROUTEPATH**
请求的真正处理路由。比如带参数的路由/content/:id，实际访问的路径是/content/12。ROUTEPATH的值是/content/:id。

**rr.req.ORGPATH**
请求的原始路由，比如带参数的路由/content/:id，实际访问的路径是/content/12。则ORGPATH的值是/content/12。


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

#### run返回值

run接口的返回值是http.createServer的返回值，也就是http.Server的实例。以下示例设置超时时间为5秒。

对于awy2来说，是http2.createSecureServer的返回值http2.Http2SecureServer实例，同样有setTimeout方法。

```
const awy = require('awy');

var ar = new awy();

ar.get('/', async rr => {
    rr.res.Body = 'ok';
});

ar.run('localhost', 8080).setTimeout(5000);

```

通过返回值获取实例可以使用Node.js原生提供的功能，这样框架做更少的事情，学习和使用成本相对也低。框架主要使用了request以及clientError事件，对于http2来说，主要使用了stream和sessionError事件，通过返回值开发者可以使用更多的事件做扩展处理。

#### 超时

HTTP模块的默认超时时间为120秒，awy框架默认设置为25秒，你可以通过run的返回值调用setTimeout方法设置一个合理的时间，或者通过请求请求参数rr.req以及rr.res设置具体请求的超时时间。

对于HTTP服务来说，一般正常的服务，请求处理时间都很短，不需要特别长的超时设置，对比较特殊的Web服务，比如上传和下载，可以设置单独的超时。


#### 获取URL参数（QueryString参数）

``` JavaScript

const awy = require('awy');

var ar = new awy();

ar.get('/test', async rr => {
    var {name} = rr.req.Param;
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
    var {username} = rr.req.BodyParam;
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
可以通过或者req.RawBody
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
    参数解析到req.Args：
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

#### 路由分组

路由分组是基于路径分隔符的第一个字符串，比如/api/a和/api/b都使用/api分组。框架的设计机制保证可以对中间件也进行分组，通过group接口返回的对象可以使用get、post、put、delete、options、any、add接口。这时候使用add添加的中间件只会在当前分组下执行。以下代码给出了完整示例：

``` JavaScript
const awy = require('awy');

var ar = new awy();

//使用api分组。
var api = ar.group('/api');

/*
    分组下的路径仅仅就是把分组名和路径拼接到一起作为整体的路由。
    最终执行就是/api/a或/api/b这样的形式。
*/

api.get('/a', async rr => {
    rr.res.Body = 'a';
});

api.get('/b', async rr => {
    rr.res.Body = 'b';
});

//此中间件只会在/api分组执行。
api.add(async (rr, next) => {
    console.log('/api middleware');
});

//全局的路径，尽管是/api开头，但是不属于/api分组
ar.get('/api/xyz', async rr => {
    rr.res.Body = 'xyz';
});

ar.run('localhost', 8080);

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

as.delete('/resource/:id', async rr => {
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

    /*
        暂时只是实现了mem模式，文件会被放在内存里。
    */
    upload_mode     : 'mem',

    //自动解析上传的数据
    parse_upload    : true,

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

如果不需要Cluster模块，则可以使用shell命令setsid加上要运行的命令：
```
setsid node serv.js
```
