import http from 'http';
import net from 'net';

const PORT: number = parseInt(process.env.PORT || '3000');

function parseRawHeaders(rawHeaders: string[]): Record<string, string> {
    const headers: Record<string, string> = {};
    for(let i = 0; i < rawHeaders.length; i += 2) {
        const k = rawHeaders[i],
              v = rawHeaders[i + 1];
        headers[k] = v;
    }
    return headers;
}


// serve http
const server = http.createServer(function(req: http.IncomingMessage, res: http.ServerResponse) {
    const options = {
        method: req.method,
        headers: parseRawHeaders(req.rawHeaders),
        //localAddress:
    };

    const remoteReq = http.request(<string>req.url, options, function(remoteRes) {
        res.writeHead(<number>remoteRes.statusCode, remoteRes.headers);
        remoteRes.pipe(res, {end: true});
    });
    req.pipe(remoteReq, {end: true});
}).listen(PORT);

// serve https with connect method
server.on('connect', function(req, socket, head) {
    const [hostname, port] = (<string>req.url).split(':');

    const conn = net.connect(parseInt(port), hostname, function() {
        socket.write([
            `HTTP/${req.httpVersion} 200 OK`,
            '', ''
        ].join('\r\n'), 'utf8', function() {
            conn.pipe(socket, {end: true});
            socket.pipe(conn, {end: true});
        });
    });

    conn.on('error', function(e) {
        socket.end();
    });

    socket.on('error', function() {
        conn.end();
    });
});

console.log(`listening on port ${PORT}`);