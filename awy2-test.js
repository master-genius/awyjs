const http2 = require('http2');
const fs = require('fs');

const server = http2.createSecureServer({
  key: fs.readFileSync('./rsa/localhost-privkey.pem'),
  cert: fs.readFileSync('./rsa/localhost-cert.pem')
});

/* console.log(server);
console.log(server.__proto__);
console.log(server.__proto__.__proto__);
console.log(server.__proto__.__proto__.__proto__);
 */

server.on('error', (err) => console.error(err));

server.on('stream', (stream, headers) => {
  //console.log(stream.__proto__.__proto__.__proto__);
    console.log(headers);
  // stream is a Duplex
  stream.respond({
    'content-type': 'text/html',
    ':status': 200
  });

  var body_data = '';
  stream.on('data', (data) => {
      body_data += data.toString('binary');
      //console.log(data.toString('utf8'));
  });

  stream.on('end', () => {
    if (headers[':method'] === 'POST') {
      stream.write(`post:${body_data.length} Bytes`);
    }
    
    stream.end('<h1>Hello World</h1>');
  });

  
});

server.listen(8443);

/**
 * stream是全双工流，请求和响应都通过stream操作。
 * HTTP/2使用了二进制分帧层传输数据，但是Node实现的更高一层的封装，
 * 传输数据解析方式兼容HTTP/1.1，Node中HTTP/2模块的
 * HttpSession类是相对底层的封装，一个会话开启后，使用stream事件
 * 监听流，这里的设计方案是使用封装好的HttpStream等功能。
 * 
 */