/**
* @fileoverview client模式，项目发布
* @author  liweitao
*/

'use strict';

module.exports = function ($, appConf, moduleConf, args) {
  return function (mod, modulePath, appPath, remoteName) {
    return new Promise(function (resolve, reject) {
      var vfs = require('vinyl-fs');
      var fs = require('fs');
      var inquirer = require('inquirer');
      var _ = require('lodash');
      var path = require('path');
      var through2 = require('through2');
      var peachMate = require('../athena_mate');
      var Util = require('../../util');
      var es = require('event-stream');

      var noImage = args ? args.noImage : false;
      var isAll = args ? args.all : false;
      var isShowAll = args ? args.showall : false;
      var isAllRes = args ? args['allres'] : false;
      var argsRemotePath = (args && args.remotePath) ? args.remotePath : false;
      var argsCssi = (args && args.cssi) ? args.cssi : false;

      var mapJson = JSON.parse(String(fs.readFileSync(path.join(modulePath, 'dist', 'map.json'))));
      var dependency = mapJson.dependency
      var pagesInclude = mapJson.include;
      if (_.isEmpty(dependency) && _.isEmpty(pagesInclude)) {
        $.util.log($.util.colors.red('模块为空，没有文件需要发布！'))
        return;
      }
      var outputPath = path.join(modulePath, 'dist', 'output')
      var readOutput = fs.readdirSync(outputPath);
      var pages = [];
      var otherMapJsons = {};
      otherMapJsons[appConf.common] = JSON.parse(String(fs.readFileSync(path.join(appPath, appConf.common, 'dist', 'map.json'))));

      var allPages = [];
      var publishFoldersInfo = {};

      function generatePublishFiles (moduleName, file, deployOptions, publishFiles) {
        var name = path.basename(file.path);
        var ext = path.extname(name);
        var p = Util.getStaticPath(file.path).path.replace(/\\/ig,'/');
        var publishP = deployOptions.assestPrefix + '/' + moduleName + '/' + p;
        if (Util.regexps.js.test(ext)
          || Util.regexps.css.test(ext)
          || Util.regexps.media.test(ext)
          && publishFiles.indexOf(publishP) < 0) {
          publishFiles.push(publishP);
        }
      }

      if (typeof remoteName === 'string') {
        $.util.log($.util.colors.green('即将发布到远程机器' + remoteName));
      } else {
        return reject();
      }

      readOutput.forEach(function (item) {
        if (Util.regexps.tpl.test(path.extname(item))) {
          pages.push({
            name: item,
            value: item
          });
          allPages.push(item);
        }
      });
      if (pages.length > 1) {
        pages.unshift({
          name: '全部',
          value: allPages
        });
      }
      if (isAll) {
        publish(allPages);
      } else {
        if (pages.length > 0) {
          var prompt = [];
          prompt.push({
            type: 'checkbox',
            name: 'pages',
            message: '请选择将要发布的页面',
            required: true,
            store: true,
            choices: pages,
            validate: function (input) {
              if (input.length === 0) {
                return '一定要选择一个页面哦~';
              }
              return true;
            }.bind(this)
          });
          inquirer.prompt(prompt, function (answers) {
            publish(answers.pages);
          });
        } else {
          console.log($.util.colors.red('没有要上传的页面！'));
          resolve();
        }
      }

      function mergeArrayConcatCustomizer(objValue, srcValue) {
        if (_.isArray(objValue)) {
          return objValue.concat(srcValue);
        }
      }

      function getPublishImageFiles (imagesInclude) {
        var filesInfo = {};
        var base = '';
        if (!imagesInclude) {
          return filesInfo;
        }
        for (var i = 0; i < imagesInclude.length; i++) {
          var imageName = imagesInclude[i].res;
          var imageModuleName = imagesInclude[i].module;
          var imageHashName = null;
          if (imageModuleName === moduleConf.module) {
            imageHashName = Util.getHashName(imageName, mapJson);
            base = path.join(modulePath, 'dist', 'output');
          } else {
            base = path.join(appPath, imageModuleName, 'dist', 'output');
            if (!otherMapJsons[imageModuleName]) {
              var otherMapJsonPath = path.join(appPath, imageModuleName, 'dist', 'map.json');
              if (!Util.existsSync(otherMapJsonPath)) {
                $.util.log($.util.colors.red('模块' + imageModuleName + '不存在！'));
              }
              otherMapJsons[imageModuleName] = JSON.parse(String(fs.readFileSync(otherMapJsonPath)));
            }
            imageHashName = Util.getHashName(imageName, otherMapJsons[imageModuleName]);
          }
          if (!filesInfo[base]) {
            filesInfo[base] = [];
          }
          filesInfo[base].push(path.join(base, imageName));
          filesInfo[base].push(path.join(base, imageHashName));
        }
        return filesInfo;
      }

      function getPublishStaticFiles (staticInclude, type) {
        var filesInfo = {};
        var base = '';
        if (!staticInclude) {
          return filesInfo;
        }
        for (var i = 0; i < staticInclude.length; i++) {
          var staticName = staticInclude[i].name;
          var staticHashName = null;
          var staticModuleName = staticInclude[i].module;
          if (staticModuleName === moduleConf.module) {
            staticHashName = Util.getHashName(type + '/' + staticName, mapJson);
            base = path.join(modulePath, 'dist', 'output');
          } else {
            base = path.join(appPath, staticModuleName, 'dist', 'output');
            if (!otherMapJsons[staticModuleName]) {
              var otherMapJsonPath = path.join(appPath, staticModuleName, 'dist', 'map.json');
              if (!Util.existsSync(otherMapJsonPath)) {
                $.util.log($.util.colors.red('模块' + staticModuleName + '不存在！'));
              }
              otherMapJsons[staticModuleName] = JSON.parse(String(fs.readFileSync(otherMapJsonPath)));
            }
            staticHashName = Util.getHashName(type + '/' + staticName, otherMapJsons[staticModuleName]);
          }
          if (!filesInfo[base]) {
            filesInfo[base] = [];
          }
          filesInfo[base].push(path.join(base, type, staticName));
          filesInfo[base].push(path.join(base, staticHashName));
          if (type === 'css') {
            var originFailoverFile = path.join(base, type, 'failover_' + staticName)
            if (fs.existsSync(originFailoverFile)) {
              filesInfo[base].push(originFailoverFile)
            }
            var hashedFailoverFile = path.join(base, path.dirname(staticHashName) + '/failover_' + path.basename(staticHashName))
            if (fs.existsSync(originFailoverFile)) {
              filesInfo[base].push(hashedFailoverFile)
            }
          }
          var imagesInfo = getPublishImageFiles(staticInclude[i].images);
          filesInfo = _.mergeWith(filesInfo, imagesInfo, mergeArrayConcatCustomizer);
        }
        return filesInfo;
      }

      function publish (pPages) {
        var deploy = appConf.deploy;
        var deployOptions = deploy[remoteName];
        var shtml = _.assign(_.clone(appConf.shtml), deployOptions.shtml || { });
        var shtmlConf = (shtml && !_.isEmpty(shtml)) ? shtml : {
          use: false,
          needCombo: false,
          needTimestamp: false
        };
        var useShtml = shtmlConf ? shtmlConf.use : false;
        var gulpSSH = new peachMate.ssh({
          sshConfig: {
            host: deployOptions.host,
            port: deployOptions.port,
            username: deployOptions.user,
            password: deployOptions.pass
          }
        });
        var deployParams = {
          mode: deployOptions.mode,
          host: deployOptions.host,
          user: deployOptions.user,
          pass: deployOptions.pass,
          port: deployOptions.port
        };
        var deployRemoteParams = _.assign(_.clone(deployParams), {
          remotePath: (argsRemotePath || deployOptions.remotePath) + '/' + moduleConf.module
        });
        var deployCssiParams = _.assign(_.clone(deployParams), {
          remotePath: (argsCssi || deployOptions.cssi) + '/' + moduleConf.module
        });
        var globPages = [];
        var htmlPathList = [];
        var combofileSHtmlList = [];
        var publishFiles = [];

        // 索引页，即站点地图
        var summaryPage = path.join(appPath, '.temp', appConf.app, 'index.html');

        if (pPages) {
          var filterPages = [];
          pPages.forEach(function (item) {
            if (_.isArray(item)) {
              item.forEach(function (i) {
                if (filterPages.indexOf(i) < 0) {
                  filterPages.push(i);
                }
              });
            } else {
              if (filterPages.indexOf(item) < 0) {
                filterPages.push(item);
              }
            }
          });
          var dpath = path.join(modulePath, 'dist', 'output');
          var cpath = path.join(dpath, 'combofile');
          var imagesPath = path.join(dpath, 'images');
          filterPages.forEach(function (item) {
            var name = path.basename(item, path.extname(item));
            var htmlPath = path.join(dpath, item);
            // 获取页面所引用的资源
            var pageInclude = pagesInclude[item];

            htmlPathList.push(htmlPath);
            if (!pageInclude) {
              $.util.log('页面' + $.util.colors.red(item) + '无引用资源，太奇怪了~');
            } else {
              if (isAllRes) {
                var base = path.join(modulePath, 'dist', 'output');
                publishFoldersInfo = {};
                publishFoldersInfo[base] = [
                  path.join(base, '**')
                ];
              } else {
                publishFoldersInfo = _.mergeWith(publishFoldersInfo, getPublishStaticFiles(pageInclude.css, 'css'), getPublishStaticFiles(pageInclude.js, 'js'), getPublishImageFiles(pageInclude.images), mergeArrayConcatCustomizer);
              }
            }
            if (useShtml) {
              var combofileShtmlPath = path.join(cpath, name + '.shtml');
              var allinonefileShtmlPath = path.join(cpath, "allinone_"+name + '.shtml');
              var combofileJSShtmlPath = path.join(cpath, name + '_js.shtml');
              var combofilePreloadCSSShtmlPath = path.join(cpath, name + '_preload_css.shtml')
              if (Util.existsSync(allinonefileShtmlPath)) {
                combofileSHtmlList.push(allinonefileShtmlPath)
                publishFiles.push(deployOptions.shtmlPrefix + '/' + moduleConf.module + '/allinone_' + name + '.shtml')
              }
              if (Util.existsSync(combofileShtmlPath)) {
                combofileSHtmlList.push(combofileShtmlPath)
                publishFiles.push(deployOptions.shtmlPrefix + '/' + moduleConf.module + '/' + name + '.shtml')
              }
              if (Util.existsSync(combofileJSShtmlPath)) {
                combofileSHtmlList.push(combofileJSShtmlPath)
                publishFiles.push(deployOptions.shtmlPrefix + '/' + moduleConf.module + '/' + name + '_js.shtml')
              }
              if (Util.existsSync(combofilePreloadCSSShtmlPath)) {
                combofileSHtmlList.push(combofilePreloadCSSShtmlPath)
                publishFiles.push(deployOptions.shtmlPrefix + '/' + moduleConf.module + '/' + name + '_preload_css.shtml')
              }
            }
          });
          var streamArr = [];
          // 使用http进行上传
          if (deployParams.mode === 'http') {
            for (var key in publishFoldersInfo) {
              var htmlFiles = [];
              var moduleName = key.replace(appPath + path.sep, '').split(path.sep)[0];
              deployRemoteParams.remotePath = (argsRemotePath || deployOptions.remotePath) + '/' + moduleName
              htmlPathList.forEach(function (item) {
                if (item.indexOf(key) >= 0) {
                  htmlFiles.push(item);
                }
              });
              streamArr.push(
                vfs.src(publishFoldersInfo[key].concat(htmlFiles), { base: key })
                  .pipe($.if(isShowAll ? true : false, through2.obj((function (moduleName) {
                    return function (file, encoding, cb) {
                      if (file.isDirectory()) {
                        return cb();
                      }
                      generatePublishFiles(moduleName, file, deployOptions, publishFiles);
                      this.push(file);
                      cb();
                    };
                  }(moduleName)))))
                  .pipe(peachMate.publishFilter({
                    cwd: appPath,
                    app: appConf.app,
                    module: moduleConf.module,
                    remote: remoteName
                  }))
                  .pipe(through2.obj((function (moduleName) {
                    return function (file, encoding, cb) {
                      if (file.isDirectory()) {
                        return cb();
                      }
                      generatePublishFiles(moduleName, file, deployOptions, publishFiles);
                      this.push(file);
                      cb();
                    };
                  }(moduleName))))
                  .pipe(peachMate.jdcFinder({
                    erpid: deployRemoteParams.user,
                    jfsToken: deployRemoteParams.pass,
                    remotePath: deployRemoteParams.remotePath
                  }))
                  .pipe($.util.noop())
                  .on('data', function () {})
              );
            }
            es.merge(streamArr)
              .on('end', function () {
                vfs.src(combofileSHtmlList)
                  .pipe($.if(useShtml, peachMate.jdcFinder({
                    erpid: deployCssiParams.user,
                    jfsToken: deployCssiParams.pass,
                    remotePath: deployCssiParams.remotePath
                  })))
                  .pipe($.util.noop())
                  .on('data', function () {})
                  .on('end', function () {
                    vfs.src(summaryPage, { base: path.join(appPath, '.temp', appConf.app) })
                      .pipe(peachMate.jdcFinder({
                        erpid: deployRemoteParams.user,
                        jfsToken: deployRemoteParams.pass,
                        remotePath: (argsRemotePath || deployOptions.remotePath)
                      }))
                      .pipe($.util.noop())
                      .on('data', function () {})
                      .on('end', function () {
                        $.util.log($.util.colors.green('你可能需要发布上线这些文件：'));
                        publishFiles.forEach(function (item) {
                          console.log('    ' + $.util.colors.bgCyan(item));
                        });
                        console.log();
                        console.log('    ' + $.util.colors.green('访问地址：' + 'http://' + deployOptions.domain + deployOptions.fdPath + appConf.app));
                        console.log();
                        resolve(publishFiles);
                      });
                  });
              });
            return;
          }

          // 端口为21认为是普通上传
          if (parseInt(deployRemoteParams.port, 10) === 21) {
            for (var key in publishFoldersInfo) {
              var htmlFiles = [];
              var moduleName = key.replace(appPath + path.sep, '').split(path.sep)[0];
              deployRemoteParams.remotePath = (argsRemotePath || deployOptions.remotePath) + '/' + moduleName
              htmlPathList.forEach(function (item) {
                if (item.indexOf(key) >= 0) {
                  htmlFiles.push(item);
                }
              });
              streamArr.push(
                vfs.src(publishFoldersInfo[key].concat(htmlFiles), { base: key })
                  .pipe($.if(isShowAll ? true : false, through2.obj((function (moduleName) {
                    return function (file, encoding, cb) {
                      if (file.isDirectory()) {
                        return cb();
                      }
                      generatePublishFiles(moduleName, file, deployOptions, publishFiles);
                      this.push(file);
                      cb();
                    };
                  }(moduleName)))))
                  .pipe(peachMate.publishFilter({
                    cwd: appPath,
                    app: appConf.app,
                    module: moduleName,
                    remote: remoteName
                  }))
                  .pipe(through2.obj((function (moduleName) {
                    return function (file, encoding, cb) {
                      if (file.isDirectory()) {
                        return cb();
                      }
                      generatePublishFiles(moduleName, file, deployOptions, publishFiles);
                      this.push(file);
                      cb();
                    };
                  }(moduleName))))
                  .pipe(peachMate.ftp(deployRemoteParams))
                  .on('data', function () {})
                  .pipe($.util.noop())
              );
            }
            es.merge(streamArr)
              .on('finish', function () {
                vfs.src(combofileSHtmlList)
                  .pipe($.if(useShtml, peachMate.ftp(deployCssiParams)))
                  .on('data', function () {})
                  .pipe($.util.noop())
                  .on('finish', function () {
                    vfs.src(summaryPage, { base: path.join(appPath, '.temp', appConf.app) })
                      .pipe(peachMate.ftp(_.assign(_.clone(deployParams), {
                        remotePath: (argsRemotePath || deployOptions.remotePath)
                      })))
                      .on('data', function () {})
                      .pipe($.util.noop())
                      .on('finish', function () {
                        if (remoteName !== 'preview') {
                          $.util.log($.util.colors.green('你可能需要发布上线这些文件：'));
                          publishFiles.forEach(function (item) {
                            console.log('    ' + $.util.colors.bgCyan(item));
                          });
                          console.log();
                        }
                        console.log('    ' + $.util.colors.green('访问地址：' + 'http://' + deployOptions.domain + deployOptions.fdPath + appConf.app));
                        console.log();
                        resolve(publishFiles);
                      });
                  });
              });
          } else {
            for (var key in publishFoldersInfo) {
              var htmlFiles = [];
              var moduleName = key.replace(appPath + path.sep, '').split(path.sep)[0];
              deployRemoteParams.remotePath = (argsRemotePath || deployOptions.remotePath) + '/' + moduleName
              htmlPathList.forEach(function (item) {
                if (item.indexOf(key) >= 0) {
                  htmlFiles.push(item);
                }
              });
              streamArr.push(
                vfs.src(publishFoldersInfo[key].concat(htmlFiles), { base: key })
                  .pipe($.if(isShowAll ? true : false, through2.obj((function (moduleName) {
                    return function (file, encoding, cb) {
                      if (file.isDirectory()) {
                        return cb();
                      }
                      generatePublishFiles(moduleName, file, deployOptions, publishFiles);
                      this.push(file);
                      cb();
                    };
                  }(moduleName)))))
                  .pipe(peachMate.publishFilter({
                    cwd: appPath,
                    app: appConf.app,
                    module: moduleName,
                    remote: remoteName
                  }))
                  .pipe(through2.obj((function (moduleName) {
                    return function (file, encoding, cb) {
                      if (file.isDirectory()) {
                        return cb();
                      }
                      generatePublishFiles(moduleName, file, deployOptions, publishFiles);
                      this.push(file);
                      cb();
                    };
                  }(moduleName))))
                  .pipe(gulpSSH.dest(deployRemoteParams.remotePath))
                  .pipe($.util.noop())
                  .on('data', function () {})
              );
            }
            es.merge(streamArr)
              .on('end', function () {
                vfs.src(combofileSHtmlList)
                  .pipe($.if(useShtml, gulpSSH.dest(deployCssiParams.remotePath)))
                  .on('finish', function () {
                    vfs.src(summaryPage, { base: path.join(appPath, '.temp', appConf.app) })
                      .pipe(gulpSSH.dest((argsRemotePath || deployOptions.remotePath)))
                      .on('finish', function () {
                        if (gulpSSH) {
                          gulpSSH.close();
                        }
                        if (remoteName !== 'preview') {
                          $.util.log($.util.colors.green('你可能需要发布上线这些文件：'));
                          publishFiles.forEach(function (item) {
                            console.log('    ' + $.util.colors.bgCyan(item));
                          });
                          console.log();
                        }
                        console.log('    ' + $.util.colors.green('访问地址：' + 'http://' + deployOptions.domain + deployOptions.fdPath + appConf.app));
                        console.log();
                        resolve(publishFiles);
                      });
                  });
              });
          }
        } else {
          console.log($.util.colors.red('没有要上传的文件！'));
          resolve();
        }
      }
    });
  };
};
