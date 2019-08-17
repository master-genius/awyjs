const h2cli = require('../httpclient/awyhttp2');

for (let i=0; i<600; i++) {
    h2cli.init('https://localhost:2022/').get({endSession:true})
    .then((data) => {
        console.log(data);
    }, err => {
        console.log(err);
    })
    .catch(err => {
        console.log(err);
    });

    h2cli.init('https://localhost:2022/p').post({
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

    h2cli.init('https://localhost:2022/upf').upload({
        endSession: true,
        data : {
            files : {
                file: [
                    '/home/wy/pictures/1qw.jpg'
                ]
            }
        }
    }).then(data => {console.log(data);}, err => {
        throw err;
    }).catch(err => {
        console.log(err);
    });
}

