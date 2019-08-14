### 2019-08-15
`setConf: (config)=>void`, conf新增配置项`excludeModules`和`excludeFns`，让用户可以选择让loadingPlugin不为这些指定模块或方法产生loading状态
- 示例1
```
import loadingPlugin from 'concent-plugin-loading';

loadingPlugin.setConf({
  // 不为GeneralTable模块的所有reducer方法调用产生loading状态
  excludeModules: ['GeneralTable'],
});
```
- 示例2
```
import loadingPlugin from 'concent-plugin-loading';

loadingPlugin.setConf({
  // 不为GeneralTable模块的foo1和foo2方法调用产生loading状态
  excludeFns: ['GeneralTable/foo1', 'GeneralTable/foo2'],
});
```
> 当即指定了模块，又指定了模块的某些方法时，模块的优先级高于方法，此时`excludeFns`成了冗余的配置项