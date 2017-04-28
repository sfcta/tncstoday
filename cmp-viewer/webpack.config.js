//to be removed upon webpack fix
const path = require('path');
const pathHack = (_path) => {
    return _path.charAt(0).toUpperCase() + _path.slice(1).toLowerCase();
};

module.exports = {
     entry: pathHack(path.join(__dirname, "./src/dora.js")),
     output: {
         path: pathHack(path.join(__dirname, './lib')),
         filename: 'dora.bundle.js'
     },
     module: {
       loaders: [{
         exclude: /node_modules/,
         loader: 'babel-loader',
       }]
     }
};
 