

export interface IConfig {
  /**
   * default:true, 是否为函数记录loading状态，设置为false的话，只为模块记录loading状态
   */
  fnLoading?: boolean;
  /**
   * default:false, fnLoading为true的情况下此配置有效，表示是否只为async函数记录loading
   */
  onlyForAsync?: boolean;
  /**
   * default:true, 是否对loading状态提交做队列化处理，如果设置为false
   * 则任何一个reducer函数调用都会触发loading更新，推荐使用默认设置，因为多个模块都在提交新的状态时，会有优化处理，减少重渲染的触发
   */
  enqueue?: boolean;
  /**
   * 欲排除loading状态设置的模块，注意这里排除后，ctx.connected.loading.{xxxModule} 是 undefined
   */
  excludeModules?: string[];
  /**
   * 配置可触发loading函数范围，配置 includeFns 后 excludeFns 配置无效
   * 示例：['xxxMod/xxxMethod']
   */
  includeFns?: string[];
  /**
   * 在没有排除模块时，设置该模块下欲排除loading状态设置的具体函数
   */
  excludeFns?: string[];
  /**
   * default: true, 
   * true 表示只允许源头函数触发loading，此时reducer过程中调用的函数不触发loading
   */
  onlySourceCallTriggerLoading?: boolean;
  /**
   * default: true, 
   * true 表示 invoke调用你不会触发loading
   */
  invokeCallNoLoading?: boolean;
}

export declare function setConf(config: IConfig): void;

declare type DefaultExport = {
  setConf: typeof setConf,
  install: (on: any) => any,
}

declare let defaultExport: DefaultExport;
export default defaultExport;