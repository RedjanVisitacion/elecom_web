const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const defaults = Array.from({length:14}, (_,index)=>({id:'default-'+index,default_index:index,image_url:null}));
const nodes={}, calls=[];
function node(){return {value:'',files:[],children:[],handlers:{},addEventListener(name,fn){this.handlers[name]=fn},removeEventListener(name){delete this.handlers[name]},setAttribute(){},append(child){this.children.push(child)},replaceChildren(){this.children=[]}};}
const context={console,URL,FormData,crypto:{randomUUID:()=> 'new-page'},bootstrap:{Modal:class{constructor(el){this.el=el}show(){}hide(){this.el.handlers['hidden.bs.modal']()}}},window:{addEventListener(){}},document:{getElementById:id=>nodes[id] ||= node(),createElement:node},fetch:async(url,options={})=>{
 calls.push({url,options});
 if(url==='/api/admin/elections/')return {ok:true,json:async()=>({ok:true,elections:[{id:9,name:'Current',is_active:true}]})};
 return {ok:true,json:async()=>({ok:true,csrfToken:'test',pages:options.method==='POST'?JSON.parse(options.body.get('pages')):structuredClone(defaults)})};
}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../org_elecom/elecom_admin/admin_components/admin_js/omnibus_appearance.js'),'utf8'),context);
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(nodes.omnibusPages.children.length,14);
 nodes.omnibusPages.children[3].handlers.click(); nodes.omnibusUp.handlers.click();
 await nodes.omnibusSave.handlers.click();
 const sent=calls.find(call=>call.options.method==='POST');
 assert.equal(sent.url,'/api/admin/elections/9/omnibus/');
 assert.equal(JSON.parse(sent.options.body.get('pages'))[2].default_index,3);
 const cancelled=nodes.omnibusRemove.handlers.click(); nodes.filingConfirmModal.handlers['hidden.bs.modal'](); await cancelled;
 assert.equal(nodes.omnibusPages.children.length,14);
 const removed=nodes.omnibusRemove.handlers.click(); nodes.filingConfirmAccept.handlers.click(); await removed;
 assert.equal(nodes.omnibusPages.children.length,13);
 const reset=nodes.omnibusReset.handlers.click(); nodes.filingConfirmAccept.handlers.click(); await reset;
 assert.equal(nodes.omnibusPages.children.length,14);
 console.log('Omnibus editor passed: load, reorder, scoped publish, cancel, remove, restore.');
})().catch(error=>{console.error(error);process.exitCode=1});
