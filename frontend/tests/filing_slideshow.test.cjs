const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const titles = ['Lead the Change','Your Voice, Your Run','Ready to Serve?','Be on the Ballot','Make It Official'];
const defaults = titles.map((title,index)=>({id:'default-'+index,default_index:index,title,subtitle:'Provided description '+index,image_url:null,use_default_text:true}));
const nodes = {}, calls = [];
function node() {return {value:'',files:[],options:[],children:[],handlers:{},addEventListener(name,fn){this.handlers[name]=fn},setAttribute(){},getAttribute(name){return this[name]},replaceChildren(){this.children=[];this.options=[]},append(child){this.children.push(child);this.options.push(child)},querySelectorAll(){return []}}}
const code = fs.readFileSync(path.join(__dirname,'../org_elecom/elecom_admin/admin_components/admin_js/election_appearance.js'),'utf8');
const context = {console,URL,URLSearchParams,FormData,setInterval:()=>1,clearInterval:()=>{}, window:{location:{search:''},crypto:{randomUUID:()=> 'new-slide'},confirm:()=>true,addEventListener(){}}, document:{getElementById:id=>nodes[id] ||= node(),createElement:()=>node()},fetch:async(url,options={})=>{
 calls.push({url,options});
 if(url==='/api/admin/elections/')return {ok:true,json:async()=>({ok:true,elections:[{id:7,name:'Current election',is_active:true}]})};
 const slides=options.method==='POST'?JSON.parse(options.body.get('slides')):defaults;
 return {ok:true,json:async()=>({ok:true,csrfToken:'test-only',slides:structuredClone(slides),defaults:structuredClone(defaults)})};
}};
vm.runInNewContext(code,context);
const tick = () => new Promise(resolve=>setTimeout(resolve,0));
(async()=>{
 await tick();
 assert.equal(nodes.filingSlideList.children.length,5);
 assert.equal(nodes.appearanceElectionSelect.value,'7');
 nodes.filingUseDefaultText.checked=false;nodes.filingUseDefaultText.handlers.change();
 nodes.filingSlideTitle.value='Custom headline';nodes.filingSlideTitle.handlers.input();
 assert.equal(nodes.filingPreviewTitle.textContent,'Custom headline');
 nodes.addFilingSlide.handlers.click();
 assert.equal(nodes.filingSlideList.children.length,6);
 nodes.moveFilingSlideUp.handlers.click();
 await nodes.filingAppearanceForm.handlers.submit({preventDefault(){}});
 const sent=calls.find(call=>call.options.method==='POST');
 const slides=JSON.parse(sent.options.body.get('slides'));
 assert.equal(slides.length,6);assert.equal(slides[0].title,'Custom headline');
 assert.equal(slides[0].use_default_text,false);assert.equal(slides[4].id,'slide-new-slide');
 assert.equal(sent.url,'/api/admin/elections/7/appearance/');
 await nodes.resetFilingAppearance.handlers.click();
 assert.equal(nodes.filingSlideList.children.length,5);
 assert.equal(nodes.filingPreviewTitle.textContent,'Lead the Change');
 console.log('Slideshow editor tests passed: defaults, custom text, add, reorder, publish scope, restore.');
})().catch(error=>{console.error(error);process.exitCode=1});
