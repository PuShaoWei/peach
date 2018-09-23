/**
* @fileoverview server模式专用，代码压缩
* @author  liweitao
*/

'use strict';

module.exports = function ($, appConf, moduleConf, args) {
  return function (mod, modulePath, appPath) {
    return new Promise(function (resolve, reject) {
      var vfs = require('vinyl-fs');
      var path = require('path');
      var es = require('event-stream');
      var _ = require('lodash');

      var peachMate = require('../peach_mate');
      var Util = require('../../util');

      $.util.log($.util.colors.green('开始' + mod + '模块任务压缩文件！'));

      var platform = appConf.platform ? appConf.platform : 'mobile';
      var autoprefixerConf = moduleConf.support.autoprefixer;
      var browsers = [];
      if (autoprefixerConf) {
        browsers = autoprefixerConf[platform];
      } else {
        browsers = ['> 1%', 'last 2 versions', 'Firefox ESR', 'Opera 12.1'];
      }

      var compressConf = moduleConf.support.compress;
      var cssCompressConf = compressConf ? compressConf.css : {};

      var defaultCssCompressConf = {
        autoprefixer: { browsers: browsers, add: true },
        safe: true,
        mergeRules: false,
        mergeIdents: false,
        reduceIdents: false,
        discardUnused: false,
        minifySelectors: false,
        reduceTransforms: false,
        onComplete: function (savedInfo) {
          Util.generateStatistics(modulePath, 'optimize.css', savedInfo);
        }
      };
      cssCompressConf = _.assign(defaultCssCompressConf, cssCompressConf);
      var compressCss = vfs.src([path.join(modulePath, 'dist', '_static', '**', '*.css'), path.join('!' + modulePath, 'dist', '_static', '**', '*.min.css')])
        .pipe(peachMate.cssnano(cssCompressConf))
        .pipe($.rename(function (path) {
          path.basename += '.min';
        }))
        .pipe(vfs.dest(path.join(modulePath, 'dist', '_static')));

      var jsCompressConf = compressConf ? compressConf.js : {};
      var defaultJsCompressConf = {
        onComplete: function (savedInfo) {
          Util.generateStatistics(modulePath, 'optimize.js', savedInfo);
        }
      };
      jsCompressConf = _.assign(defaultJsCompressConf, jsCompressConf);
      var compressJs = vfs.src([path.join(modulePath, 'dist', '_static', '**', '*.js'), path.join('!' + modulePath, 'dist', '_static', '**', '*.min.js')])
        .pipe(peachMate.uglify(jsCompressConf).on('error', $.util.log))
        .pipe($.rename(function (path) {
          path.basename += '.min';
        }))
        .pipe(vfs.dest(path.join(modulePath, 'dist', '_static')));

      es.merge(compressCss, compressJs).on('end', function () {
        $.util.log($.util.colors.green('结束' + mod + '模块任务压缩文件！'));
        resolve();
      }).on('error', function (err) {
        $.util.log($.util.colors.red(mod + '模块任务压缩文件失败！'));
        reject(err);
      });
    });
  };
};
