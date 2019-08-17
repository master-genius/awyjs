const h2cli = require('../httpclient/awyhttp2');

var h = h2cli.init('https://localhost:2022/');

var endSession = false;

var total = 1000;

var t = parseInt(total / 220) + 1;

for (let i=0; i<total; i++) {

    if ((i % t) == 0 || i == total-1) {
        endSession = true;
    }

    h.get({endSession: endSession})
    .then(data => {console.log(data);}, err=> {throw err;})
    .catch(err => {console.log(err);});

    h.post({
        endSession : endSession,
        path : '/p',
        data : {
            helo : 'worl'
        }
    })
    .then(data => {console.log(data);}, err => {throw err;})
    .catch(err => {console.log(err);});

    if (endSession && i < total-2) {
        endSession = false;
        h = h2cli.init('https://localhost:2022/');
    }
}

