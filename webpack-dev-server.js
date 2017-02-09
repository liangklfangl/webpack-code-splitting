
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const webpackConfig = require('./webpack.config');
const path = require('path');
const env = { dev: process.env.NODE_ENV };

const devServerConfig = {
  contentBase: path.join(__dirname, '../build/'),
  historyApiFallback: { disableDotRule: true }, 
  //满足dotRule资源也采用index.html作为请求资源
  stats: { colors: true } 
};

const server = new WebpackDevServer(webpack(webpackConfig(env)), devServerConfig);

server.listen(3000, 'localhost');
