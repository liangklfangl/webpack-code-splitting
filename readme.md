## webpack实现code splitting方式分析

### webpack的配置分析

#### 为我们的package.json添加scripts

```js
    "scripts": {
    "start": "NODE_ENV=development node webpack/webpack-dev-server --env.dev",
    "build": "rm -rf build/* | NODE_ENV=production webpack --config webpack/webpack.config.js --progress --env.prod "
  },
```

添加script是为了让我们的调试更加方便

####  build命令

##### webpack.config.js配置成为一个函数

我们首先删除build目录，设置环境变量为生成环境，并调用webpack完成打包，打包的时候传入配置文件以及参数，其中--progress会在webpack中使用来显示打包的进度，而--env.prod会在用来给webpack传入一个env对象，我们看看下面的例子:

```js
 "build": "rm -rf build/* | NODE_ENV=production webpack --config webpack/webpack.config.js --progress --env.prod --env.name hello"
```

这时候我们在webpack.config.js中可以获取到这个env对象：

```js
{ prod: true, name: 'hello' }
```

而且你要注意的是：此时的webpack.config.js是一个函数了，而不是一个object！这个函数会接收到env对象作为参数:

```js
module.exports = env => {
  };
};
```

##### webpack.config.js根据不同的执行环境加载不同的plugin

我们看看如下的配置:

```js
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
module.exports = env => {
  const ifProd = plugin =>  env.prod ? plugin : undefined;
  const removeEmpty = array => array.filter(p => !!p);
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
        minChunks: Infinity,//共有模块在vendor.js中，其他的都在本文件中全部打包不用提取公用模块
        filename: '[name].[hash].js',
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, '../src/index.html'),
        filename: 'index.html',
        inject: 'body',
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

```

第一：从入口文件的配置我们可以知道，把业务代码和框架代码分开打包是明智的:

```js
   entry: {
      app: path.join(__dirname, '../src/'),
      vendor: ['react', 'react-dom', 'react-router'],
    }
```

这也是[官网推荐的方式](http://webpack.github.io/docs/code-splitting.html#split-app-and-vendor-code)。官网给出了下面的例子:

```js
var webpack = require("webpack");
module.exports = {
  entry: {
    app: "./app.js",
    vendor: ["jquery", "underscore", ...],
  },
  output: {
    filename: "bundle.js"
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin(/* chunkName= */"vendor", /* filename= */"vendor.bundle.js")
  ]
};
```

这样，就会把所有的出现在app.js中的如"jquery", "underscore"模块都打包在一起，得到"vendor.bundle.js",而bundle.js只会得到你的业务代码!但是有一点要注意：我们的"vendor.bundle.js"必须要先加载，因为其包含[webpackJsonp这个webpack执行环境](https://github.com/liangklfangl/commonsChunkPlugin_Config)


第二：配置了HtmlWebpackPlugin

```js
new HtmlWebpackPlugin({
        template: path.join(__dirname, '../src/index.html'),
        filename: 'index.html',
        inject: 'body',//true和body表示所有js文件被放在body底部,head表示js放在head中
      }),
```

我们采用自己的html文件作为模板，而不是让HtmlWebpackPlugin自动生成一个!而且可以为特定的[template指定loader](https://github.com/jantimon/html-webpack-plugin/blob/master/docs/template-option.md)

1.hash选项

如果配置为true，那么就会在html的js/css文件后加上compilation hash作为查询字符串，如下:

```js
 <script type="text/javascript" src="vendor.cf4e40c67d1024dc5e3f.js?cf4e40c67d1024dc5e3f"></script><script type="text/javascript" src="app.cf4e40c67d1024dc5e3f.js?cf4e40c67d1024dc5e3f"></script>
```

如果hash为false那么文件如下:

```js
<script type="text/javascript" src="vendor.cf4e40c67d1024dc5e3f.js"></script><script type="text/javascript" src="app.cf4e40c67d1024dc5e3f.js"></script>
```


2.chunksSortMode指定chunk被添加到html之前如何排序

```js
HtmlWebpackPlugin.prototype.sortChunks = function (chunks, sortMode) {
  // Sort mode auto by default:
  if (typeof sortMode === 'undefined') {
    sortMode = 'auto';
  }
  // Custom function
  if (typeof sortMode === 'function') {
    return chunks.sort(sortMode);
  }
  // Disabled sorting:
  //chunkSorter.none方法原样返回chunks集合
  if (sortMode === 'none') {
    return chunkSorter.none(chunks);
  }
  // Check if the given sort mode is a valid chunkSorter sort mode
  //可以是chunkSorter.none,chunkSorter.id,chunkSorter.dependency,chunkSorter.auto
  if (typeof chunkSorter[sortMode] !== 'undefined') {
    return chunkSorter[sortMode](chunks);
  }
  throw new Error('"' + sortMode + '" is not a valid chunk sort mode');
};
```

其中chunkSorter中的内容如下：

```js
'use strict';

var toposort = require('toposort');
var _ = require('lodash');

/*
  Sorts dependencies between chunks by their "parents" attribute.
  This function sorts chunks based on their dependencies with each other.
  The parent relation between chunks as generated by Webpack for each chunk
  is used to define a directed (and hopefully acyclic) graph, which is then
  topologically sorted in order to retrieve the correct order in which
  chunks need to be embedded into HTML. A directed edge in this graph is
  describing a "is parent of" relationship from a chunk to another (distinct)
  chunk. Thus topological sorting orders chunks from bottom-layer chunks to
  highest level chunks that use the lower-level chunks.
  @param {Array} chunks an array of chunks as generated by the html-webpack-plugin.
  It is assumed that each entry contains at least the properties "id"
  (containing the chunk id) and "parents" (array containing the ids of the
  parent chunks).
  @return {Array} A topologically sorted version of the input chunks
*/
module.exports.dependency = function (chunks) {
  //接受的参数chunks表示要排序的chunk集合
  if (!chunks) {
    return chunks;
  }
  // We build a map (chunk-id -> chunk) for faster access during graph building.
  var nodeMap = {};
  chunks.forEach(function (chunk) {
    nodeMap[chunk.id] = chunk;
  });
  // Next, we add an edge for each parent relationship into the graph
  var edges = [];
  chunks.forEach(function (chunk) {
    if (chunk.parents) {
      // Add an edge for each parent (parent -> child)
      chunk.parents.forEach(function (parentId) {
        // webpack2 chunk.parents are chunks instead of string id(s)
        var parentChunk = _.isObject(parentId) ? parentId : nodeMap[parentId];
        // If the parent chunk does not exist (e.g. because of an excluded chunk)
        // we ignore that parent
        if (parentChunk) {
          edges.push([parentChunk, chunk]);
          //从parentChunk指向当前chunk的路径
        }
      });
    }
  });
  // We now perform a topological sorting on the input chunks and built edges
  //toposort.array(nodes, edges)
  return toposort.array(chunks, edges);
};
//升序排列
module.exports.id = function (chunks) {
  return chunks.sort(function orderEntryLast (a, b) {
    if (a.entry !== b.entry) {
      return b.entry ? 1 : -1;
    } else {
      return b.id - a.id;
    }
  });
};
//原样返回
module.exports.none = function (chunks) {
  return chunks;
};
//‘auto’表示id排序
module.exports.auto = module.exports.id;

// In webpack 2 the ids have been flipped.
// Therefore the id sort doesn't work the same way as it did for webpack 1
// Luckily the dependency sort is working as expected
if (require('webpack/package.json').version.split('.')[0] === '2') {
  module.exports.auto = module.exports.dependency;
}
```

很显然，通过dependency排序(拓扑结构)的时候会把该模块依赖的[父级chunk](https://github.com/liangklfangl/commonsChunkPlugin_Config)考虑在其中。这也就是每一个chunk中的webpackJsonp第一个参数的数组剩余id(第一个表示该chunk的chunkid，剩下的为依赖的id):

```js
webpackJsonp([0,1],[
/* 0 */
/***/ function(module, exports, __webpack_require__) {
    __webpack_require__(1);
    __webpack_require__(2);
/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

    __webpack_require__(2);
    var chunk1=1;
    exports.chunk1=chunk1;

/***/ },
/* 2 */
/***/ function(module, exports) {
    var chunk2=1;
    exports.chunk2=chunk2;

/***/ }
]);
```

最后我们通过[toposort](https://github.com/marcelklehr/toposort)对这个拓扑结构进行排序。

3.chunks/excludeChunks/includedChunks让你仅仅添加指定的chunks

首先会得到所有的chunks集合:

```js
    var allChunks = compilation.getStats().toJson().chunks;
    // Filter chunks (options.chunks and options.excludeCHunks)
    var chunks = self.filterChunks(allChunks, self.options.chunks, self.options.excludeChunks);
```

我们在看看filterChunks方法：

```js
//第一个chunks表示编译产生的所有的chunks，第二个includedChunks表示必须包含的chunks，而excludedChunks表示不要添加的chunks
HtmlWebpackPlugin.prototype.filterChunks = function (chunks, includedChunks, excludedChunks) {
  return chunks.filter(function (chunk) {
    var chunkName = chunk.names[0];
    // This chunk doesn't have a name. This script can't handled it.
    if (chunkName === undefined) {
      return false;
    }
    // Skip if the chunk should be lazy loaded
    if (!chunk.initial) {
      return false;
    }
    // Skip if the chunks should be filtered and the given chunk was not added explicity
    //不在includedChunks中的chunk不要添加
    if (Array.isArray(includedChunks) && includedChunks.indexOf(chunkName) === -1) {
      return false;
    }
    // Skip if the chunks should be filtered and the given chunk was excluded explicity
    if (Array.isArray(excludedChunks) && excludedChunks.indexOf(chunkName) !== -1) {
      return false;
    }
    // Add otherwise
    return true;
  });
};
```

这里很容易就理解到了，includedChunks表示必须添加的，excludedChunks表示必须删除的，其他的不在两者之中的都是会添加的！

第三：配置了DedupePlugin


第四：配置了UglifyJsPlugin

