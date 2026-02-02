const path = require('path');

module.exports = {
  mode: 'development',
  entry: './ui/flow-editor.jsx',
  output: {
    path: path.resolve(__dirname, 'ui'),
    filename: 'flow-editor-bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  externals: {
    'electron': 'commonjs electron'
  }
};
