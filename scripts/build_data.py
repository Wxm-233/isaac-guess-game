"""Build the local Repentance 1.7.9b dataset from preserved public snapshots."""
import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw'
POOLS = {'treasure':'宝箱房','shop':'商店','boss':'头目房','devil':'恶魔房','angel':'天使房','secret':'隐藏房','library':'图书馆','shellGame':'贝壳游戏','goldenChest':'金箱子','redChest':'红箱子','beggar':'乞丐','demonBeggar':'恶魔乞丐','curse':'诅咒房','keyMaster':'钥匙大师','batteryBum':'电池乞丐','momsChest':'妈妈的箱子','craneGame':'夹娃娃机','ultraSecret':'究极隐藏房','bombBum':'炸弹乞丐','planetarium':'星象房','oldChest':'旧箱子','babyShop':'宝宝商店','woodenChest':'木箱子','rottenBeggar':'腐烂乞丐'}
TAGS = {'guppy':'嗝屁猫','book':'书本','mom':'妈妈','mushroom':'蘑菇','syringe':'针筒','fly':'苍蝇','baby':'宝宝','angel':'天使','devil':'恶魔','bob':'鲍勃','spider':'蜘蛛','poop':'便便','food':'食物','tech':'科技','battery':'电池','dead':'死亡','stars':'星星','quest':'任务'}
ALIASES = {int(i): aliases for i, aliases in json.loads((ROOT/'data/aliases.json').read_text()).items()}

def names():
    text = (RAW / 'names_zh.lua').read_text()
    return {int(i):(zh,en.strip()) for i,zh,en in re.findall(r'\[C_ID \.\. (\d+)\] = "([^"]*)",\s*--([^\n]*)',text)}

def descriptions():
    result = {}
    for filename in ['descriptions_base_zh.lua','descriptions_zh.lua']:
        text = (RAW / filename).read_text()
        # Collectibles are the first section. Other sections also use numeric IDs.
        if filename == 'descriptions_base_zh.lua':
            text = text.split('EID.descriptions[languageCode].collectibles={',1)[1].split('\n}',1)[0]
        else:
            text = text.split('local repCollectibles={',1)[1].split('\n}',1)[0]
        for i,desc in re.findall(r'\{"(\d+)",\s*"[^"\n]*",\s*"((?:\\.|[^"\\])*)"\}',text):
            clean = re.sub(r'\{\{.*?\}\}', '', desc).replace('#','；').replace('\\"','"')
            result[int(i)] = clean.strip()
    return result

def build():
    ns, ds = names(), descriptions()
    pinyin_file=ROOT/'data/pinyin.json'
    pinyin=json.loads(pinyin_file.read_text()) if pinyin_file.exists() else {}
    meta = {int(e.attrib['id']):e.attrib for e in ET.parse(RAW/'items_metadata.xml').getroot() if e.tag=='item'}
    community = {x['game_id']:x for x in json.loads((RAW/'community_items.json').read_text())}
    pools = {}
    for pool in ET.parse(RAW/'itempools.xml').getroot():
        if pool.get('Name') not in POOLS: continue
        for item in pool:
            if float(item.get('Weight','1')) > 0:
                pools.setdefault(int(item.get('Id')),set()).add(POOLS[pool.get('Name')])
    items=[]
    for e in ET.parse(RAW/'items.xml').getroot():
        if e.tag not in ('active','passive','familiar') or e.get('hidden')=='true': continue
        i=int(e.get('id')); m=meta[i]; zh,en=ns[i]; c=community.get(i,{})
        charge = None
        if e.tag=='active':
            kind=e.get('chargetype','normal'); value=int(e.get('maxcharges','0'))
            charge={'kind':kind,'value':value}
        image = c.get('local_image','').replace('/images/items/','/assets/items/')
        items.append({'id':i,'name':zh,'english':en,'aliases':ALIASES.get(i,[]),'quality':int(m['quality']),
            'type':e.tag,'pools':sorted(pools.get(i,[])),
            'tags':sorted({TAGS[t] for t in m.get('tags','').split() if t in TAGS}),
            'charge':charge,'unlock':int(e.get('achievement','0'))>0,
            'image':image,'description':ds.get(i,''),**pinyin.get(str(i),{})})
    assert len(items)==717, len(items)
    assert all(x['name'] and 0<=x['quality']<=4 for x in items)
    missing=[x['id'] for x in items if not x['image'] or not (ROOT/'public'/x['image'].lstrip('/')).exists()]
    if missing: raise ValueError(f'Missing icons: {missing}')
    output={'version':'repentance-1.7.9b-demo-1','gameVersion':'忏悔 1.7.9b','items':items}
    (ROOT/'public/data').mkdir(exist_ok=True)
    (ROOT/'public/data/items.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f'Built {len(items)} items, {sum(bool(x["description"]) for x in items)} Chinese descriptions.')

if __name__=='__main__': build()
