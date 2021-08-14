import http from 'http';
import net from 'net';
import auth, { BasicAuthResult } from 'basic-auth';
import {hashIPv6,getFamily} from './haship';
import os from 'os';
import internal from 'stream';
import dns from 'dns';

const HOST: string = process.env.LISTEN || '127.0.0.1';
const PORT: number = parseInt(process.env.PORT || '3000');
const RANGE: string|undefined = process.env.RANGE;
const SALT: string = process.env.SALT || os.hostname();
const PASSWORD: string|undefined = process.env.PASSWORD;

if(!PASSWORD) {
    console.error('no password set');
    process.exit(1);
}
if(!RANGE) {
    console.error('no password set');
    process.exit(1);
}

const FAMILY = getFamily(RANGE);

// SystemError is not exposed by nodejs
interface SystemError extends Error {
    code?: string | undefined;
    syscall?: string;
}

function parseRawHeaders(rawHeaders: string[]): Record<string, string> {
    const headers: Record<string, string> = {};
    for(let i = 0; i < rawHeaders.length; i += 2) {
        const k = rawHeaders[i],
              v = rawHeaders[i + 1];
        if(k.toLowerCase() !== 'proxy-authorization') {
            headers[k] = v;
        }
    }
    return headers;
}

function httpError(res: http.ServerResponse, code: number, message: string) {
    res.writeHead(code, message).end(message + '\n');
}

// serve http
const server = http.createServer(function(req: http.IncomingMessage, res: http.ServerResponse) {
    const proxyAuth = 'proxy-authorization' in req.headers ? auth.parse(<string>req.headers['proxy-authorization']) : undefined;
    if(proxyAuth?.pass !== PASSWORD) {
        return httpError(res, 407, 'Proxy Authentication Required');
    }

    const localAddress = hashIPv6(RANGE, SALT + proxyAuth.name);
    const options = {
        method: req.method,
        headers: parseRawHeaders(req.rawHeaders),
        localAddress,
        family: FAMILY,
    };

    const remoteReq = http.request(<string>req.url, options, function(remoteRes) {
        res.writeHead(<number>remoteRes.statusCode, remoteRes.headers);
        remoteRes.pipe(res, {end: true});
        remoteRes.on('error', () => { })
    });
    remoteReq.on('error', (e: Error) => {
        if('syscall' in e) {
            const syse = <SystemError>e;
            if(syse.syscall === 'bind') {
                console.error(`failed to bind to local address ${localAddress}`);
            }
        }
        httpError(res, 502, 'Proxy Error');
    });
    req.pipe(remoteReq, {end: true});
}).listen(PORT, HOST);

function httpsError(socket: internal.Duplex, code: number, message: string) {
    socket.write([
        `HTTP/1.0 ${code} ${message}`,
        '', message, ''
    ].join('\r\n'), 'utf8', () => {
        socket.end();
    });
}

// serve https with connect method
server.on('connect', function(req, socket, head) {
    const proxyAuth = 'proxy-authorization' in req.headers ? auth.parse(<string>req.headers['proxy-authorization']) : undefined;
    if(proxyAuth?.pass !== PASSWORD) {
        return httpsError(socket, 407, 'Proxy Authentication Required');
    }

    const localAddress = hashIPv6(RANGE, SALT + proxyAuth.name);

    try {
        const [hostname, port] = (<string>req.url).split(':');
        const options = {
            host: hostname,
            port: parseInt(port),
            localAddress,
            family: FAMILY,
        };
        const conn = net.connect(options, function() {
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
    }
    catch(e) {
        if(e.code === 'EINVAL' && e.syscall === 'bind') {
            console.error(`failed to bind to local address ${localAddress}`);
        }
        return httpsError(socket, 502, 'Proxy error');
    }
});

console.log(`listening on ${HOST}:${PORT}`);
