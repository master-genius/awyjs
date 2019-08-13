const h2cli = require('../httpclient/awyhttp2');

for (let i=0; i<800; i++) {
    h2cli.init('https://localhost:2021/ctx-test').get({endSession:true})
    .then((data) => {
        console.log(data);
    }, err => {
        console.log(err);
    })
    .catch(err => {
        console.log(err);
    });

    h2cli.init('https://localhost:2021/pt').post({
        endSession:true,
        data : {
            helo : 'worl'
        }
    })
    .then((data) => {
        console.log(data);
    }, err => {
        console.log(err);
    })
    .catch(err => {
        console.log(err);
    });
}