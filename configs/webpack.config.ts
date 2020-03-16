import {Configuration} from 'webpack';
import path from 'path';

export const webpackConfig = (tsconfigPath: string): Configuration => ({
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'awesome-typescript-loader',
                    options: {
                        configFileName: tsconfigPath
                    }
                }
            },
            {
                test: /\.jsx?$/,
                use: ['source-map-loader'],
                enforce: "pre"
            }
        ],
    },
    resolveLoader: {
        modules: [
            path.resolve(__dirname, '../node_modules')
        ]
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.css', '.mjs'],
    },
    devtool: 'inline-source-map',
});
