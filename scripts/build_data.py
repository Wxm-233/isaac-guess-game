"""Build the local Repentance+ dataset from preserved game and EID snapshots."""
import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw'
VERSION = 'repentance-plus-1.9.7.17-demo-2'
GAME_VERSION = '忏悔+ 1.9.7.17'
POOLS = {'treasure':'宝箱房','shop':'商店','boss':'头目房','devil':'恶魔房','angel':'天使房','secret':'隐藏房','library':'图书馆','shellGame':'贝壳游戏','goldenChest':'金箱子','redChest':'红箱子','beggar':'乞丐','demonBeggar':'恶魔乞丐','curse':'诅咒房','keyMaster':'钥匙大师','batteryBum':'电池乞丐','momsChest':'妈妈的箱子','craneGame':'夹娃娃机','ultraSecret':'究极隐藏房','bombBum':'炸弹乞丐','planetarium':'星象房','oldChest':'旧箱子','babyShop':'宝宝商店','woodenChest':'木箱子','rottenBeggar':'腐烂乞丐'}
TAGS = {'guppy':'嗝屁猫','book':'书本','mom':'妈妈','mushroom':'蘑菇','syringe':'针筒','fly':'苍蝇','baby':'宝宝','angel':'天使','devil':'恶魔','bob':'鲍勃','spider':'蜘蛛','poop':'便便','food':'食物','tech':'科技','battery':'电池','dead':'死亡','stars':'星星','quest':'任务', 'offensive':'攻击性'}
ALIASES = {int(i): aliases for i, aliases in json.loads((ROOT/'data/aliases.json').read_text()).items()}
CHARACTERS = {
    'Isaac': ('isaac', '以撒'), 'Magdalene': ('magdalene', '抹大拉'),
    'Cain': ('cain', '该隐'), 'Judas': ('judas', '犹大'), '???': ('blue_baby', '???'),
    'Eve': ('eve', '夏娃'), 'Samson': ('samson', '参孙'), 'Azazel': ('azazel', '阿撒泻勒'),
    'Lazarus': ('lazarus', '拉撒路'), 'Eden': ('eden', '伊甸'),
    'The Lost': ('lost', '游魂'), 'Lost': ('lost', '游魂'),
    'Lilith': ('lilith', '莉莉丝'), 'Keeper': ('keeper', '店主'),
    'Apollyon': ('apollyon', '亚玻伦'), 'Bethany': ('bethany', '伯大尼'),
    'The Forgotten': ('forgotten', '遗骸'), 'Forgotten': ('forgotten', '遗骸'),
    'Jacob and Esau': ('jacob', '雅各与以扫'), 'Jacob': ('jacob', '雅各'),
}

def unlock_info(achievement, achievements):
    if not achievement:
        return {'kind': 'none', 'achievement': None}
    # Use the full condition, not the upstream character heuristic: it mistakes
    # "every character" for Eve. Boss names and generic "Isaac" are not requirements.
    condition = achievements[achievement]['unlock']['text']
    match = re.search(r'\bas (.+)$', condition)
    if not match or match[1].startswith('every character'):
        return {'kind': 'other', 'achievement': achievement}
    character = match[1]
    tainted = character.startswith('Tainted ')
    if tainted: character = character.removeprefix('Tainted ')
    if character not in CHARACTERS:
        raise ValueError(f'Unknown unlock character for achievement {achievement}: {character}')
    family, name = CHARACTERS[character]
    return {'kind': 'character', 'character': family, 'name': name,
            'tainted': tainted, 'achievement': achievement}

def names():
    text = (RAW / 'names_zh.lua').read_text()
    return {int(i):(zh,en.strip()) for i,zh,en in re.findall(r'\[C_ID \.\. (\d+)\] = "([^"]*)",\s*--([^\n]*)',text)}

def descriptions():
    result = {}
    sections = [
        ('descriptions_base_zh.lua', 'EID.descriptions[languageCode].collectibles={'),
        ('descriptions_zh.lua', 'local repCollectibles={'),
        ('descriptions_repplus_zh.lua', 'local collectibles = {'),
    ]
    for filename, marker in sections:
        text = (RAW / filename).read_text()
        # Collectibles are the first section. Other sections also use numeric IDs.
        text = text.split(marker,1)[1].split('\n}',1)[0]
        entries = re.findall(r'\{\s*"(\d+)",\s*"[^"\n]*",\s*"((?:\\.|[^"\\])*)"\s*\}',text)
        if not entries: raise ValueError(f'No collectible descriptions found in {filename}')
        for i,desc in entries:
            desc = re.sub(r'\{\{Quality([0-4])\}\}', r'品质\1', desc)
            clean = re.sub(r'\{\{.*?\}\}', '', desc).replace('#','；').replace('\\"','"')
            result[int(i)] = clean.strip()
    return result

def build():
    ns, ds = names(), descriptions()
    pinyin_file=ROOT/'data/pinyin.json'
    pinyin=json.loads(pinyin_file.read_text()) if pinyin_file.exists() else {}
    meta = {int(e.attrib['id']):e.attrib for e in ET.parse(RAW/'items_metadata.xml').getroot() if e.tag=='item'}
    community = {x['game_id']:x for x in json.loads((RAW/'community_items.json').read_text())}
    achievements = {x['id']:x for x in json.loads((RAW/'achievements.json').read_text())['achievements']}
    pools = {}
    for pool in ET.parse(RAW/'itempools.xml').getroot():
        name = pool.get('Name')
        if name.startswith('greed'): continue
        if name not in POOLS: raise ValueError(f'Unknown normal-mode item pool: {name}')
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
            'charge':charge,'unlock':unlock_info(int(e.get('achievement','0')), achievements),
            'image':image,'description':ds.get(i,''),**pinyin.get(str(i),{})})
    assert len(items)==717, len(items)
    assert all(x['name'] and 0<=x['quality']<=4 for x in items)
    missing=[x['id'] for x in items if not x['image'] or not (ROOT/'public'/x['image'].lstrip('/')).exists()]
    if missing: raise ValueError(f'Missing icons: {missing}')
    output={'version':VERSION,'gameVersion':GAME_VERSION,'items':items}
    (ROOT/'public/data').mkdir(exist_ok=True)
    (ROOT/'public/data/items.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f'Built {len(items)} items, {sum(bool(x["description"]) for x in items)} Chinese descriptions.')

if __name__=='__main__': build()
