var { cst, getState, setState, appendState, ccContext, configure } = require('concent');

var pluginName = 'loading';
var module2trueLoadingCount = {};
var moduleAndFnName2isAsyncFn = {};
var fnLoading = true;// if false, plugin will not record loading status for fn, only record loading status for module
var onlyForAsync = false;// if true, will only change loading status while call async&generator function
var enqueue = true;// if false, every fn call will set loading status immediately, not batch then and set then until ** ms later

var excludeModules = [];
var excludeFns = [];
var includeFns = [];

/**
 * see: https://github.com/concentjs/concent/issues/59
 */
var onlySourceCallTriggerLoading = true;
var invokeCallNoLoading = true;

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
  var isAsync = moduleAndFnName2isAsyncFn[key];
  if (isAsync !== undefined) {//返回缓存的结果
    return isAsync;
  }

  isAsync = Object.prototype.toString.call(fn) === '[object AsyncFunction]';
  if (isAsync === true) {
    moduleAndFnName2isAsyncFn[key] = true;
    return true;
  }

  //有可能成降级编译成 __awaiter格式的了
  var fnStr = fn.toString();
  if (fnStr.indexOf('__awaiter') > 0) {
    moduleAndFnName2isAsyncFn[key] = true;
    return true;
  }

  if (isGeneratorFunction(fn)) {
    moduleAndFnName2isAsyncFn[key] = true;
    return true;
  }

  moduleAndFnName2isAsyncFn[key] = false;
  return false;
}

function _makeFnLoadingState(reducerMod) {
  var state = {};
  var _module2fnNames = ccContext.reducer._module2fnNames;

  if (reducerMod) {
    if (excludeModules.includes(reducerMod)) {
      return null;
    }

    var fullFnNames = _module2fnNames[reducerMod];
    if (fullFnNames) {
      fullFnNames.forEach(function (name) {
        state[reducerMod + '/' + name] = false;
      });
    }
    state[reducerMod] = false;
    module2trueLoadingCount[reducerMod] = 0;
    return state;
  }

  Object.keys(_module2fnNames).forEach(function (reducerMod) {
    if (excludeModules.includes(reducerMod)) {
      return;
    }

    const fnNames = _module2fnNames[reducerMod];
    fnNames.forEach(function (name) {
      state[reducerMod + '/' + name] = false;
    });
    state[reducerMod] = false;
    module2trueLoadingCount[reducerMod] = 0;
  });
  return state;
}

var latestLoading = true;
var enqueuedState = {};
var timer = 0;
function _commitEnqueuedLoadingStatus() {
  var moduledFnKeys = Object.keys(enqueuedState);
  var len = moduledFnKeys.length;
  if (len > 0) {
    var fullStateToSet = {};
    for (var i = 0; i < len; i++) {
      var moduledFnKey = moduledFnKeys[i];
      var loading = enqueuedState[moduledFnKey];
      var ret = moduledFnKey.split('/');
      var module = ret[0];
      var fnName = ret[1];
      _makeFnLoadingStateToSet(module, fnName, loading, fullStateToSet);
    }
    setState(pluginName, fullStateToSet);
    enqueuedState = {};
  }
}

function _enqueueLoadingStatus(fnKey, loading) {
  if (loading !== latestLoading) {
    _commitEnqueuedLoadingStatus();
  }

  enqueuedState[fnKey] = loading;
  latestLoading = loading;
  clearTimeout(timer);
  timer = setTimeout(function () {
    _commitEnqueuedLoadingStatus();
  }, 190);
}

function _makeFnLoadingStateToSet(module, fnName, loading, toSetObj) {
  var key = module + '/' + fnName;
  var moduleKey = module;
  var toSet = toSetObj || {};
  toSet[key] = loading;

  var newCount;
  var count = module2trueLoadingCount[module];
  if (loading === true) {
    newCount = count + 1;
    module2trueLoadingCount[module] = newCount;
  } else {
    newCount = count - 1;
    if (newCount >= 0) {
      module2trueLoadingCount[module] = newCount;
    }
  }

  var pluginState = getState(pluginName);
  if (newCount > 0 && pluginState[moduleKey] !== true) {
    toSet[moduleKey] = true;
  }
  if (newCount === 0 && pluginState[moduleKey] === true) {
    toSet[moduleKey] = false;
  }

  return toSet;
}

function setFnLoadingStatus(module, fnName, loading) {
  var key = module + '/' + fnName;
  if (enqueue !== true) {
    var toSet = _makeFnLoadingStateToSet(module, fnName, loading);
    setState(pluginName, toSet);
    return;
  }

  var pluginState = getState(pluginName);
  var prevLoadingStatus = pluginState[key];
  if (loading === true) {
    if (prevLoadingStatus !== true) {
      _enqueueLoadingStatus(key, true);
    };
  } else {
    //不检查prevLoadingStatus（来自于store的值很可能有还未变化，
    //因为如果时间够短，可能enqueuedState里有一批为true的loading还未提交），
    //直接触发_enqueueLoadingStatus
    //此时_enqueueLoadingStatus会触发这批true被提交
    _enqueueLoadingStatus(key, false);
  }
}

function setLoadingTrue(module, fnName) {
  if (fnLoading === true) {
    setFnLoadingStatus(module, fnName, true);
    return;
  }

  var count = module2trueLoadingCount[module];
  module2trueLoadingCount[module] = count + 1;
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

  var count = module2trueLoadingCount[module];
  var newCount = count - 1;
  if (newCount < 0) newCount = 0;
  module2trueLoadingCount[module] = newCount;

  if (newCount === 0) {
    var pluginState = getState(pluginName);
    if (pluginState[module] !== false) {
      var toSet = {};
      toSet[module] = false;
      setState(pluginName, toSet);
    }
  }
}

/** concent启动时会调用一次插件的install接口 */
toExport.install = function (on) {
  var state = {};
  if (fnLoading) {
    state = _makeFnLoadingState();
  } else {
    var moduleName2stateKeys = ccContext.moduleName2stateKeys;
    Object.keys(moduleName2stateKeys).forEach(function (mod) {
      state[mod] = false;
      module2trueLoadingCount[mod] = 0;
    });
  }

  // 将loading配置成concent的模块
  configure(pluginName, { state });

  on([cst.SIG_FN_START, cst.SIG_FN_END, cst.SIG_FN_ERR, cst.SIG_FN_QUIT], function (data) {
    var payload = data.payload;
    var sig = data.sig;

    var fn = payload.fn;
    if (!fn) return; // 有可能非reducer调用
    if (payload.calledBy == 'invoke') return; // invoke调用，无loading特效
    if (!payload.isSourceCall) return; // 非源头触发的调用，无loading特效

    var module = payload.module;
    if (excludeModules.includes(module)) {
      return;
    }

    var fnName = fn.__fnName || fn.name;

    var fnKey = module + '/' + fnName;
    // 配置了可以触发loading函数则优先判断 fnKey 是否在这些函数范围内，此时 excludeFns 无效
    if (includeFns.length > 0) {
      if (!includeFns.includes(fnKey)) {
        return;
      }
    } else if (excludeFns.includes(fnKey)) {
      return;
    }

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
  });

  on(cst.SIG_MODULE_CONFIGURED, function (data) {
    var newModule = data.payload;

    var toSet = {};
    if (fnLoading) {
      toSet = _makeFnLoadingState(newModule);
      if (toSet) appendState(pluginName, toSet);
      return;
    }

    if (excludeModules.includes(newModule)) {
      return;
    }

    toSet[newModule] = false;
    appendState(pluginName, toSet);
    module2trueLoadingCount[newModule] = 0;
  })

  return { name: pluginName }
}

toExport.setConf = function (/** @type {import('./types').IConfig} */conf) {
  if (conf) {
    var _fnLoading = conf.fnLoading;
    var _onlyForAsync = conf.onlyForAsync;
    var _enqueue = conf.enqueue;
    var _excludeModules = conf.excludeModules;
    var _excludeFns = conf.excludeFns;
    var _includeFns = conf.includeFns;
    var _onlySourceCallTriggerLoading = conf.onlySourceCallTriggerLoading;
    var _invokeCallNoLoading = conf.invokeCallNoLoading;

    if (_fnLoading !== undefined) fnLoading = _fnLoading;
    if (_onlyForAsync !== undefined) onlyForAsync = _onlyForAsync;
    if (_enqueue !== undefined) enqueue = _enqueue;
    if (Array.isArray(_excludeModules)) excludeModules = _excludeModules;
    if (Array.isArray(_excludeFns)) excludeFns = _excludeFns;
    if (Array.isArray(_includeFns)) includeFns = _includeFns;
    if (_onlySourceCallTriggerLoading !== undefined) onlySourceCallTriggerLoading = _onlySourceCallTriggerLoading;
    if (_invokeCallNoLoading !== undefined) invokeCallNoLoading = _invokeCallNoLoading;
  }
}

toExport.default = toExport;
