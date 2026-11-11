const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const nodes={},calls=[];
const node=()=>({value:'',files:[],children:[],handlers:{},addEventListener(name,fn){this.handlers[name]=fn},removeEventListener(name){delete this.handlers[name]},append(item){this.children.push(item)},getAttribute(name){return this[name]}});
const url='https://res.cloudinary.com/demo/image/upload/header.jpg';
const context={console,FormData,URL:{createObjectURL:()=> 'blob:draft',revokeObjectURL(){}},window:{addEventListener(){},ElecomImageCrop:async(file,kind)=>{assert.equal(kind,'topbar');return file}},document:{getElementById:id=>nodes[id] ||=node(),createElement:node},bootstrap:{Modal:class{constructor(el){this.el=el}show(){}hide(){this.el.handlers['hidden.bs.modal']()}}},fetch:async(urlValue,options={})=>{calls.push({url:urlValue,options});return {ok:true,json:async()=>urlValue==='/api/admin/elections/'?{ok:true,elections:[{id:8,name:'Current',is_active:true}]}:{ok:true,csrfToken:'test',image_url:options.method==='POST'?url:null}}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../org_elecom/elecom_admin/admin_components/admin_js/topbar_appearance.js'),'utf8'),context);
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(nodes.topbarElection.value,'8');
 nodes.topbarFile.files=[new File(['image'],'crop.jpg',{type:'image/jpeg'})];await nodes.topbarFile.handlers.change();assert.equal(nodes.topbarPreview.src,'blob:draft');
 await nodes.topbarSave.handlers.click();assert.equal(nodes.topbarPreview.src,url);
 const sent=calls.find(call=>call.options.method==='POST');assert.equal(sent.url,'/api/admin/elections/8/topbar/');assert.ok(sent.options.body.get('background'));
 const canceled=nodes.topbarReset.handlers.click();nodes.filingConfirmModal.handlers['hidden.bs.modal']();await canceled;assert.equal(calls.filter(call=>call.options.method==='DELETE').length,0);
 const reset=nodes.topbarReset.handlers.click();nodes.filingConfirmAccept.handlers.click();await reset;assert.ok(nodes.topbarPreview.src.endsWith('mobile-topbar-default.png'));
 console.log('Top bar editor passed: load, crop, preview, scoped publish, cancel and restore.');
})().catch(error=>{console.error(error);process.exitCode=1});
