const path = require('path');

module.exports = {
     entry: path.join(__dirname, './src/main.js'),
     output: {
         path: path.join(__dirname, './site/lib'),
         filename: 'main.bundle.js'
     },
     module: {
       loaders: [{
         exclude: /node_modules/,
         loader: 'babel-loader',
       }]
     },
};
