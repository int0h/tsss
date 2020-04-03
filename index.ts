import path from 'path';
import http from 'http';
import url from 'url';
import fs from 'fs';
import webpack from 'webpack';
import MemoryFS from 'memory-fs';
import {cli, option} from 'typed-cli';
import chalk from 'chalk';

import {webpackConfig as defaultWebpackConfig} from './configs/webpack.config';

const builtInHtmlPath = path.resolve(__dirname, 'built-in.html');

const builtInName = '[built-in.html]';

const cwd = process.cwd();
const entryTs = resolveFile([
    'index.ts',
    'index.tsx',
    'app.ts',
    'app.tsx'
].map(filename => `./${filename}`)) ?? 'index.ts';
const entryHTML = resolveFile([
    'index.html',
    'index.htm',
    'app.html',
    'app.htm'
].map(filename => `./${filename}`)) ?? builtInName;

const {options: cliOptions} = cli({
    name: 'tsss',
    description: 'Run it in any folder and it will serve `./index.html` in that folder as well as any other files except for `./index.js`'
        + ' which is going to be the result of TypeScript compilation of `./index.ts` file.',
    options: {
        src: option.string
            .alias('s')
            .description('typescript source file name')
            .default(entryTs),
        html: option.string
            .alias('h')
            .description('html source file name')
            .default(entryHTML),
        port: option.number
            .alias('p')
            .description('port of http server')
            .default(3333),
        webpackConfigExt: option.string
            .alias('wco')
            .description('webpack configuration extension file'),
        webpackConfig: option.string
            .alias('wc')
            .description('webpack configuration file'),
        tsconfig: option.string
            .alias('c')
            .description('typescript configuration file')
            .default(path.resolve(__dirname, './configs/tsconfig.json'))
    }
});

const baseWebpackCfg = cliOptions.webpackConfig
    ? require(path.resolve(cwd, cliOptions.webpackConfig))
    : defaultWebpackConfig(cliOptions.tsconfig);
const webpackConfigExt = cliOptions.webpackConfigExt
    ? require(path.resolve(cwd, cliOptions.webpackConfigExt))
    : {};
const webpackConfig = {...baseWebpackCfg, ...webpackConfigExt};

console.log([
    '---',
    `Building ${chalk.blue(path.relative(cwd, entryTs))}`,
    `and serving ${chalk.red(path.relative(cwd, entryHTML))}`,
    `on ${chalk.bold(`http://localhost:${cliOptions.port}`)}`,
    '---',
].join('\n'));

const memFs = new MemoryFS();
memFs.mkdirpSync('/build/');

startWatch();

http.createServer(async (req, res) => {
    setHeaders(res);
    if (req.url === '/') {
        if (cliOptions.html === builtInName) {
            res.setHeader('content-type', mimeMap['.html']);
            res.end(fs.readFileSync(builtInHtmlPath, 'utf-8'));
            return;
        }
        sendFile(cliOptions.html, res, cwd);
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
}).listen(cliOptions.port);

function resolveFile(variants: string[]): string | null {
    for (const v of variants) {
        if (fs.existsSync(v)) {
            return v;
        }
    }
    return null;
}

let buildResult: string = 'console.error("not built yet");';
let buildErrors: any[] | null = null;

function startWatch() {
    const compiler = webpack({
        ...webpackConfig,
        output: {
            filename: './index.js',
            path: '/build/'
        },
        entry: cliOptions.src
    });
    compiler.outputFileSystem = memFs;
    compiler.watch({
        poll: 100
    }, (err, stats) => {
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
