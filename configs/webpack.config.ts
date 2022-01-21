import {Configuration} from 'webpack';
import path from 'path';
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

export const webpackConfig = (tsconfigPath: string): Configuration => ({
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: tsconfigPath,
                    }
                },
                exclude: /node_modules/,

            },
            {
                test: /\.jsx?$/,
                use: ['source-map-loader'],
                enforce: "pre"
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'fonts/'
                        }
                    }
                ]
            }
        ],
    },
    resolveLoader: {
        modules: [
            path.resolve(__dirname, '../node_modules')
        ]
    },
    resolve: {
        plugins: [
            new TsConfigPathsPlugin({configFile: tsconfigPath, silent: true})
        ],
        extensions: ['.ts', '.tsx', '.js', '.css', '.mjs'],
    },
    devtool: 'inline-source-map',
});
