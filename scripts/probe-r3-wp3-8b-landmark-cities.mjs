import fs from 'node:fs';
import { chromium } from 'playwright';

const origin=process.env.R3_WP38B_ORIGIN ?? 'http://127.0.0.1:4173';
const outputDir=process.env.R3_WP38B_ARTIFACTS ?? 'artifacts/r3-wp3-8b';
const cities=[
  {id:'N-AMSTERDAM',name:'Amsterdam',variant:'amsterdam',position:[4.9041,52.3676],assetId:'wp3.8b-amsterdam-selected',minimumFaces:1700,landmarks:['Amsterdam canal-house gables','Westerkerk-style tower'],rotation:-8},
  {id:'N-FRANKFURT',name:'Frankfurt',variant:'frankfurt',position:[8.6821,50.1109],assetId:'wp3.8b-frankfurt-selected',minimumFaces:2200,landmarks:['Main Tower-style modern skyline','Römer historic frontage'],rotation:10},
  {id:'N-BERN',name:'Bern',variant:'bern',position:[7.4474,46.948],assetId:'wp3.8b-bern-selected',minimumFaces:1600,landmarks:['Zytglogge clock tower','Federal Palace dome'],rotation:-12}
];

fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});

async function observe(city,lod){
  return page.evaluate(({id,expectedLod})=>{const diagnostic=window.__r3WorldMiniatures;const nodes=window.__r3StrategicNodes??[];if(!diagnostic)throw new Error('world-miniature diagnostic unavailable');const object=diagnostic.objects.find(candidate=>candidate.id===id);const node=nodes.find(candidate=>candidate.id===id);if(!object||!node)throw new Error(`missing city diagnostic ${id}`);return {...object,lod:diagnostic.lod,expectedLod,anchorErrorDegrees:Math.hypot(object.position[0]-node.position[0],object.position[1]-node.position[1])};},{id:city.id,expectedLod:lod});
}
function validate(city,observed,lod){
  if(!observed.visible||observed.lod!==lod)throw new Error(`${city.name} is not visible at ${lod} LOD: ${JSON.stringify(observed)}`);
  if(observed.cityVariant!==city.variant)throw new Error(`${city.name} variant mismatch: ${observed.cityVariant}`);
  if(observed.assetStatus!=='ready'||observed.presentationModel!=='authored-gltf')throw new Error(`${city.name} did not use authored glTF at ${lod}: ${JSON.stringify(observed)}`);
  if(observed.assetId!==city.assetId||observed.authoredFaceCount<city.minimumFaces)throw new Error(`${city.name} asset identity/detail contract failed: ${JSON.stringify(observed)}`);
  if(observed.anchorErrorDegrees!==0)throw new Error(`${city.name} geographic anchor changed`);
  if(!Number.isFinite(observed.elevation)||observed.clearance!==22)throw new Error(`${city.name} terrain grounding changed`);
  if(JSON.stringify(observed.landmarks)!==JSON.stringify(city.landmarks))throw new Error(`${city.name} landmark metadata mismatch: ${JSON.stringify(observed.landmarks)}`);
}

try{
  await page.addInitScript(()=>{localStorage.setItem('future-conquest:intro-seen:v3','true');localStorage.setItem('future-conquest-tutorial-seen-v1','true');});
  await page.goto(`${origin}/?terrain=1`,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'BEGIN CAMPAIGN',exact:true}).click();
  await page.locator('.startup-game-shell').waitFor({state:'visible'});
  await page.locator('[data-command-view="map"]').click();
  const host=page.locator('.r3-terrain-prototype');await host.waitFor({state:'visible',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('.r3-terrain-prototype')?.getAttribute('data-status')==='ready'&&Boolean(window.__r3WorldMiniatures)&&Boolean(window.__r3TerrainMap),null,{timeout:45000});
  const layerControl=page.locator('details.r3-terrain-layer-control');await layerControl.evaluate(element=>{element.open=true;});
  for(const label of ['Friendly formations','Operations, threats and fronts','Ports']){const toggle=layerControl.getByLabel(label,{exact:true});if(await toggle.isChecked())await toggle.evaluate(element=>element.click());}
  await layerControl.evaluate(element=>{element.open=false;});await page.addStyleTag({content:'[data-r3-marker-id] { visibility: hidden !important; }'});

  const evidence={schemaVersion:3,cities:{}};
  for(const city of cities){
    await page.evaluate(({position,rotation})=>{const map=window.__r3TerrainMap;if(!map)throw new Error('terrain map diagnostic unavailable');map.jumpTo({center:position,zoom:5.35,pitch:51,bearing:rotation});},city);
    await page.waitForFunction(({id,assetId})=>{const d=window.__r3WorldMiniatures,o=d?.objects.find(candidate=>candidate.id===id);return d?.lod==='campaign'&&o?.assetStatus==='ready'&&o?.assetId===assetId&&o?.presentationModel==='authored-gltf';},{id:city.id,assetId:city.assetId},{timeout:20000});
    await page.waitForTimeout(350);const campaign=await observe(city,'campaign');validate(city,campaign,'campaign');await host.screenshot({path:`${outputDir}/${city.name.toLowerCase()}-authored-campaign.png`});
    await page.evaluate(({position,rotation})=>{const map=window.__r3TerrainMap;if(!map)throw new Error('terrain map diagnostic unavailable');map.jumpTo({center:position,zoom:8.1,pitch:50,bearing:rotation-8});},city);
    await page.waitForFunction(({id,assetId})=>{const d=window.__r3WorldMiniatures,o=d?.objects.find(candidate=>candidate.id===id);return d?.lod==='selected'&&o?.assetStatus==='ready'&&o?.assetId===assetId&&o?.presentationModel==='authored-gltf';},{id:city.id,assetId:city.assetId},{timeout:20000});
    await page.waitForTimeout(350);const selected=await observe(city,'selected');validate(city,selected,'selected');await host.screenshot({path:`${outputDir}/${city.name.toLowerCase()}-authored-selected.png`});evidence.cities[city.variant]={campaign,selected};
  }

  const fallbackCity=cities[0];
  await page.evaluate(({position})=>{const map=window.__r3TerrainMap;if(!map)throw new Error('terrain map diagnostic unavailable');map.jumpTo({center:position,zoom:4.45,pitch:44,bearing:0});},{position:fallbackCity.position});
  await page.waitForFunction(({id})=>{const d=window.__r3WorldMiniatures,o=d?.objects.find(candidate=>candidate.id===id);return d?.lod==='theatre'&&o?.visible&&o?.presentationModel==='procedural-fallback';},{id:fallbackCity.id},{timeout:20000});
  await page.waitForTimeout(300);const theatre=await observe(fallbackCity,'theatre');
  if(theatre.cityVariant!=='amsterdam'||theatre.presentationModel!=='procedural-fallback'||theatre.anchorErrorDegrees!==0||theatre.clearance!==22||!Number.isFinite(theatre.elevation))throw new Error(`Pass 2 Theatre fallback changed: ${JSON.stringify(theatre)}`);
  evidence.theatreFallback=theatre;
  fs.writeFileSync(`${outputDir}/evidence.json`,`${JSON.stringify(evidence,null,2)}\n`);console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();}
