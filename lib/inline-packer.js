'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
  Packages SVGs as ES modules for use with the inline strategy.

  Required options:
    idGen
    stripPath

  Optional options:
    annotation

  Examples of input and output:

  Input node:
  ├── alarm.svg
  └── cat.svg

  Output node:
  └── output.js

  output.js can content:
  export default {
    'alarm': { content: '<path>', attrs: { viewBox: '' } },
    'cat': { content: '<path>', attrs: { viewBox: '' } }
  }
*/
var path = require('path-posix');
var _ = require('lodash');
var fp = require('lodash/fp');
var CachingWriter = require('broccoli-caching-writer');

var _require = require('./utils'),
    relativePathFor = _require.relativePathFor,
    makeAssetId = _require.makeAssetId,
    svgDataFor = _require.svgDataFor,
    readFile = _require.readFile,
    saveToFile = _require.saveToFile,
    toPosixPath = _require.toPosixPath;

var extractSvgData = fp.pipe(readFile, svgDataFor);

var InlinePacker = function (_CachingWriter) {
  _inherits(InlinePacker, _CachingWriter);

  function InlinePacker(inputNode) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, InlinePacker);

    var _this = _possibleConstructorReturn(this, (InlinePacker.__proto__ || Object.getPrototypeOf(InlinePacker)).call(this, [inputNode], {
      name: 'InlinePacker',
      annotation: options.annotation
    }));

    _this.options = options;
    return _this;
  }

  _createClass(InlinePacker, [{
    key: 'build',
    value: function build() {
      var inputPath = toPosixPath(this.inputPaths[0]);
      var outputPath = toPosixPath(this.outputPath);
      var filePaths = this.listFiles().map(toPosixPath);

      var _options = this.options,
          stripPath = _options.stripPath,
          idGen = _options.idGen;


      var toRelativePath = _.partial(relativePathFor, _, inputPath);
      var relativePathToId = _.partial(makeAssetId, _, stripPath, idGen);
      var pathToId = fp.pipe(toRelativePath, relativePathToId);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = filePaths[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var filePath = _step.value;

          var id = pathToId(filePath);
          var svgData = extractSvgData(filePath);
          var jsWrapped = 'export default ' + JSON.stringify(svgData);
          saveToFile(path.join(outputPath, 'inlined', id + '.js'), jsWrapped);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }
  }]);

  return InlinePacker;
}(CachingWriter);

module.exports = InlinePacker;