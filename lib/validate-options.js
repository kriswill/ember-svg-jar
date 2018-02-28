'use strict';

var _ = require('lodash');

var VALID_STRATEGIES = ['inline', 'symbol'];

function validateStrategy(options) {
  var strategyOpt = options.strategy;

  if (!(_.isString(strategyOpt) || _.isArray(strategyOpt))) {
    return 'Invalid strategy value. It must be a string or an array.';
  }

  var isInvalid = _.castArray(strategyOpt).some(function (strategy) {
    return VALID_STRATEGIES.indexOf(strategy) === -1;
  });

  if (isInvalid) {
    var validOptions = VALID_STRATEGIES.join(', ');
    return 'Invalid strategy found. Valid options are ' + validOptions + '.';
  }
}

module.exports = function validateOptions(options) {
  var validators = [validateStrategy];

  validators.forEach(function (validate) {
    var error = validate(options);

    if (error) {
      throw new Error('ember-svg-jar: ' + error);
    }
  });
};