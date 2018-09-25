/**
* @fileoverview 脚本文件处理
* @author  liweitao
*/

'use strict';

module.exports = function ($, appConf, moduleConf, args) {
  return function (mod, modulePath, appPath) {
    return new Promise(function (resolve, reject) {
      var path = require('path');
      var vfs = require('vinyl-fs');
      var through2 = require('through2');

      var Util = require('../../util');
      var peachMate = require('../athena_mate')
      var useBabel = moduleConf.support.useBabel || { enable: false }
      var enableBabel = useBabel.enable;
      var jsxPragma = useBabel.jsxPragma || 'Nerv.createElement'
      var useBrowserify = moduleConf.support.useBrowserify || { enable:false }

      $.util.log($.util.colors.green('开始' + mod + '模块任务scripts！'));
      vfs.src([path.join(modulePath, 'dist', '_static', 'js', '**', '*.js'), path.join('!' + modulePath, 'dist', '_static', 'js', '**', '*.min.js')])
        .pipe($.if(enableBabel, peachMate.babel({
          config: {
            presets: [
              require('babel-preset-es2015'),
              require('babel-preset-stage-0')
            ],
            plugins: [
              require('babel-plugin-transform-es3-member-expression-literals'),
              require('babel-plugin-transform-es3-property-literals'),
              [require('babel-plugin-transform-react-jsx'), {
                pragma: jsxPragma
              }]
            ]
          },
          fileTest: useBabel.test || /\.js/,
          exclude: useBabel.exclude || []
        })))
        .pipe($.if(useBrowserify, peachMate.browserify({
          config: {
          },
          contentTest: useBrowserify.ContentTest || /require/,
          fileTest: useBrowserify.test || /\.js/,
          exclude: useBrowserify.exclude || []
        })))
        .pipe(vfs.dest(path.join(modulePath, 'dist', '_static', 'js')))
        .on('end', function () {
          $.util.log($.util.colors.green('结束' + mod + '模块任务scripts！'));
          resolve();
        })
        .on('error', function (err) {
          $.util.log($.util.colors.red(mod + '模块任务scripts失败！'));
          reject(err);
        });
    });
  };
};
