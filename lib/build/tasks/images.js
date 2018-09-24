/**
* @fileoverview 图片压缩
* @author  liweitao
*/

'use strict';

module.exports = function ($, appConf, moduleConf, args) {
  return function (mod, modulePath, appPath) {
    return new Promise(function (resolve, reject) {
      var fs = require('fs');
      var path = require( 'path' );
      var vfs = require('vinyl-fs');
      var Util = require( '../../util' );
      var peachMate = require('../athena_mate');

      var noImage = (args && args.noImage) ? args.noImage : false;
      var imageminSupport = moduleConf.support.imagemin;
      var compressConf = moduleConf.support.compress;
      var imageCompressSupport = compressConf ? compressConf.img : {}
      imageCompressSupport = imageCompressSupport || {}
      var imageminExclude = imageminSupport ? imageminSupport.exclude : [];
      var cacheRootPath = path.join(appPath, Util.CACHE)
      var imagesCache = path.join(cacheRootPath, 'images', moduleConf.module);
      var imagesCacheFolder = path.join(imagesCache, 'images');
      var imagesCachePath = path.join(imagesCache, 'cache.json');
      var imagesCacheJson = {};
      try {
        imagesCacheJson = JSON.parse(fs.readFileSync(imagesCachePath));
      } catch (e) {
        imagesCacheJson = {};
      }
      $.util.log($.util.colors.green('开始' + mod + '模块任务images！'));

      vfs.src(path.join(modulePath, 'dist', '_static', 'images', '**'))
        .pipe(peachMate.buildFilter({
          cwd: appPath,
          app: appConf.app,
          module: moduleConf.module,
          cacheFolder: 'images',
          checkCb: function (item) {
            var staticPath = Util.getStaticPath(item.path).path;
            var cachePath = path.join(cacheRootPath, 'images', moduleConf.module, staticPath);
            if (!Util.existsSync(cachePath)) {
              return true;
            }
            if (imagesCacheJson[item.path] !== Util.checksum(item.contents, 16)) {
              return true;
            }
            vfs.src(cachePath, {base: imagesCacheFolder})
              .pipe(vfs.dest(path.join(modulePath, 'dist', '_static', 'images')))
              .on('finish', function () {
                return false;
              });
          }
        }))
        .pipe($.if(!noImage, peachMate.imagemin({
          cwd: appPath,
          app: appConf.app,
          module: moduleConf.module,
          cacheFolder: 'images',
          extensions: imageCompressSupport.extensions || ['png', 'jpg', 'jpeg', 'gif'],
          png: imageCompressSupport.png || { quantity: '60-80' },
          jpg: imageCompressSupport.jpg || { quantity: '80' },
          gif: imageCompressSupport.jpg || { },
          exclude: imageminExclude,
          onComplete: function (savedInfo) {
            Util.generateStatistics(modulePath, 'optimize.img', savedInfo);
          }
        })))
        .pipe(vfs.dest(path.join(modulePath, 'dist', '_static', 'images')))
        .pipe(vfs.dest(imagesCacheFolder))
        .on('finish', function () {
          $.util.log($.util.colors.green('结束' + mod + '模块任务images！'));
          resolve();
        })
        .on('error', function (err) {
          $.util.log($.util.colors.red(mod + '模块任务images失败！'));
          reject(err);
        });
    });
  };
};
