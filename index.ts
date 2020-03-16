import path from 'path';
import http from 'http';
import url from 'url';
import fs from 'fs';
import webpack from 'webpack';
import MemoryFS from 'memory-fs';
import {webpackConfig} from './configs/webpack.config';

const memFs = new MemoryFS();
memFs.mkdirpSync('/build/');
const cwd = process.cwd();

startWatch();

http.createServer(async (req, res) => {
    setHeaders(res);
    if (req.url === '/') {
        sendFile('./', res, cwd);
        return;
    }
    if (req.url === '/index.js') {
        res.setHeader('Content-type', 'text/javascript');
        try {
            const js = await resolveWatchedFile();
            res.end(js)
        } catch(e) {
            res.statusCode = 500;
            res.end(`console.error(JSON.parse(${JSON.stringify(JSON.stringify(e))}));`);
        }
        return;
    }
    serveStatic(req, res, cwd);
}).listen(3333);

// async function buildOnDemand(): Promise<string> {
//     return new Promise((resolve, reject) => {
//         const compiler = webpack({
//             ...webpackConfig,
//             output: {
//                 filename: './index.js',
//                 path: '/build/'
//             },
//             entry: path.resolve(cwd, 'index.ts')
//         });
//         compiler.outputFileSystem = memFs;
//         compiler.run((err, stats) => {
//             if (err || stats.hasErrors()) {
//               console.error(err, stats);
//               reject(stats.toJson().errors);
//               return;
//             }
//             const js = memFs.readFileSync('/build/index.js', 'utf-8');
//             resolve(js);
//         });
//     });
// }

let buildResult: string = 'console.error("not built yet");';
let buildErrors: any[] | null = null;

// class InversePromise<T> {
//     public resolve!: (val: T) => void;
//     public reject!: (err: any) => void;
//     public promise: Promise<T>;

//     constructor() {
//         this.promise = new Promise((resolve, reject) => {
//             this.resolve = resolve;
//             this.reject = reject;
//         });
//     }
// }

function startWatch() {
    const compiler = webpack({
        ...webpackConfig,
        output: {
            filename: './index.js',
            path: '/build/'
        },
        entry: path.resolve(cwd, 'index.ts')
    });
    compiler.outputFileSystem = memFs;
    compiler.watch({}, (err, stats) => {
        if (err || stats.hasErrors()) {
            if (err) {
                console.error(err);
            } else {
                stats.toJson().errors.forEach(err => console.error(err));
            }
            buildErrors = stats.toJson().errors;
            return;
        }
        const js = memFs.readFileSync('/build/index.js', 'utf-8');
        buildResult = js;
    });
}

async function resolveWatchedFile(): Promise<string> {
    return buildResult;
}

function setHeaders(res: http.ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

const mimeMap = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword'
  };

function isSubdir(parent: string, dir: string) {
    const relative = path.relative(parent, dir);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function sendFile(pathname: string, res: http.ServerResponse, parentDir: string) {
    pathname = path.resolve(parentDir, pathname);
    if (!isSubdir(parentDir, pathname)) {
        res.statusCode = 400;
        res.end(`File ${pathname} is outside of ${parentDir}`);
        return;
    }
    if (!fs.existsSync(pathname)) {
        res.statusCode = 404;
        res.end(`File ${pathname} not found!`);
        return;
    }
    const ext = path.parse(pathname).ext || '.html';
    const mimeType = mimeMap[ext as keyof typeof mimeMap] ?? 'text/plain';
    if (fs.statSync(pathname).isDirectory()) {
        pathname += '/index' + ext;
    }
    fs.readFile(pathname, (err, data) => {
        if (err) {
            res.statusCode = 500;
            res.end(`Error getting the file: ${err}.`);
        } else {
            res.setHeader('Content-type', mimeType);
            res.end(data);
        }
    });
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, parentDir: string) {
    const reqUrl = req.url;
    if (!reqUrl) {
        return;
    }
    const parsedUrl = url.parse(reqUrl);
    const pathname = '.' + parsedUrl.pathname;
    sendFile(pathname, res, parentDir);
}
