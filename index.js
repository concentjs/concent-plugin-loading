var { cst, getState, setState, appendState } = require('concent')

var pluginName = 'loading';
var module_trueLoadingCount = {}
var moduleAndFnName_isAsyncFn_ = {};

var toExport = module.exports = {};

function isGenerator(obj) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

function isGeneratorFunction(obj) {
  var constructor = obj.constructor;
  if (!constructor) return false;
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
  return isGenerator(constructor.prototype);
}

function isAsyncFunction(module, fn) {
  var key = module + '/' + fn.name;
  var isAsync = moduleAndFnName_isAsyncFn_[key];
  if (isAsync !== undefined) {//返回缓存的结果
    return isAsync;
  }

  isAsync = Object.prototype.toString.call(fn) === '[object AsyncFunction]';
  if (isAsync === true) {
    moduleAndFnName_isAsyncFn_[key] = true;
    return true;
  }
  
  //有可能成降级编译成 __awaiter格式的了
  var fnStr = fn.toString();
  if (fnStr.indexOf('__awaiter') > 0) {
    moduleAndFnName_isAsyncFn_[key] = true;
    return true;
  }

  if(isGeneratorFunction(fn)){
    moduleAndFnName_isAsyncFn_[key] = true;
    return true;
  }
  
  moduleAndFnName_isAsyncFn_[key] = false;
  return false;
}




toExport.configure = function () {
  return {
    module: pluginName,
    state: {},
  }
}

toExport.writeModuleState = function (pluginState, newModule) {
  var toSet = {};
  toSet[newModule] = false;
  appendState(pluginName, toSet);
  module_trueLoadingCount[newModule] = 0;
}

toExport.subscribe = function (sig, payload) {
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

toExport.default = toExport;