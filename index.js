var { cst, getState, setState, appendState } = require('@tencent/concent')

var pluginName = 'loading';
var module_trueLoadingCount = {}

function isGenerator(obj) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

function isGeneratorFunction(obj) {
  var constructor = obj.constructor;
  if (!constructor) return false;
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
  return isGenerator(constructor.prototype);
}

function isAsyncFunction(fn) {
  return Object.prototype.toString.call(fn) === '[object AsyncFunction]';
}


exports.configure = function () {
  return {
    module: pluginName,
    state: {},
  }
}

exports.writeModuleState = function (pluginState, newModule) {
  var toSet = {};
  toSet[newModule] = false;
  appendState(pluginName, toSet);
  module_trueLoadingCount[newModule] = 0;
}

exports.subscribe = function (sig, payload) {
  var module = payload.module;
  if (cst.SIG_FN_START === sig) {
    var fn = payload.fn;
    if (isAsyncFunction(fn) || isGeneratorFunction(fn)) {
      // var chainId = payload.chainId;

      var count = module_trueLoadingCount[module];
      module_trueLoadingCount[module] = count + 1;

      //不为true才通知concent变成true
      var pluginState = getState(pluginName);
      if (pluginState[module] !== true) {
        var toSet = {};
        toSet[module] = true;
        setState(pluginName, toSet);
      }
    }
  } else if ([cst.SIG_FN_END, cst.SIG_FN_ERR, cst.SIG_FN_QUIT].indexOf(sig) !== -1) {
    var count = module_trueLoadingCount[module];
    var newCount = count - 1;
    if (newCount < 0) newCount = 0;
    module_trueLoadingCount[module] = newCount;

    if(newCount === 0){
      var pluginState = getState(pluginName);
      if (pluginState[module] !== false) {
        var toSet = {};
        toSet[module] = false;
        setState(pluginName, toSet);
      }
    }
  }

}