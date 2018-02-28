'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
  Concatenates SVG files into a single JSON file.
  It's only used to generate input files for the ViewerBuilder.

  Required options:
    idGen
    idGenOpts
    copypastaGen
    stripPath
    strategy
    hasOptimizer
    outputFile

  Optional options:
    ui
    annotation

  Examples of input and output:

  Input node:
  ├── __optimized__
  │   ├── alarm.svg
  │   └── ...
  ├── alarm.svg
  └── ...

  Output node:
  └── outputFile.json

  outputFile.json can content:
  [
    {
      "svg": {
        "content": "<path />",
        "attrs": {
          "width": "20",
          "height": "20",
          "viewBox": "0 0 20 20"
        }
      },
      "originalSvg": "<svg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><path /></svg>",
      "width": 20,
      "height": 20,
      "fileName": "alarm.svg",
      "fileDir": "/",
      "fileSize": "1.16 KB",
      "optimizedFileSize": "0.62 KB",
      "baseSize": "20px",
      "fullBaseSize": "20x20px",
      "copypasta": "{{svg-jar \"alarm\"}}",
      "strategy": "inline"
    },

    { ... }
  ]
*/
var path = require('path-posix');
var _ = require('lodash');
var fp = require('lodash/fp');
var CachingWriter = require('broccoli-caching-writer');
var validateAssets = require('./validate-assets');

var _require = require('./utils'),
    relativePathFor = _require.relativePathFor,
    makeAssetId = _require.makeAssetId,
    svgDataFor = _require.svgDataFor,
    readFile = _require.readFile,
    saveToFile = _require.saveToFile,
    toPosixPath = _require.toPosixPath;

function svgSizeFor(svgAttrs) {
  var _split = (svgAttrs.viewBox || '').split(/\s+/),
      _split2 = _slicedToArray(_split, 4),
      vbWidth = _split2[2],
      vgHeight = _split2[3];

  return {
    width: parseFloat(svgAttrs.width || vbWidth) || null,
    height: parseFloat(svgAttrs.height || vgHeight) || null
  };
}

function stringSizeInKb(string) {
  var bytes = Buffer.byteLength(string, 'utf8');
  return parseFloat((bytes / 1024).toFixed(2));
}

var addOptimizedSvg = _.curry(function (hasOptimizer, toOptimizedPath, pathAndSvgPair) {
  // eslint-disable-next-line comma-spacing
  var _pathAndSvgPair = _slicedToArray(pathAndSvgPair, 1),
      relativePath = _pathAndSvgPair[0];

  var optimizedPath = toOptimizedPath(relativePath);

  return hasOptimizer ? pathAndSvgPair.concat(readFile(optimizedPath)) : pathAndSvgPair;
});

var svgToAsset = _.curry(function (relativeToId, _ref) {
  var _ref2 = _slicedToArray(_ref, 3),
      relativePath = _ref2[0],
      originalSvg = _ref2[1],
      optimizedSvg = _ref2[2];

  return {
    id: relativeToId(relativePath),
    svgData: svgDataFor(optimizedSvg || originalSvg),
    originalSvg: originalSvg,
    optimizedSvg: optimizedSvg,
    relativePath: relativePath
  };
});

var assetToViewerItem = _.curry(function (copypastaGen, strategy, asset) {
  var _svgSizeFor = svgSizeFor(asset.svgData.attrs),
      width = _svgSizeFor.width,
      height = _svgSizeFor.height;

  var fileSize = stringSizeInKb(asset.originalSvg) + ' KB';
  var optimizedSvg = asset.optimizedSvg;
  var optimizedFileSize = optimizedSvg ? stringSizeInKb(optimizedSvg) + ' KB' : fileSize;

  return {
    svg: asset.svgData,
    originalSvg: asset.originalSvg,
    width: width,
    height: height,
    fileName: path.basename(asset.relativePath),
    fileDir: path.dirname(asset.relativePath).replace('.', '/'),
    fileSize: fileSize,
    optimizedFileSize: optimizedFileSize,
    baseSize: _.isNull(height) ? 'unknown' : height + 'px',
    fullBaseSize: width + 'x' + height + 'px',
    copypasta: copypastaGen(asset.id),
    strategy: strategy
  };
});

var ViewerAssetsBuilder = function (_CachingWriter) {
  _inherits(ViewerAssetsBuilder, _CachingWriter);

  function ViewerAssetsBuilder(inputNode) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, ViewerAssetsBuilder);

    var _this = _possibleConstructorReturn(this, (ViewerAssetsBuilder.__proto__ || Object.getPrototypeOf(ViewerAssetsBuilder)).call(this, [inputNode], {
      name: 'ViewerAssetsBuilder',
      annotation: options.annotation
    }));

    _this.options = options;
    return _this;
  }

  _createClass(ViewerAssetsBuilder, [{
    key: 'build',
    value: function build() {
      var _options = this.options,
          idGen = _options.idGen,
          idGenOpts = _options.idGenOpts,
          copypastaGen = _options.copypastaGen,
          stripPath = _options.stripPath,
          strategy = _options.strategy,
          hasOptimizer = _options.hasOptimizer,
          outputFile = _options.outputFile,
          ui = _options.ui;

      var inputPath = toPosixPath(this.inputPaths[0]);
      var outputPath = toPosixPath(this.outputPath);
      var filePaths = this.listFiles().map(toPosixPath);

      var outputFilePath = path.join(outputPath, outputFile);
      var optimizedPath = path.join(inputPath, '__optimized__');

      var isOptimizedPath = function isOptimizedPath(filePath) {
        return filePath.indexOf(optimizedPath) !== -1;
      };
      var toOptimizedPath = _.partial(path.join, optimizedPath);
      var toRelative = _.partial(relativePathFor, _, inputPath);
      var idGenWithOpts = _.partial(idGen, _, idGenOpts);
      var relativeToId = _.partial(makeAssetId, _, stripPath, idGenWithOpts);

      /**
        The flow:
        [anySvgPath]
        [originalOnlySvgPath]
        [ [relativePath, originalSvg] ]
        [ [relativePath, originalSvg, maybeOptimizedSvg] ]
        [assetObj]
        [viewerItem]
        jsonString
      */
      fp.pipe(fp.reject(isOptimizedPath), fp.map(function (filePath) {
        return [toRelative(filePath), readFile(filePath)];
      }), fp.filter(function (_ref3) {
        var _ref4 = _slicedToArray(_ref3, 2),
            originalSvg = _ref4[1];

        return !!originalSvg;
      }), fp.map(addOptimizedSvg(hasOptimizer, toOptimizedPath)), fp.map(svgToAsset(relativeToId)), fp.tap(function (assets) {
        return ui && validateAssets(assets, strategy, ui);
      }), fp.map(assetToViewerItem(copypastaGen, strategy)), JSON.stringify, saveToFile(outputFilePath))(filePaths);
    }
  }]);

  return ViewerAssetsBuilder;
}(CachingWriter);

module.exports = ViewerAssetsBuilder;