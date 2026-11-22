import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const root=process.cwd(),moduleRoot=process.env.A11Y_NODE_MODULES;
if(!moduleRoot)throw new Error("A11Y_NODE_MODULES must point to the temporary test dependencies.");
const require=createRequire(path.join(moduleRoot,"package.json"));
const {chromium}=require("playwright");
const axeModule=require("@axe-core/playwright");
const AxeBuilder=axeModule.default||axeModule;
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png"};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  const requested=pathname==="/"?"index.html":pathname.replace(/^\\/+ /,"").replace(/^\\//,"");
  const file=path.resolve(root,requested);
  if(!file.startsWith(root+path.sep)&&file!==path.join(root,"index.html")){res.writeHead(403).end("Forbidden");return}
  const body=await readFile(file);res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});res.end(body);
 }catch{res.writeHead(404).end("Not found")}
});
await new Promise(resolve=>server.listen(4173,"127.0.0.1",resolve));
const browser=await chromium.launch({headless:true});let failed=false;
try{
 for(const route of ["/index.html","/privacy.html","/download.html","/admin.html"]){
  const page=await browser.newPage({viewport:{width:1365,height:900}});
  await page.goto("http://127.0.0.1:4173"+route,{waitUntil:"domcontentloaded",timeout:30000});
  if(route==="/index.html"){const enter=page.locator("#welcomeEnterBtn");if(await enter.isVisible().catch(()=>false))await enter.click()}
  const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
  console.log("\\n"+route+": "+results.violations.length+" axe violation(s)");
  for(const v of results.violations){failed=true;console.error("- "+v.id+" ["+v.impact+"]: "+v.help);for(const node of v.nodes.slice(0,5))console.error("  "+node.target.join(", ")+" — "+(node.failureSummary||"").replace(/\\s+/g," ").slice(0,220))}
  await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
if(failed)process.exitCode=1;else console.log("\\nAll axe WCAG 2.0/2.1/2.2 A/AA checks passed.");
