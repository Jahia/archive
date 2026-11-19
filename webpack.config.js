const path = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const getModuleFederationConfig = require('@jahia/webpack-config/getModuleFederationConfig');
const packageJson = require('./package.json');

module.exports = (env, argv) => {
    let config = {
        entry: {
            main: path.resolve(__dirname, 'src/javascript/index')
        },
        output: {
            path: path.resolve(__dirname, 'src/main/resources/javascript/apps/'),
            filename: 'jahia.bundle.js',
            chunkFilename: '[name].jahia.[chunkhash:6].js'
        },
        resolve: {
            mainFields: ['module', 'main'],
            extensions: ['.mjs', '.js', '.jsx', 'json']
        },
        module: {
            rules: [
                {
                    test: /\.m?js$/,
                    type: 'javascript/auto'
                },
                {
                    test: /\.jsx?$/,
                    include: [path.join(__dirname, 'src')],
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', {modules: false, targets: {safari: '7', ie: '10'}}],
                                '@babel/preset-react'
                            ],
                            plugins: [
                                '@babel/plugin-syntax-dynamic-import'
                            ]
                        }
                    }
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [
                        'style-loader',
                        {
                            loader:'css-loader',
                            options: {
                                modules: true
                            }
                        },
                        'sass-loader'
                    ]
                }
            ]
        },
        plugins: [
        new ModuleFederationPlugin(getModuleFederationConfig(packageJson, {
                // The host's notification provider (jContent shares @jahia/react-material 3.0.5):
                // never bundled, a copy of our own would read a context nobody provides.
                shared: {
                    '@jahia/react-material': {singleton: true, import: false, requiredVersion: false}
                },
                remotes: {
                    //'@jahia/content-editor':'appShell.remotes.contentEditor'
                    '@jahia/jcontent': 'appShell.remotes.jcontent'
                }
            })),            new CleanWebpackPlugin({verbose: false}),
            new CopyWebpackPlugin({patterns:[{from: './package.json', to: ''}]})
        ],
        mode: 'development'
    };

    config.devtool = (argv.mode === 'production') ? 'source-map' : 'eval-source-map';

    if (argv.analyze) {
        config.devtool = 'source-map';
        config.plugins.push(new BundleAnalyzerPlugin());
    }

    return config;
};
