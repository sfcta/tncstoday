const path = require('path');
var webpack = require('webpack');

module.exports = {
     entry: path.join(__dirname, './src/main.js'),
     output: {
         path: path.join(__dirname, './lib'),
         filename: 'main.bundle.js'
     },
     module: {
       loaders: [{
         exclude: /node_modules/,
         loader: 'babel-loader',
       }]
     },
     plugins: [
       new webpack.DefinePlugin({
          'process.env': {
              NODE_ENV: 'production'
          }
       })
    ]
};
 
