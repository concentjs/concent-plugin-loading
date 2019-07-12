var { cst, getState, setState, appendState } = require('concent')

var pluginName = 'loading';
var module_trueLoadingCount = {};
var moduleAndFnName_isAsyncFn_ = {};
var fnLoading = true;// if false, workingMode will be moduleLoading
var onlyForAsync = false;// if true, will only change loading status while call async&generator function

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

  if (isGeneratorFunction(fn)) {
    moduleAndFnName_isAsyncFn_[key] = true;
    return true;
  }

  moduleAndFnName_isAsyncFn_[key] = false;
  return false;
}

toExport.getConfigure = function () {
  return {
    module: pluginName,
    state: {
      module_trueLoadingCount: module_trueLoadingCount,
      moduleAndFnName_isAsyncFn_: moduleAndFnName_isAsyncFn_,
      fnLoading: fnLoading,
      onlyForAsync: onlyForAsync,
    },
  }
}

toExport.setConfigure = function (conf) {
  if (conf) {
    var _fnLoading = conf.fnLoading;
    var _onlyForAsync = conf.onlyForAsync;
    if (_fnLoading !== undefined) fnLoading = _fnLoading;
    if (_onlyForAsync !== undefined) fnLoading = _onlyForAsync;
  }
}

/** 如定义此函数，concent配置模块时，会调用此逻辑 */
toExport.writeModuleState = function (pluginModuleState, newModule) {
  var toSet = {};
  toSet[newModule] = false;
  appendState(pluginName, toSet);
  module_trueLoadingCount[newModule] = 0;
}

function setFnLoadingStatus(module, fnName, loading) {
  var key = module + '/' + fnName;
  var toSet = {};
  toSet[key] = loading;
  setState(pluginName, toSet);
}cc

function setLoadingTrue(module, fnName) {
  if (fnLoading === true) {
    setFnLoadingTrue(module, fnName, true);
    return;
  }

  var count = module_trueLoadingCount[module];
  module_trueLoadingCount[module] = count + 1;
  var pluginState = getState(pluginName);

  //不为true时，才通知concent变成true
  if (pluginState[module] !== true) {
    var toSet = {};
    toSet[module] = true;
    setState(pluginName, toSet);
  }
}

function setLoadingFalse(module, fnName) {
  if (fnLoading === true) {
    setFnLoadingStatus(module, fnName, false);
    return;
  }

  var count = module_trueLoadingCount[module];
  var newCount = count - 1;
  if (newCount < 0) newCount = 0;
  module_trueLoadingCount[module] = newCount;

  if (newCount === 0) {
    var pluginState = getState(pluginName);
    if (pluginState[module] !== false) {
      var toSet = {};
      toSet[module] = false;
      setState(pluginName, toSet);
    }
  }
}

toExport.receive = function (sig, payload) {
  var module = payload.module;
  var fn = payload.fn;
  var fnName = fn.__fnName || fn.name;
  if (cst.SIG_FN_START === sig) {
    if (onlyForAsync === true) {//处于只有async函数才需要有loading的工作模式
      if (isAsyncFunction(module, fn)) {
        setLoadingTrue(module, fnName);
      }
      return;
    }
    setLoadingTrue(module, fnName);
    return;
  }

  if ([cst.SIG_FN_END, cst.SIG_FN_ERR, cst.SIG_FN_QUIT].indexOf(sig) !== -1) {
    if (onlyForAsync === true) {
      if (isAsyncFunction(module, fn)) {
        setLoadingFalse(module, fnName);
      }
      return;
    }
    setLoadingFalse(module, fnName);
  }
}


toExport.default = toExport;