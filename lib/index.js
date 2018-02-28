'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var Funnel = require('broccoli-funnel');
var MergeTrees = require('broccoli-merge-trees');
var SVGOptimizer = require('broccoli-svg-optimizer');
var Symbolizer = require('broccoli-symbolizer');
var broccoliReplace = require('broccoli-string-replace');
var InlinePacker = require('./inline-packer');
var ViewerAssetsBuilder = require('./viewer-assets-builder');
var ViewerBuilder = require('./viewer-builder');
var validateOptions = require('./validate-options');

var symbolsLoaderScript = fs.readFileSync(path.join(__dirname, '../symbols-loader.html'), 'utf8');

var defaultGenerators = {
  symbolIdGen: function symbolIdGen(svgPath, _ref) {
    var prefix = _ref.prefix;
    return ('' + prefix + svgPath).replace(/[\s]/g, '-');
  },
  symbolCopypastaGen: function symbolCopypastaGen(assetId) {
    return '{{svg-jar "#' + assetId + '"}}';
  },
  inlineIdGen: function inlineIdGen(svgPath) {
    return svgPath;
  },
  inlineCopypastaGen: function inlineCopypastaGen(assetId) {
    return '{{svg-jar "' + assetId + '"}}';
  }
};

function mergeTreesIfNeeded(trees, options) {
  var mergedOptions = _.assign({ overwrite: true }, options);
  return trees.length === 1 ? trees[0] : new MergeTrees(trees, mergedOptions);
}

function buildOptions() {
  var customOpts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var viewerDefault = arguments[1];
  var defaultSourceDir = arguments[2];

  var defaultOpts = {
    rootURL: '/',
    sourceDirs: [defaultSourceDir],
    strategy: 'inline',
    stripPath: true,
    optimizer: {},
    persist: true,

    viewer: {
      enabled: viewerDefault,
      embed: viewerDefault
    },

    inline: {
      idGen: defaultGenerators.inlineIdGen,
      copypastaGen: defaultGenerators.inlineCopypastaGen
    },

    symbol: {
      idGen: defaultGenerators.symbolIdGen,
      copypastaGen: defaultGenerators.symbolCopypastaGen,
      outputFile: '/assets/symbols.svg',
      prefix: '',
      includeLoader: true
    }
  };

  var options = _.merge(defaultOpts, customOpts);
  console.warn(options)
  options.strategy = _.castArray(options.strategy);
  return options;
}

module.exports = {
  name: 'ember-svg-jar',

  isDevelopingAddon: function isDevelopingAddon() {
    return false;
  },
  included: function included(app) {
    this._super.included.apply(this, arguments);

    if (app.parent) {
      // we are being used by an addon (which is not to be confused
      // with being used by an addon's dummy app!). In this case,
      // app.options.svgJar is coming from the addon's index.js. The
      // viewer defaults to off, and our default source for SVGs is
      // the addon's public directory.
      this.svgJarOptions = buildOptions(app.options.svgJar, false, path.join(app.root, app.treePaths.public));
    } else {
      // we are being used by an app (which may also include the dummy
      // app inside of an addon).  In this case, app.options.svgJar is
      // coming from the app's ember-cli-build.js, the viewer defaults
      // to "on in development", and our default source for icons is
      // the app's public directory.
      this.svgJarOptions = buildOptions(app.options.svgJar, app.env === 'development', app.options.trees.public);
    }
    validateOptions(this.svgJarOptions);
  },
  treeForPublic: function treeForPublic() {
    var trees = [];

    if (this.svgJarOptions.viewer.enabled) {
      trees.push(this.getViewerTree());

      if (this.svgJarOptions.viewer.embed) {
        var svgJarPublicTree = this._super.treeForPublic.apply(this, arguments);

        svgJarPublicTree = broccoliReplace(svgJarPublicTree, {
          files: ['**/index.html'],
          pattern: {
            match: /\{\{ROOT_URL\}\}/g,
            replacement: this.svgJarOptions.rootURL
          }
        });

        trees.push(svgJarPublicTree);
      }
    }

    if (this.hasSymbolStrategy()) {
      trees.push(this.getSymbolStrategyTree());
    }

    return mergeTreesIfNeeded(trees);
  },
  treeForAddon: function treeForAddon(addonTree) {
    var trees = [addonTree];

    if (this.hasInlineStrategy()) {
      trees.push(this.getInlineStrategyTree());
    }

    return this._super.treeForAddon.call(this, mergeTreesIfNeeded(trees));
  },
  contentFor: function contentFor(type) {
    var includeLoader = this.hasSymbolStrategy() && this.optionFor('symbol', 'includeLoader');

    if (type === 'body' && includeLoader) {
      var symbolsURL = path.join(this.svgJarOptions.rootURL, this.optionFor('symbol', 'outputFile'));
      return symbolsLoaderScript.replace('{{SYMBOLS_URL}}', symbolsURL);
    }

    return '';
  },
  optionFor: function optionFor(strategy, optionName) {
    // globalOptions can be both root or strategy specific.
    var globalOptions = ['sourceDirs', 'stripPath', 'optimizer'];

    return _.isUndefined(this.svgJarOptions[strategy][optionName]) ? globalOptions.indexOf(optionName) !== -1 && this.svgJarOptions[optionName] : this.svgJarOptions[strategy][optionName];
  },
  sourceDirsFor: function sourceDirsFor(strategy) {
    return this.optionFor(strategy, 'sourceDirs').filter(function (sourceDir) {
      return typeof sourceDir !== 'string' || fs.existsSync(sourceDir);
    });
  },
  originalSvgsFor: function originalSvgsFor(strategy) {
    var sourceDirs = this.sourceDirsFor(strategy);

    return new Funnel(mergeTreesIfNeeded(sourceDirs), {
      include: ['**/*.svg']
    });
  },
  optimizedSvgsFor: function optimizedSvgsFor(strategy, originalSvgs) {
    return new SVGOptimizer(originalSvgs, {
      svgoConfig: this.optionFor(strategy, 'optimizer'),
      persist: this.svgJarOptions.persist
    });
  },
  svgsFor: function svgsFor(strategy) {
    var originalSvgs = this.originalSvgsFor(strategy);

    return this.hasOptimizerFor(strategy) ? this.optimizedSvgsFor(strategy, originalSvgs) : originalSvgs;
  },
  viewerSvgsFor: function viewerSvgsFor(strategy) {
    var originalSvgs = this.originalSvgsFor(strategy);
    var nodes = [originalSvgs];

    if (this.hasOptimizerFor(strategy)) {
      var optimizedSvgs = this.optimizedSvgsFor(strategy, originalSvgs);
      nodes.push(new Funnel(optimizedSvgs, { destDir: '__optimized__' }));
    }

    return mergeTreesIfNeeded(nodes);
  },
  getViewerTree: function getViewerTree() {
    var _this = this;

    var idGenOpts = {
      symbol: {
        prefix: this.optionFor('symbol', 'prefix')
      }
    };

    var viewerBuilderNodes = this.svgJarOptions.strategy.map(function (strategy) {
      return new ViewerAssetsBuilder(_this.viewerSvgsFor(strategy), {
        strategy: strategy,
        idGen: _this.optionFor(strategy, 'idGen'),
        idGenOpts: idGenOpts[strategy],
        copypastaGen: _this.optionFor(strategy, 'copypastaGen'),
        stripPath: _this.optionFor(strategy, 'stripPath'),
        hasOptimizer: _this.hasOptimizerFor(strategy),
        outputFile: strategy + '.json',
        ui: _this.ui
      });
    });

    return new ViewerBuilder(mergeTreesIfNeeded(viewerBuilderNodes), {
      outputFile: 'svg-jar.json'
    });
  },
  getInlineStrategyTree: function getInlineStrategyTree() {
    return new InlinePacker(this.svgsFor('inline'), {
      idGen: this.optionFor('inline', 'idGen'),
      stripPath: this.optionFor('inline', 'stripPath')
    });
  },
  getSymbolStrategyTree: function getSymbolStrategyTree() {
    return new Symbolizer(this.svgsFor('symbol'), {
      idGen: this.optionFor('symbol', 'idGen'),
      stripPath: this.optionFor('symbol', 'stripPath'),
      outputFile: this.optionFor('symbol', 'outputFile'),
      prefix: this.optionFor('symbol', 'prefix'),
      persist: this.svgJarOptions.persist
    });
  },
  hasOptimizerFor: function hasOptimizerFor(strategy) {
    return this.optionFor(strategy, 'optimizer');
  },
  hasInlineStrategy: function hasInlineStrategy() {
    return this.svgJarOptions.strategy.indexOf('inline') !== -1;
  },
  hasSymbolStrategy: function hasSymbolStrategy() {
    return this.svgJarOptions.strategy.indexOf('symbol') !== -1;
  }
};
