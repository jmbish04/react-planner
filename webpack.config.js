const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

const PAGE_TITLE = 'Smart Architect';

module.exports = (env, self) => {
    let isProduction = self.hasOwnProperty('mode') ? (self.mode === 'production') : false;
    let port = self.hasOwnProperty('port') ? self.port : 9001;

    let config = {
        context: path.resolve(__dirname),
        entry: {
            app: './app/index.js',
        },
        output: {
            path: path.join(__dirname, 'dist'),
            filename: '[name].js',
        },
        devtool: isProduction ? 'source-map' : 'eval',
        devServer: {
            open: true,
            port: port,
            contentBase: path.join(__dirname, './dist'),
            historyApiFallback: true
        },
        resolve: {
            extensions: ['.js', '.jsx'],
            alias: {
                // react-planner library source lives at repo root src/
                'react-planner': path.join(__dirname, 'src/index')
            },
            modules: [
                path.resolve(__dirname, 'node_modules'),
                'node_modules'
            ]
        },
        module: {
            rules: [{
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                include: [
                    path.resolve(__dirname, 'app'),  // app source
                    path.resolve(__dirname, 'src')   // react-planner library source
                ],
                use: [{
                    loader: 'babel-loader',
                    options: {
                        'babelrc': false,
                        'compact': false,
                        'plugins': [
                            require.resolve('babel-plugin-transform-object-rest-spread'),
                            require.resolve('babel-plugin-transform-class-properties'),
                            require.resolve('babel-plugin-import-glob')
                        ],
                        'presets': [
                            require.resolve('babel-preset-env'),
                            require.resolve('babel-preset-react')
                        ]
                    }
                }]
            }, {
                test: /\.(jpe?g|png|gif|mtl|obj)$/i,
                use: [{
                    loader: 'file-loader',
                    options: {
                        name: '[path][name].[ext]',
                    }
                }]
            }, {
                test: /\.css$/,
                use: [
                    { loader: 'style-loader' },
                    { loader: 'css-loader' }
                ]
            }]
        },
        plugins: [
            new HtmlWebpackPlugin({
                title: PAGE_TITLE,
                template: './app/index.html',
                filename: 'index.html',
                inject: 'body'
            }),
            new webpack.DefinePlugin({
                'process.env': {
                    'NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
                }
            })
        ]
    };

    return config;
};
