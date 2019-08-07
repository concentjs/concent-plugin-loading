
### concent-plugin-loading
一个方便你集中管理loading的插件

### [在线示例](https://stackblitz.com/edit/cc-plugin-loading)

### 如何使用
在启动concent的时候配置好插件，就可以使用了
```
import { run } from 'concent';
import loadingPlugin from 'concent-plugin-loading';
import student from './models/student';
import product from './models/product';

run(
  { student, product },
  {
    //配置loading插件
    plugins:[loadingPlugin],
  }
);

```
读取loading值，`loadingPlugin`会注册自己的模块`loading`,该模块的key就是其他`concent`里所有模块的名字，值就是这个模块loading值，true表示该模块正在调用异步函数，
false表示调用异步函数函数结束

```
import { register } from 'concent';
import React, { Component } from 'react';

@register({ 
  module: 'student', 
  //连接loading模块，关心student模块的loading状态
  connect:{'loading':['student']},
  //如关心某个具体的方法loading状态，可以写为
  //connect:{'loading':['student/m1', 'student/m2']},
})
export default class StudentPanel extends Component {

  changeName = () => {
    this.$$dispatch('handleStudentNameChange', this.state.tmpName);
  }

  render() {
    const { name, tmpName } = this.state;
    const loading = this.$$connectedState.loading.student;
    console.log('@@@ StudentPanel', loading);

    return (
      <div>
         {loading? '提交中':''}
        <p>name: {name}</p>
        <input value={tmpName} onChange={this.$$sync('tmpName')} />
        <button onClick={this.changeName}>修改名字</button>
      </div>
    );
  }
}

```
reducer定义
```
// code in models/student/reducer.js
const sleep = (ms = 3000)=> new Promise(resolve=> setTimeout(resolve, ms));

export async function trackNameChangeEvent(){
  console.log('trackNameChangeEvent');
}

export async function updateStudentName({payload:name}){
  await sleep();//模拟请求后端更新name
  return {name};
}

export async function handleStudentNameChange({dispatch, payload:name}){
  await dispatch('updateStudentName', name);
  await dispatch('trackNameChangeEvent', name);
}
```
* 注意1，reducer函数的格式
> 仅当你的调用的reducer函数为async函数或者generator函数时，loading插件会改变各个模块loading的值

* 注意2，对同一个模块并行发起多个dispatch
> 对同一个模块并发起多个dispatch时，只有全部函数执行结束loading才会变成false

```
  changeName = () => {
    //假设student模块存在以下3个reducer函数，这里同时调了3次
    //全部结束时,student模块的loading才会写为false
    this.$$dispatch('handleStudentNameChange', this.state.tmpName);
    this.$$dispatch('handleStudentNameChange2', this.state.tmpName);
    this.$$dispatch('handleStudentNameChange3', this.state.tmpName);
  }
```

* 注意2，dispatch穿插调用
>在一个模块的reducer函数里，调用了另外模块的reducer函数，那个模块的loading值也会经历变成true然后变成false的过程

```
// code in models/student/reducer.js
const sleep = (ms = 3000)=> new Promise(resolve=> setTimeout(resolve, ms));

export async function updateStudentName({payload:name, dispatch}){
  await sleep();//模拟请求后端更新name

  //这里会触发loading插件去改写product模块的loading值
  await dispatch('product/fetchProductList');
  return {name};
}
```