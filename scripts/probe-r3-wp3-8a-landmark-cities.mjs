import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.R3_WP38A_ORIGIN ?? 'http://127.0.0.1:4173';
const outputDir = process.env.R3_WP38A_ARTIFACTS ?? 'artifacts/r3-wp3-8a';
const cities = [
  { id:'N-LONDON', slug:'london', variant:'london', position:[-0.1276,51.5072], assetId:'wp3.8a-v2-london-selected', landmarks:['Elizabeth Tower / Big Ben','Palace of Westminster'], minimumFaces:3000, bearing:-18 },
  { id:'N-PARIS', slug:'paris', variant:'paris', position:[2.3522,48.8566], assetId:'wp3.8a-v2-paris-selected', landmarks:['Eiffel Tower','Arc de Triomphe'], minimumFaces:4500, bearing:16 },
  { id:'N-BRUSSELS', slug:'brussels', variant:'brussels', position:[4.3517,50.8503], assetId:'wp3.8a-v2-brussels-selected', landmarks:['Atomium','Brussels Town Hall / Grand-Place spire'], minimumFaces:4000, bearing:-12 }
];

fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});

async function jump(city,lod){
  const camera=lod==='campaign'?{zoom:5.35,pitch:51,bearing:-9}:{zoom:8.1,pitch:50,bearing:city.bearing};
  await page.evaluate(({position,camera})=>{const map=window.__r3TerrainMap;if(!map)throw new Error('terrain map diagnostic unavailable');map.jumpTo({center:position,...camera});},{position:city.position,camera});
  await page.waitForFunction(({id,assetId,lod})=>{const d=window.__r3WorldMiniatures,o=d?.objects.find(x=>x.id===id);return d?.lod===lod&&o?.visible&&o.assetStatus==='ready'&&o.assetId===assetId&&o.presentationModel==='authored-gltf';},{id:city.id,assetId:city.assetId,lod},{timeout:20000});
  await page.waitForTimeout(350);
}

async function observe(city){
  return page.evaluate(({id})=>{const d=window.__r3WorldMiniatures,nodes=window.__r3StrategicNodes??[];if(!d)throw new Error('world miniature diagnostic unavailable');const o=d.objects.find(x=>x.id===id),n=nodes.find(x=>x.id===id);if(!o||!n)throw new Error(`missing city diagnostic ${id}`);return {...o,lod:d.lod,anchorErrorDegrees:Math.hypot(o.position[0]-n.position[0],o.position[1]-n.position[1])};},{id:city.id});
}

function assertCity(city,o,lod){
  if(!o.visible||o.lod!==lod)throw new Error(`${city.slug} is not visible at ${lod} LOD`);
  if(o.cityVariant!==city.variant)throw new Error(`${city.slug} variant mismatch: ${o.cityVariant}`);
  if(o.assetStatus!=='ready'||o.presentationModel!=='authored-gltf')throw new Error(`${city.slug} did not use authored glTF at ${lod}: ${JSON.stringify(o)}`);
  if(o.assetId!==city.assetId||o.authoredFaceCount<city.minimumFaces)throw new Error(`${city.slug} authored detail contract failed: ${JSON.stringify(o)}`);
  if(o.anchorErrorDegrees!==0)throw new Error(`${city.slug} geographic anchor changed`);
  if(!Number.isFinite(o.elevation)||o.clearance!==22)throw new Error(`${city.slug} terrain grounding changed`);
  if(JSON.stringify(o.landmarks)!==JSON.stringify(city.landmarks))throw new Error(`${city.slug} landmark metadata mismatch: ${JSON.stringify(o.landmarks)}`);
}

try{
  await page.addInitScript(()=>{localStorage.setItem('future-conquest:intro-seen:v3','true');localStorage.setItem('future-conquest-tutorial-seen-v1','true');});
  await page.goto(`${origin}/?terrain=1`,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'BEGIN CAMPAIGN',exact:true}).click();
  await page.locator('.startup-game-shell').waitFor({state:'visible'});
  await page.locator('[data-command-view="map"]').click();
  const host=page.locator('.r3-terrain-prototype');
  await host.waitFor({state:'visible',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('.r3-terrain-prototype')?.getAttribute('data-status')==='ready'&&Boolean(window.__r3WorldMiniatures)&&Boolean(window.__r3TerrainMap),null,{timeout:45000});

  const layerControl=page.locator('details.r3-terrain-layer-control');
  await layerControl.evaluate(el=>{el.open=true;});
  // These historical landmark probes validate layer state, not pointer hit-testing.
  // Use the checkbox's own DOM click so unrelated notification overlays cannot
  // prevent the probe from reaching the landmark assertions.
  for(const label of ['Friendly formations','Operations, threats and fronts','Ports']){const toggle=layerControl.getByLabel(label,{exact:true});if(await toggle.isChecked())await toggle.evaluate(element=>element.click());}
  await layerControl.evaluate(el=>{el.open=false;});
  await page.addStyleTag({content:'[data-r3-marker-id] { visibility: hidden !important; }'});

  const evidence={schemaVersion:7,cities:{}};
  for(const city of cities){
    await jump(city,'campaign');const campaign=await observe(city);assertCity(city,campaign,'campaign');await host.screenshot({path:`${outputDir}/${city.slug}-authored-campaign.png`});
    await jump(city,'selected');const selected=await observe(city);assertCity(city,selected,'selected');await host.screenshot({path:`${outputDir}/${city.slug}-authored-selected.png`});
    evidence.cities[city.slug]={campaign,selected};
  }

  const fallbackCity=cities[0];
  await page.evaluate(({position})=>{const map=window.__r3TerrainMap;if(!map)throw new Error('terrain map diagnostic unavailable');map.jumpTo({center:position,zoom:4.45,pitch:44,bearing:0});},{position:fallbackCity.position});
  await page.waitForFunction(({id})=>{const d=window.__r3WorldMiniatures,o=d?.objects.find(x=>x.id===id);return d?.lod==='theatre'&&o?.visible&&o.presentationModel==='procedural-fallback';},{id:fallbackCity.id},{timeout:20000});
  await page.waitForTimeout(300);
  const theatre=await observe(fallbackCity);
  if(theatre.cityVariant!=='london'||theatre.presentationModel!=='procedural-fallback'||theatre.anchorErrorDegrees!==0||theatre.clearance!==22||!Number.isFinite(theatre.elevation))throw new Error(`Pass 1 Theatre fallback changed: ${JSON.stringify(theatre)}`);
  evidence.theatreFallback=theatre;
  fs.writeFileSync(`${outputDir}/evidence.json`,`${JSON.stringify(evidence,null,2)}\n`);
  console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();}
