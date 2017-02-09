const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = env => {
  const ifProd = plugin =>  env.prod ? plugin : undefined;
  const removeEmpty = array => array.filter(p => !!p);
  //移除空的元素
  return {
    entry: {
      app: path.join(__dirname, '../src/'),
      vendor: ['react', 'react-dom', 'react-router'],
    },
    
    output: {
      filename: '[name].[hash].js',
      path: path.join(__dirname, '../build/'),
    },

    module: {
     
      loaders: [
        {
          test: /\.(js)$/, 
          exclude: /node_modules/, 
          loader: 'babel-loader', 
          query: {
            cacheDirectory: true,
          },
        },
      ],
    },

    plugins: removeEmpty([
      new webpack.optimize.CommonsChunkPlugin({
        name: 'vendor',
        minChunks: Infinity,
        filename: '[name].[hash].js',
      }),

      new HtmlWebpackPlugin({
        template: path.join(__dirname, '../src/index.html'),
        filename: 'index.html',
        inject: 'body',
        hash:true//添加compilation hash
      }),

      // Only running DedupePlugin() and UglifyJsPlugin() in production
      ifProd(new webpack.optimize.DedupePlugin()),
      ifProd(new webpack.optimize.UglifyJsPlugin({
        compress: {
          'screw_ie8': true,
          'warnings': false,
          'unused': true,
          'dead_code': true,
        },
        output: {
          comments: false,
        },
        sourceMap: false,
      })),
    ]),
  };
};
