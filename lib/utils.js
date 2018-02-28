'use strict';

var fs = require('fs');
var mkdirp = require('mkdirp');
var cheerio = require('cheerio');
var path = require('path-posix');
var osPathSep = require('path').sep;
var _ = require('lodash');
var fp = require('lodash/fp');

var isPosixOS = osPathSep === '/';

function toPosixPath(filePath) {
  return !isPosixOS ? filePath.split(osPathSep).join('/') : filePath;
}

function stripExtension(filePath) {
  return filePath.replace(/\.[^/.]+$/, '');
}

function makeAssetId(relativePath, stripDirs, idGen) {
  return fp.pipe(function (idGenPath) {
    return stripDirs ? path.basename(idGenPath) : idGenPath;
  }, stripExtension, idGen)(relativePath);
}

function relativePathFor(filePath, inputPath) {
  return filePath.replace('' + inputPath + path.sep, '');
}

function svgDataFor(svgContent) {
  var $svg = cheerio.load(svgContent, { xmlMode: true })('svg');

  return {
    content: $svg.html(),
    attrs: $svg.attr()
  };
}

var readFile = _.partial(fs.readFileSync, _, 'UTF-8');

var saveToFile = _.curry(function (filePath, data) {
  mkdirp.sync(path.dirname(filePath));
  fs.writeFileSync(filePath, data);
});

module.exports = {
  makeAssetId: makeAssetId,
  relativePathFor: relativePathFor,
  svgDataFor: svgDataFor,
  readFile: readFile,
  saveToFile: saveToFile,
  toPosixPath: toPosixPath
};