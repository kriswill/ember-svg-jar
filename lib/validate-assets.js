'use strict';

var _ = require('lodash');

function checkForDuplicates(assets) {
  var duplicateIds = _(assets).map('id').countBy().pickBy(function (value) {
    return value > 1;
  }).keys().value();

  if (!duplicateIds.length) {
    return;
  }

  var invalidAssets = _.flatMap(duplicateIds, function (id) {
    return _.filter(assets, { id: id });
  });
  return ['Duplicate IDs found:'].concat(invalidAssets.map(function (asset) {
    return 'ID: "' + asset.id + '" Path: ' + asset.relativePath;
  })).join('\n');
}

function validateViewBox(assets) {
  var invalidAssets = _.filter(assets, function (asset) {
    return _.isUndefined(asset.svgData.attrs.viewBox);
  });

  if (!invalidAssets.length) {
    return;
  }

  return ['SVG files without viewBox found:'].concat(invalidAssets.map(function (asset) {
    return 'Path: ' + asset.relativePath;
  })).join('\n');
}

module.exports = function validateAssets(assets, strategy, ui) {
  var validators = [checkForDuplicates, validateViewBox];

  validators.forEach(function (validate) {
    var message = validate(assets);

    if (message) {
      ui.write('\n');
      ui.writeWarnLine('[ember-svg-jar][' + strategy + '] ' + message);
    }
  });
};