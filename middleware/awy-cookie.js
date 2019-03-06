
module.exports = async function(rr, next) {
    rr.req.CookieParam = {};
    rr.req.GetCookieParam = function(key, val=null) {
        if(rr.req.CookieParam[key]) {
            return rr.req.CookieParam[key];
        }
        return val;
    };

    if (rr.req.headers['cookie']) {
        
        var cookies = rr.req.headers['cookie'].split(';').filter(c => c.length > 0);

        var tmpList = [];
        var name = '';
        for(var i=0; i<cookies.length; i++) {
            tmpList = cookies[i].split('=').filter(p => p.length > 0);
            if (tmpList.length < 2) {
                continue;
            }
            name = tmpList[0].trim();
            if (name.length > 0) {
                rr.req.CookieParam[name] = tmpList[1];
            }
        }
    }

    await next(rr);
};
