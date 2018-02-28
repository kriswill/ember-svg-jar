'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
  Merge JSON asset stores into a single JSON file and add additional
  meta data. The output file will be used by the asset viewer as the model
  in development mode.

  The input node files must be generated with the ViewerAssetsBuilder.

  Required options:
    outputFile

  Optional options:
    annotation

  Examples of input and output:

  Input node:
  ├── inline.json
  └── symbol.json

  Output node:
  └── output.json

  inline.json can content:
  [
    {
      "svg": { "content": "<path />", "attrs": { ... } },
      "fileName": "alarm.svg",
      "strategy": "inline",
      ...
    },

    { ... }
  ]

  symbol.json can content:
  [
    {
      "svg": { "content": "<path />", "attrs": { ... } },
      "fileName": "cat.svg",
      "strategy": "symbol",
      ...
    },

    { ... }
  ]

  output.json can content:
  {
    "assets": [
      {
        "svg": { "content": "<path />", "attrs": { ... } },
        "fileName": "alarm.svg",
        "strategy": "inline",
        ...
      },

      {
        "svg": { "content": "<path />", "attrs": { ... } },
        "fileName": "cat.svg",
        "strategy": "symbol",
        ...
      },

      { ... }
    ],

    "details": [
      { "name": "File name", "key": "fileName" }
    ],

    "searchKeys": ["fileName", "fileDir"],

    "sortBy": [
      { "name": "File name", "key": "fileName" }
    ],

    "arrangeBy": [
      { "name": "Directory", "key": "fileDir" }
    ],

    "filters": [
      { "name": "Directory", "key": "fileDir", "items": [{ "name": "/", "count": 74 }] }
    ],

    "links": [
      { "text": "Contribute", "url": "https://github.com/ivanvotti/ember-svg-jar" }
    ]
  }
*/
var path = require('path-posix');
var _ = require('lodash');
var fp = require('lodash/fp');
var CachingWriter = require('broccoli-caching-writer');

var _require = require('./utils'),
    toPosixPath = _require.toPosixPath,
    readFile = _require.readFile,
    saveToFile = _require.saveToFile;

function filtersFor(assets, filters) {
  return filters.map(function (filter) {
    return {
      name: filter.name,
      key: filter.key,
      items: _(assets).map(filter.key).without(undefined).countBy().toPairs().map(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
            name = _ref2[0],
            count = _ref2[1];

        return { name: name, count: count };
      }).sortBy('name').value()
    };
  });
}

function assetsToViewerModel(assets, hasManyStrategies) {
  var details = [{ name: 'File name', key: 'fileName' }, { name: 'Directory', key: 'fileDir' }, { name: 'Base size', key: 'fullBaseSize' }, { name: 'Original file size', key: 'fileSize' }, { name: 'Optimized file size', key: 'optimizedFileSize' }, { name: 'Strategy', key: 'strategy' }];

  var searchKeys = ['fileName', 'fileDir'];

  var sortBy = [{ name: 'File name', key: 'fileName' }, { name: 'Base size', key: 'height' }];

  var arrangeBy = [{ name: 'Directory', key: 'fileDir' }, { name: 'Base size', key: 'baseSize' }];

  var filterBy = [{ name: 'Directory', key: 'fileDir' }, { name: 'Base size', key: 'baseSize' }];

  if (hasManyStrategies) {
    filterBy.push({ name: 'Strategy', key: 'strategy' });
  }

  var links = [{ text: 'Configuration', url: 'https://github.com/ivanvotti/ember-svg-jar/blob/master/docs/configuration.md' }, { text: 'Contribute', url: 'https://github.com/ivanvotti/ember-svg-jar' }, { text: 'About', url: 'https://svgjar.firebaseapp.com' }];

  return {
    assets: assets,
    details: details,
    searchKeys: searchKeys,
    sortBy: sortBy,
    arrangeBy: arrangeBy,
    filters: filtersFor(assets, filterBy),
    links: links
  };
}

var ViewerBuilder = function (_CachingWriter) {
  _inherits(ViewerBuilder, _CachingWriter);

  function ViewerBuilder(inputNode) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, ViewerBuilder);

    var _this = _possibleConstructorReturn(this, (ViewerBuilder.__proto__ || Object.getPrototypeOf(ViewerBuilder)).call(this, [inputNode], {
      name: 'ViewerBuilder',
      annotation: options.annotation
    }));

    _this.options = options;
    return _this;
  }

  _createClass(ViewerBuilder, [{
    key: 'build',
    value: function build() {
      var outputPath = toPosixPath(this.outputPath);
      var filePaths = this.listFiles().map(toPosixPath);
      var outputFilePath = path.join(outputPath, this.options.outputFile);
      var hasManyStrategies = filePaths.length > 1;

      fp.pipe(fp.flatMap(fp.pipe(readFile, JSON.parse)), function (assets) {
        return assetsToViewerModel(assets, hasManyStrategies);
      }, JSON.stringify, saveToFile(outputFilePath))(filePaths);
    }
  }]);

  return ViewerBuilder;
}(CachingWriter);

module.exports = ViewerBuilder;