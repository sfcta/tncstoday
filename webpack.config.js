const path = require('path');

module.exports = {
     entry: path.join(__dirname, './src/main.js'),
     output: {
         path: path.join(__dirname, './docs/lib'),
         filename: 'main.bundle.js'
     },
     module: {
       rules: [{
         exclude: /node_modules/,
         loader: 'babel-loader',
       }]
     },
};
