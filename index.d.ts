
/**
 * @param config 
 * @param {boolean} config.fnLoading default:true, 是否为函数记录loading状态，设置为false的话，只为模块记录loading状态
 * @param {boolean} config.onlyForAsync default:false, fnLoading为true1的情况下，是否只为async函数记录loading，
 * 如果设置onlyForAsync为true，则只为async reducer函数记录loading
 * @param {boolean} config.enqueue default:true, 是否对loading状态提交做队列化处理，如果设置为false，
 * 则任何一个reducer函数调用都会触发loading更新，推荐使用默认设置，因为多个模块都在提交新的状态时，会有优化处理，减少重渲染的触发
 * @param {string[]} config.excludeModules 欲排除loading状态设置的模块，注意这里排除后，ctx.connected.loading.{xxxModule} 是undefined
 * @param {string[]} config.excludeFns 在没有排除模块时，设置该模块下欲排除loading状态设置的具体函数
 */
export declare function setConf(config: { fnLoading: boolean, onlyForAsync: boolean, enqueue: boolean, excludeModules: string[], excludeFns: string[] }): void;

declare type DefaultExport = {
  setConf: typeof setConf,
  install: (on: any) => any,
}

declare let defaultExport: DefaultExport;
export default defaultExport;