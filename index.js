var { cst, getState, setState, appendState, ccContext } = require('concent');

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

function _makeFnLoadingState(reducerMod) {
  var state = {};
  var _reducerModule_fnNames_ = ccContext.reducer._reducerModule_fnNames_;

  if (reducerMod) {
    var fullFnNames = _reducerModule_fnNames_[reducerMod];
    if (fullFnNames) {
      fullFnNames.forEach(function (name) {
        state[name] = false;
      });
    }
    return state;
  }

  Object.keys(_reducerModule_fnNames_).forEach(function (reducerMod) {
    const fnNames = _reducerModule_fnNames_[reducerMod];
    fnNames.forEach(function (name) {
      state[reducerMod + '/' + name] = false;
    });
  });
  return state;
}

/** concent启动时会调用一次, 用户configure */
toExport.getConf = function () {
  var state = {};
  if (fnLoading) {
    state = _makeFnLoadingState();
  } else {
    var moduleName_stateKeys_ = ccContext.moduleName_stateKeys_;
    Object.keys(moduleName_stateKeys_).forEach(function (mod) {
      state[mod] = false;
    });
  }

  return {
    name: pluginName,
    module: pluginName,
    conf: { state: state },//用于给configure配置用
    extra: {
      module_trueLoadingCount: module_trueLoadingCount,
      moduleAndFnName_isAsyncFn_: moduleAndFnName_isAsyncFn_,
      fnLoading: fnLoading,
      onlyForAsync: onlyForAsync,
    }
  }
}

/**
 * @param {{fnLoading:boolean, onlyForAsync:boolean}} conf fnLoading default is true, onlyForAsync default is false
 */
toExport.setConf = function (conf) {
  if (conf) {
    var _fnLoading = conf.fnLoading;
    var _onlyForAsync = conf.onlyForAsync;
    if (_fnLoading !== undefined) fnLoading = _fnLoading;
    if (_onlyForAsync !== undefined) onlyForAsync = _onlyForAsync;
  }
}

/** 如定义此函数，concent配置模块时，会调用此逻辑 */
toExport.writeModuleState = function (pluginModuleState, newModule) {
  var toSet = {};
  if (fnLoading) {
    state = _makeFnLoadingState(newModule);
    appendState(pluginName, toSet);
    return;
  }

  toSet[newModule] = false;
  appendState(pluginName, toSet);
  module_trueLoadingCount[newModule] = 0;
}

function setFnLoadingStatus(module, fnName, loading) {
  var key = module + '/' + fnName;
  var toSet = {};
  toSet[key] = loading;
  setState(pluginName, toSet);
}

function setLoadingTrue(module, fnName) {
  if (fnLoading === true) {
    setFnLoadingStatus(module, fnName, true);
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
  var fn = payload.fn;
  if (!fn) return;//有可能非reducer调用
  if (payload.calledBy == 'invoke') return;//invoke调用，无loading特效
  if (!payload.isSourceCall) return;//非源头触发的调用，无loading特效

  var module = payload.module;

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