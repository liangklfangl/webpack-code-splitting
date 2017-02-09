
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const webpackConfig = require('./webpack.config');
const path = require('path');

const env = {dev: process.env.NODE_ENV };
// console.log('env-------',env);
const devServerConfig = {
  contentBase: path.join(__dirname, '../build/'),
  historyApiFallback: { disableDotRule: true }, 
  //dotRule（绝对资源路径）页面请求也用index.html
  stats: { colors: true } 
};

const server = new WebpackDevServer(webpack(webpackConfig(env)), devServerConfig);

server.listen(3000, 'localhost');
