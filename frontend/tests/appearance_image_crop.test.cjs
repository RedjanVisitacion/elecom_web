const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const nodes={},draws=[];
const node=()=>({handlers:{},value:'1',addEventListener(name,fn){this.handlers[name]=fn},removeEventListener(name){delete this.handlers[name]},focus(){},getBoundingClientRect(){return {width:800,height:360}},setPointerCapture(){}});
const context={fillRect(){},drawImage(...args){draws.push(args)}};
const canvas=nodes.appearanceCropCanvas=node(); canvas.getContext=()=>context;canvas.toBlob=fn=>fn(new Blob(['cropped'],{type:'image/jpeg'}));
const window={};
class Image {constructor(){this.naturalWidth=2400;this.naturalHeight=1600}set src(value){this.onload()}}
const sandbox={window,Image,File,URL:{createObjectURL:()=> 'blob:local',revokeObjectURL(){}},document:{getElementById:id=>nodes[id] ||=node(),activeElement:node()},bootstrap:{Modal:class{constructor(el){this.el=el}show(){}hide(){this.el.handlers['hidden.bs.modal']()}}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../org_elecom/elecom_admin/admin_components/admin_js/appearance_image_crop.js'),'utf8'),sandbox);
(async()=>{
 const original=new File(['source'],'source.png',{type:'image/png'});
 const first=window.ElecomImageCrop(original,'filing');
 assert.equal(canvas.width,1600);assert.equal(canvas.height,720);
 nodes.appearanceCropZoom.value='2';nodes.appearanceCropZoom.handlers.input();
 const before=draws.at(-1)[1];canvas.handlers.keydown({key:'ArrowRight',preventDefault(){}});assert.ok(draws.at(-1)[1]>before);
 nodes.appearanceCropApply.handlers.click();const cropped=await first;
 assert.equal(cropped.type,'image/jpeg');assert.equal(cropped.name,'source-cropped.jpg');
 const second=window.ElecomImageCrop(original,'omnibus');assert.equal(canvas.width,1131);assert.equal(canvas.height,1600);
 nodes.appearanceCropOriginal.handlers.click();assert.equal(await second,original);
 const header=window.ElecomImageCrop(original,'topbar');assert.equal(canvas.width,1560);assert.equal(canvas.height,680);nodes.appearanceCropApply.handlers.click();await header;
 const third=window.ElecomImageCrop(original);nodes.appearanceCropModal.handlers['hidden.bs.modal']();assert.equal(await third,null);
 console.log('Crop checks passed: filing frame, zoom, keyboard positioning, JPEG output, portrait/full image, cancel.');
})().catch(error=>{console.error(error);process.exitCode=1});
