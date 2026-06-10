(() => {
  if (window.__sheepMapRestoreLoaded) return;
  window.__sheepMapRestoreLoaded = true;
  const 地图卸载函数列表 = [];
  function 注册地图卸载(卸载函数) {
    if (typeof 卸载函数 === 'function') 地图卸载函数列表.push(卸载函数);
  }
  function 注册地图事件(目标, 事件名, 处理函数, 选项) {
    if (!目标 || typeof 目标.addEventListener !== 'function') return;
    目标.addEventListener(事件名, 处理函数, 选项);
    注册地图卸载(() => 目标.removeEventListener(事件名, 处理函数, 选项));
  }
  function 注册地图元素事件(元素, 标记名, 事件名, 处理函数, 选项) {
    if (!元素 || typeof 元素.addEventListener !== 'function') return;
    元素.addEventListener(事件名, 处理函数, 选项);
    注册地图卸载(() => {
      元素.removeEventListener(事件名, 处理函数, 选项);
      if (标记名 && 元素.dataset) delete 元素.dataset[标记名];
    });
  }
  window.__sheepMapDispose = () => {
    try {
      if (typeof 关闭地图维护右键菜单 === 'function') 关闭地图维护右键菜单();
    } catch (错误) {}
    while (地图卸载函数列表.length) {
      try {
        地图卸载函数列表.pop()();
      } catch (错误) {}
    }
    window.__sheepMapRestoreLoaded = false;
  };

  const WORLD_IMAGE_WIDTH = 3174;
  const WORLD_IMAGE_HEIGHT = 2246;
  const DEFAULT_IMAGE_BOUNDS = { minX: 0, minY: 0, width: WORLD_IMAGE_WIDTH, height: WORLD_IMAGE_HEIGHT };
  const MAP_COORD_SYSTEM_IMAGE = 'image';
  const ASSETS = {
    world: encodeURI('https://cdn.jsdelivr.net/gh/sasajyunainui/lwcs@main/MAP.webp')
  };

  const SMALL_SETTLEMENT_NAMES = new Set(['傲来城', '上陵城', '海陆城', '烈火盆地']);
  const SUPER_CITY_NAMES = new Set(['明都', '史莱克城']);
  const MAJOR_CITY_NAMES = new Set(['天斗城', '星罗城']);
  const CAPITAL_NAMES = new Set(['明都', '史莱克城', '史莱克新城', '星罗城']);
  const CITY_NAMES = new Set(['东海城', '天海城', '北海城', '天斗城', '灵波城']);

  const mapLayerLabels = { continent: '大陆级', city: '城市级', facility: '设施级' };
  const mapZoomTargets = { continent: 1.0, city: 1.55, facility: 2.8 };
  const DEFAULT_MAP_ZOOM = 1;
  const MIN_MAP_ZOOM = 0.35;
  const MAX_MAP_ZOOM = 3.2;
  const WORLD_MAP_RENDER_ZOOM_FACTOR = 10;
  const SUBMAP_RENDER_ZOOM_FACTOR = 1;
  const MAP_NODE_SNAP_RATIO_THRESHOLD = 0.028;

  function cloneJsonValue(值, 回退值 = {}) {
    if (值 === undefined) return 回退值;
    try {
      return JSON.parse(JSON.stringify(值));
    } catch (错误) {
      return 回退值;
    }
  }

  const worldTerrainColorSamplerState = {
    image: null,
    canvas: null,
    ctx: null,
    ready: false,
    loading: false,
    failed: false
  };

  const WORLD_TERRAIN_CELL_OVERRIDES = {
    // generated from terrain_paint_export.json (2026-04-07T09:09:14.054Z)
    '53,0': ['glacier', '冰川'],
    '54,0': ['glacier', '冰川'],
    '55,0': ['glacier', '冰川'],
    '56,0': ['glacier', '冰川'],
    '57,0': ['glacier', '冰川'],
    '58,0': ['glacier', '冰川'],
    '59,0': ['glacier', '冰川'],
    '60,0': ['glacier', '冰川'],
    '61,0': ['glacier', '冰川'],
    '62,0': ['glacier', '冰川'],
    '63,0': ['glacier', '冰川'],
    '64,0': ['glacier', '冰川'],
    '65,0': ['glacier', '冰川'],
    '66,0': ['glacier', '冰川'],
    '67,0': ['glacier', '冰川'],
    '68,0': ['glacier', '冰川'],
    '69,0': ['glacier', '冰川'],
    '70,0': ['glacier', '冰川'],
    '71,0': ['glacier', '冰川'],
    '72,0': ['glacier', '冰川'],
    '73,0': ['glacier', '冰川'],
    '51,1': ['glacier', '冰川'],
    '52,1': ['glacier', '冰川'],
    '53,1': ['glacier', '冰川'],
    '54,1': ['glacier', '冰川'],
    '55,1': ['glacier', '冰川'],
    '56,1': ['glacier', '冰川'],
    '57,1': ['glacier', '冰川'],
    '58,1': ['glacier', '冰川'],
    '59,1': ['glacier', '冰川'],
    '60,1': ['glacier', '冰川'],
    '61,1': ['glacier', '冰川'],
    '62,1': ['glacier', '冰川'],
    '63,1': ['glacier', '冰川'],
    '64,1': ['glacier', '冰川'],
    '66,1': ['highmountain', '高山'],
    '67,1': ['highmountain', '高山'],
    '68,1': ['highmountain', '高山'],
    '69,1': ['glacier', '冰川'],
    '70,1': ['glacier', '冰川'],
    '71,1': ['glacier', '冰川'],
    '72,1': ['glacier', '冰川'],
    '51,2': ['glacier', '冰川'],
    '52,2': ['glacier', '冰川'],
    '53,2': ['glacier', '冰川'],
    '54,2': ['glacier', '冰川'],
    '55,2': ['glacier', '冰川'],
    '56,2': ['glacier', '冰川'],
    '57,2': ['glacier', '冰川'],
    '58,2': ['glacier', '冰川'],
    '59,2': ['glacier', '冰川'],
    '60,2': ['glacier', '冰川'],
    '61,2': ['glacier', '冰川'],
    '62,2': ['highmountain', '高山'],
    '63,2': ['highmountain', '高山'],
    '64,2': ['highmountain', '高山'],
    '65,2': ['highmountain', '高山'],
    '66,2': ['highmountain', '高山'],
    '67,2': ['highmountain', '高山'],
    '68,2': ['highmountain', '高山'],
    '51,3': ['glacier', '冰川'],
    '52,3': ['glacier', '冰川'],
    '53,3': ['glacier', '冰川'],
    '54,3': ['glacier', '冰川'],
    '55,3': ['glacier', '冰川'],
    '56,3': ['glacier', '冰川'],
    '57,3': ['glacier', '冰川'],
    '58,3': ['glacier', '冰川'],
    '59,3': ['glacier', '冰川'],
    '60,3': ['glacier', '冰川'],
    '62,3': ['highmountain', '高山'],
    '63,3': ['highmountain', '高山'],
    '64,3': ['highmountain', '高山'],
    '65,3': ['highmountain', '高山'],
    '66,3': ['highmountain', '高山'],
    '67,3': ['highmountain', '高山'],
    '68,3': ['highmountain', '高山'],
    '69,3': ['highmountain', '高山'],
    '51,4': ['glacier', '冰川'],
    '52,4': ['glacier', '冰川'],
    '53,4': ['glacier', '冰川'],
    '54,4': ['glacier', '冰川'],
    '55,4': ['glacier', '冰川'],
    '56,4': ['glacier', '冰川'],
    '57,4': ['glacier', '冰川'],
    '58,4': ['glacier', '冰川'],
    '63,4': ['highmountain', '高山'],
    '64,4': ['highmountain', '高山'],
    '65,4': ['highmountain', '高山'],
    '66,4': ['highmountain', '高山'],
    '67,4': ['highmountain', '高山'],
    '68,4': ['highmountain', '高山'],
    '69,4': ['highmountain', '高山'],
    '70,4': ['highmountain', '高山'],
    '30,5': ['plain', '平原'],
    '31,5': ['plain', '平原'],
    '32,5': ['plain', '平原'],
    '34,5': ['plain', '平原'],
    '35,5': ['plain', '平原'],
    '36,5': ['plain', '平原'],
    '37,5': ['plain', '平原'],
    '49,5': ['plain', '平原'],
    '64,5': ['highmountain', '高山'],
    '65,5': ['highmountain', '高山'],
    '66,5': ['highmountain', '高山'],
    '67,5': ['highmountain', '高山'],
    '68,5': ['highmountain', '高山'],
    '69,5': ['highmountain', '高山'],
    '70,5': ['highmountain', '高山'],
    '71,5': ['highmountain', '高山'],
    '72,5': ['highmountain', '高山'],
    '73,5': ['highmountain', '高山'],
    '29,6': ['plain', '平原'],
    '30,6': ['plain', '平原'],
    '31,6': ['plain', '平原'],
    '32,6': ['plain', '平原'],
    '33,6': ['plain', '平原'],
    '34,6': ['plain', '平原'],
    '35,6': ['plain', '平原'],
    '36,6': ['plain', '平原'],
    '37,6': ['plain', '平原'],
    '38,6': ['plain', '平原'],
    '39,6': ['plain', '平原'],
    '40,6': ['plain', '平原'],
    '47,6': ['plain', '平原'],
    '48,6': ['plain', '平原'],
    '49,6': ['plain', '平原'],
    '50,6': ['plain', '平原'],
    '52,6': ['highmountain', '高山'],
    '53,6': ['forest', '森林'],
    '54,6': ['forest', '森林'],
    '55,6': ['forest', '森林'],
    '56,6': ['forest', '森林'],
    '57,6': ['forest', '森林'],
    '66,6': ['highmountain', '高山'],
    '67,6': ['highmountain', '高山'],
    '68,6': ['highmountain', '高山'],
    '69,6': ['highmountain', '高山'],
    '70,6': ['highmountain', '高山'],
    '71,6': ['highmountain', '高山'],
    '72,6': ['highmountain', '高山'],
    '73,6': ['highmountain', '高山'],
    '75,6': ['forest', '森林'],
    '13,7': ['glacier', '冰川'],
    '14,7': ['glacier', '冰川'],
    '15,7': ['glacier', '冰川'],
    '16,7': ['glacier', '冰川'],
    '17,7': ['glacier', '冰川'],
    '18,7': ['glacier', '冰川'],
    '19,7': ['glacier', '冰川'],
    '29,7': ['plain', '平原'],
    '30,7': ['plain', '平原'],
    '31,7': ['plain', '平原'],
    '32,7': ['plain', '平原'],
    '33,7': ['plain', '平原'],
    '34,7': ['plain', '平原'],
    '35,7': ['plain', '平原'],
    '36,7': ['plain', '平原'],
    '37,7': ['plain', '平原'],
    '38,7': ['plain', '平原'],
    '39,7': ['plain', '平原'],
    '44,7': ['plain', '平原'],
    '45,7': ['plain', '平原'],
    '46,7': ['plain', '平原'],
    '47,7': ['plain', '平原'],
    '48,7': ['plain', '平原'],
    '49,7': ['plain', '平原'],
    '51,7': ['highmountain', '高山'],
    '52,7': ['highmountain', '高山'],
    '53,7': ['forest', '森林'],
    '54,7': ['forest', '森林'],
    '55,7': ['forest', '森林'],
    '56,7': ['forest', '森林'],
    '57,7': ['forest', '森林'],
    '59,7': ['highmountain', '高山'],
    '70,7': ['highmountain', '高山'],
    '71,7': ['highmountain', '高山'],
    '72,7': ['forest', '森林'],
    '73,7': ['forest', '森林'],
    '74,7': ['forest', '森林'],
    '75,7': ['forest', '森林'],
    '76,7': ['forest', '森林'],
    '12,8': ['glacier', '冰川'],
    '13,8': ['glacier', '冰川'],
    '14,8': ['glacier', '冰川'],
    '15,8': ['glacier', '冰川'],
    '16,8': ['glacier', '冰川'],
    '17,8': ['glacier', '冰川'],
    '18,8': ['glacier', '冰川'],
    '19,8': ['glacier', '冰川'],
    '30,8': ['plain', '平原'],
    '31,8': ['plain', '平原'],
    '32,8': ['plain', '平原'],
    '33,8': ['plain', '平原'],
    '34,8': ['plain', '平原'],
    '35,8': ['plain', '平原'],
    '36,8': ['plain', '平原'],
    '38,8': ['highmountain', '高山'],
    '39,8': ['highmountain', '高山'],
    '44,8': ['plain', '平原'],
    '45,8': ['plain', '平原'],
    '46,8': ['plain', '平原'],
    '47,8': ['plain', '平原'],
    '50,8': ['highmountain', '高山'],
    '51,8': ['highmountain', '高山'],
    '52,8': ['forest', '森林'],
    '53,8': ['forest', '森林'],
    '54,8': ['forest', '森林'],
    '55,8': ['forest', '森林'],
    '56,8': ['forest', '森林'],
    '57,8': ['highmountain', '高山'],
    '58,8': ['highmountain', '高山'],
    '59,8': ['highmountain', '高山'],
    '72,8': ['forest', '森林'],
    '73,8': ['forest', '森林'],
    '79,8': ['highmountain', '高山'],
    '80,8': ['highmountain', '高山'],
    '11,9': ['glacier', '冰川'],
    '12,9': ['glacier', '冰川'],
    '13,9': ['glacier', '冰川'],
    '14,9': ['glacier', '冰川'],
    '15,9': ['glacier', '冰川'],
    '16,9': ['glacier', '冰川'],
    '17,9': ['glacier', '冰川'],
    '31,9': ['plain', '平原'],
    '32,9': ['plain', '平原'],
    '33,9': ['plain', '平原'],
    '34,9': ['plain', '平原'],
    '38,9': ['highmountain', '高山'],
    '39,9': ['highmountain', '高山'],
    '43,9': ['plain', '平原'],
    '44,9': ['plain', '平原'],
    '45,9': ['plain', '平原'],
    '46,9': ['plain', '平原'],
    '47,9': ['plain', '平原'],
    '50,9': ['highmountain', '高山'],
    '51,9': ['highmountain', '高山'],
    '52,9': ['highmountain', '高山'],
    '53,9': ['forest', '森林'],
    '54,9': ['forest', '森林'],
    '55,9': ['forest', '森林'],
    '56,9': ['highmountain', '高山'],
    '57,9': ['highmountain', '高山'],
    '58,9': ['highmountain', '高山'],
    '59,9': ['highmountain', '高山'],
    '72,9': ['forest', '森林'],
    '78,9': ['highmountain', '高山'],
    '79,9': ['highmountain', '高山'],
    '80,9': ['highmountain', '高山'],
    '81,9': ['highmountain', '高山'],
    '10,10': ['glacier', '冰川'],
    '11,10': ['glacier', '冰川'],
    '12,10': ['glacier', '冰川'],
    '13,10': ['glacier', '冰川'],
    '14,10': ['glacier', '冰川'],
    '15,10': ['glacier', '冰川'],
    '16,10': ['glacier', '冰川'],
    '17,10': ['glacier', '冰川'],
    '38,10': ['highmountain', '高山'],
    '39,10': ['highmountain', '高山'],
    '40,10': ['highmountain', '高山'],
    '41,10': ['highmountain', '高山'],
    '42,10': ['highmountain', '高山'],
    '43,10': ['plain', '平原'],
    '44,10': ['plain', '平原'],
    '45,10': ['plain', '平原'],
    '46,10': ['plain', '平原'],
    '47,10': ['plain', '平原'],
    '50,10': ['highmountain', '高山'],
    '51,10': ['highmountain', '高山'],
    '52,10': ['highmountain', '高山'],
    '53,10': ['forest', '森林'],
    '54,10': ['highmountain', '高山'],
    '55,10': ['highmountain', '高山'],
    '56,10': ['highmountain', '高山'],
    '57,10': ['highmountain', '高山'],
    '64,10': ['forest', '森林'],
    '65,10': ['forest', '森林'],
    '66,10': ['forest', '森林'],
    '67,10': ['forest', '森林'],
    '69,10': ['highmountain', '高山'],
    '70,10': ['mountain', '山地'],
    '73,10': ['mountain', '山地'],
    '78,10': ['highmountain', '高山'],
    '79,10': ['highmountain', '高山'],
    '80,10': ['highmountain', '高山'],
    '81,10': ['forest', '森林'],
    '10,11': ['glacier', '冰川'],
    '11,11': ['glacier', '冰川'],
    '12,11': ['glacier', '冰川'],
    '13,11': ['glacier', '冰川'],
    '14,11': ['glacier', '冰川'],
    '15,11': ['glacier', '冰川'],
    '16,11': ['glacier', '冰川'],
    '18,11': ['highmountain', '高山'],
    '19,11': ['highmountain', '高山'],
    '29,11': ['highmountain', '高山'],
    '37,11': ['highmountain', '高山'],
    '38,11': ['highmountain', '高山'],
    '39,11': ['highmountain', '高山'],
    '40,11': ['highmountain', '高山'],
    '41,11': ['highmountain', '高山'],
    '42,11': ['highmountain', '高山'],
    '43,11': ['highmountain', '高山'],
    '45,11': ['plain', '平原'],
    '46,11': ['plain', '平原'],
    '51,11': ['highmountain', '高山'],
    '52,11': ['highmountain', '高山'],
    '53,11': ['highmountain', '高山'],
    '54,11': ['highmountain', '高山'],
    '55,11': ['highmountain', '高山'],
    '56,11': ['highmountain', '高山'],
    '57,11': ['highmountain', '高山'],
    '64,11': ['forest', '森林'],
    '65,11': ['forest', '森林'],
    '66,11': ['forest', '森林'],
    '68,11': ['highmountain', '高山'],
    '69,11': ['highmountain', '高山'],
    '70,11': ['highmountain', '高山'],
    '71,11': ['highmountain', '高山'],
    '73,11': ['mountain', '山地'],
    '76,11': ['mountain', '山地'],
    '77,11': ['mountain', '山地'],
    '78,11': ['highmountain', '高山'],
    '80,11': ['highmountain', '高山'],
    '81,11': ['forest', '森林'],
    '10,12': ['glacier', '冰川'],
    '11,12': ['glacier', '冰川'],
    '12,12': ['glacier', '冰川'],
    '13,12': ['glacier', '冰川'],
    '14,12': ['glacier', '冰川'],
    '15,12': ['glacier', '冰川'],
    '17,12': ['basin', '盆地'],
    '18,12': ['basin', '盆地'],
    '19,12': ['highmountain', '高山'],
    '28,12': ['highmountain', '高山'],
    '29,12': ['highmountain', '高山'],
    '30,12': ['highmountain', '高山'],
    '31,12': ['highmountain', '高山'],
    '32,12': ['highmountain', '高山'],
    '35,12': ['highmountain', '高山'],
    '36,12': ['highmountain', '高山'],
    '37,12': ['highmountain', '高山'],
    '39,12': ['highmountain', '高山'],
    '40,12': ['highmountain', '高山'],
    '41,12': ['highmountain', '高山'],
    '42,12': ['highmountain', '高山'],
    '43,12': ['highmountain', '高山'],
    '52,12': ['highmountain', '高山'],
    '53,12': ['highmountain', '高山'],
    '54,12': ['highmountain', '高山'],
    '55,12': ['highmountain', '高山'],
    '56,12': ['highmountain', '高山'],
    '68,12': ['highmountain', '高山'],
    '69,12': ['highmountain', '高山'],
    '70,12': ['highmountain', '高山'],
    '71,12': ['highmountain', '高山'],
    '72,12': ['highmountain', '高山'],
    '73,12': ['mountain', '山地'],
    '76,12': ['mountain', '山地'],
    '77,12': ['mountain', '山地'],
    '78,12': ['mountain', '山地'],
    '79,12': ['highmountain', '高山'],
    '80,12': ['highmountain', '高山'],
    '81,12': ['highmountain', '高山'],
    '82,12': ['forest', '森林'],
    '83,12': ['forest', '森林'],
    '10,13': ['glacier', '冰川'],
    '11,13': ['glacier', '冰川'],
    '12,13': ['glacier', '冰川'],
    '13,13': ['glacier', '冰川'],
    '14,13': ['glacier', '冰川'],
    '16,13': ['highmountain', '高山'],
    '17,13': ['basin', '盆地'],
    '19,13': ['highmountain', '高山'],
    '28,13': ['highmountain', '高山'],
    '29,13': ['highmountain', '高山'],
    '30,13': ['highmountain', '高山'],
    '31,13': ['highmountain', '高山'],
    '32,13': ['highmountain', '高山'],
    '33,13': ['highmountain', '高山'],
    '34,13': ['highmountain', '高山'],
    '35,13': ['highmountain', '高山'],
    '36,13': ['highmountain', '高山'],
    '37,13': ['highmountain', '高山'],
    '39,13': ['highmountain', '高山'],
    '40,13': ['highmountain', '高山'],
    '41,13': ['highmountain', '高山'],
    '42,13': ['highmountain', '高山'],
    '52,13': ['highmountain', '高山'],
    '53,13': ['highmountain', '高山'],
    '68,13': ['highmountain', '高山'],
    '69,13': ['highmountain', '高山'],
    '70,13': ['highmountain', '高山'],
    '72,13': ['mountain', '山地'],
    '73,13': ['mountain', '山地'],
    '74,13': ['mountain', '山地'],
    '77,13': ['mountain', '山地'],
    '78,13': ['mountain', '山地'],
    '79,13': ['mountain', '山地'],
    '80,13': ['mountain', '山地'],
    '81,13': ['highmountain', '高山'],
    '10,14': ['glacier', '冰川'],
    '11,14': ['glacier', '冰川'],
    '12,14': ['glacier', '冰川'],
    '13,14': ['glacier', '冰川'],
    '14,14': ['glacier', '冰川'],
    '16,14': ['highmountain', '高山'],
    '17,14': ['highmountain', '高山'],
    '18,14': ['highmountain', '高山'],
    '19,14': ['highmountain', '高山'],
    '28,14': ['highmountain', '高山'],
    '29,14': ['highmountain', '高山'],
    '30,14': ['highmountain', '高山'],
    '31,14': ['highmountain', '高山'],
    '32,14': ['highmountain', '高山'],
    '33,14': ['highmountain', '高山'],
    '34,14': ['highmountain', '高山'],
    '35,14': ['highmountain', '高山'],
    '36,14': ['highmountain', '高山'],
    '37,14': ['highmountain', '高山'],
    '41,14': ['highmountain', '高山'],
    '42,14': ['highmountain', '高山'],
    '43,14': ['highmountain', '高山'],
    '71,14': ['mountain', '山地'],
    '72,14': ['mountain', '山地'],
    '73,14': ['mountain', '山地'],
    '74,14': ['mountain', '山地'],
    '75,14': ['mountain', '山地'],
    '76,14': ['mountain', '山地'],
    '79,14': ['mountain', '山地'],
    '80,14': ['highmountain', '高山'],
    '82,14': ['mountain', '山地'],
    '10,15': ['glacier', '冰川'],
    '11,15': ['glacier', '冰川'],
    '12,15': ['glacier', '冰川'],
    '13,15': ['glacier', '冰川'],
    '17,15': ['highmountain', '高山'],
    '18,15': ['highmountain', '高山'],
    '28,15': ['highmountain', '高山'],
    '29,15': ['highmountain', '高山'],
    '30,15': ['highmountain', '高山'],
    '31,15': ['highmountain', '高山'],
    '32,15': ['highmountain', '高山'],
    '33,15': ['highmountain', '高山'],
    '34,15': ['highmountain', '高山'],
    '35,15': ['highmountain', '高山'],
    '36,15': ['highmountain', '高山'],
    '37,15': ['highmountain', '高山'],
    '40,15': ['highmountain', '高山'],
    '41,15': ['highmountain', '高山'],
    '42,15': ['highmountain', '高山'],
    '43,15': ['highmountain', '高山'],
    '44,15': ['highmountain', '高山'],
    '71,15': ['mountain', '山地'],
    '73,15': ['mountain', '山地'],
    '74,15': ['mountain', '山地'],
    '75,15': ['mountain', '山地'],
    '76,15': ['mountain', '山地'],
    '77,15': ['mountain', '山地'],
    '80,15': ['highmountain', '高山'],
    '81,15': ['mountain', '山地'],
    '82,15': ['mountain', '山地'],
    '83,15': ['highmountain', '高山'],
    '84,15': ['highmountain', '高山'],
    '10,16': ['glacier', '冰川'],
    '11,16': ['glacier', '冰川'],
    '12,16': ['glacier', '冰川'],
    '13,16': ['glacier', '冰川'],
    '29,16': ['highmountain', '高山'],
    '30,16': ['highmountain', '高山'],
    '31,16': ['highmountain', '高山'],
    '32,16': ['highmountain', '高山'],
    '35,16': ['highmountain', '高山'],
    '36,16': ['highmountain', '高山'],
    '37,16': ['highmountain', '高山'],
    '40,16': ['highmountain', '高山'],
    '41,16': ['highmountain', '高山'],
    '42,16': ['highmountain', '高山'],
    '43,16': ['highmountain', '高山'],
    '44,16': ['highmountain', '高山'],
    '65,16': ['mountain', '山地'],
    '66,16': ['mountain', '山地'],
    '67,16': ['mountain', '山地'],
    '74,16': ['mountain', '山地'],
    '75,16': ['mountain', '山地'],
    '77,16': ['mountain', '山地'],
    '78,16': ['mountain', '山地'],
    '80,16': ['mountain', '山地'],
    '81,16': ['mountain', '山地'],
    '82,16': ['highmountain', '高山'],
    '83,16': ['highmountain', '高山'],
    '84,16': ['highmountain', '高山'],
    '10,17': ['glacier', '冰川'],
    '11,17': ['glacier', '冰川'],
    '12,17': ['glacier', '冰川'],
    '13,17': ['glacier', '冰川'],
    '26,17': ['highmountain', '高山'],
    '27,17': ['highmountain', '高山'],
    '28,17': ['highmountain', '高山'],
    '29,17': ['highmountain', '高山'],
    '30,17': ['highmountain', '高山'],
    '31,17': ['highmountain', '高山'],
    '32,17': ['highmountain', '高山'],
    '33,17': ['highmountain', '高山'],
    '34,17': ['highmountain', '高山'],
    '36,17': ['highmountain', '高山'],
    '37,17': ['highmountain', '高山'],
    '40,17': ['highmountain', '高山'],
    '41,17': ['highmountain', '高山'],
    '42,17': ['highmountain', '高山'],
    '43,17': ['highmountain', '高山'],
    '44,17': ['highmountain', '高山'],
    '45,17': ['highmountain', '高山'],
    '65,17': ['mountain', '山地'],
    '66,17': ['mountain', '山地'],
    '67,17': ['mountain', '山地'],
    '78,17': ['mountain', '山地'],
    '80,17': ['mountain', '山地'],
    '81,17': ['mountain', '山地'],
    '82,17': ['highmountain', '高山'],
    '84,17': ['highmountain', '高山'],
    '11,18': ['glacier', '冰川'],
    '12,18': ['glacier', '冰川'],
    '13,18': ['glacier', '冰川'],
    '26,18': ['highmountain', '高山'],
    '27,18': ['highmountain', '高山'],
    '28,18': ['highmountain', '高山'],
    '29,18': ['highmountain', '高山'],
    '30,18': ['highmountain', '高山'],
    '40,18': ['highmountain', '高山'],
    '41,18': ['highmountain', '高山'],
    '42,18': ['highmountain', '高山'],
    '43,18': ['highmountain', '高山'],
    '44,18': ['highmountain', '高山'],
    '45,18': ['highmountain', '高山'],
    '65,18': ['mountain', '山地'],
    '67,18': ['mountain', '山地'],
    '78,18': ['mountain', '山地'],
    '80,18': ['mountain', '山地'],
    '81,18': ['mountain', '山地'],
    '26,19': ['highmountain', '高山'],
    '27,19': ['highmountain', '高山'],
    '28,19': ['highmountain', '高山'],
    '29,19': ['highmountain', '高山'],
    '30,19': ['highmountain', '高山'],
    '40,19': ['highmountain', '高山'],
    '41,19': ['highmountain', '高山'],
    '42,19': ['highmountain', '高山'],
    '43,19': ['highmountain', '高山'],
    '44,19': ['highmountain', '高山'],
    '45,19': ['highmountain', '高山'],
    '57,19': ['highmountain', '高山'],
    '58,19': ['highmountain', '高山'],
    '60,19': ['highmountain', '高山'],
    '61,19': ['highmountain', '高山'],
    '62,19': ['highmountain', '高山'],
    '67,19': ['highmountain', '高山'],
    '68,19': ['highmountain', '高山'],
    '69,19': ['highmountain', '高山'],
    '70,19': ['highmountain', '高山'],
    '78,19': ['mountain', '山地'],
    '79,19': ['mountain', '山地'],
    '80,19': ['highmountain', '高山'],
    '26,20': ['highmountain', '高山'],
    '27,20': ['highmountain', '高山'],
    '29,20': ['highmountain', '高山'],
    '35,20': ['highmountain', '高山'],
    '40,20': ['highmountain', '高山'],
    '41,20': ['highmountain', '高山'],
    '42,20': ['highmountain', '高山'],
    '43,20': ['highmountain', '高山'],
    '44,20': ['highmountain', '高山'],
    '45,20': ['highmountain', '高山'],
    '57,20': ['highmountain', '高山'],
    '58,20': ['highmountain', '高山'],
    '59,20': ['highmountain', '高山'],
    '60,20': ['highmountain', '高山'],
    '61,20': ['highmountain', '高山'],
    '62,20': ['forest', '森林'],
    '64,20': ['highmountain', '高山'],
    '65,20': ['highmountain', '高山'],
    '66,20': ['highmountain', '高山'],
    '67,20': ['highmountain', '高山'],
    '68,20': ['highmountain', '高山'],
    '69,20': ['highmountain', '高山'],
    '79,20': ['highmountain', '高山'],
    '80,20': ['highmountain', '高山'],
    '81,20': ['highmountain', '高山'],
    '33,21': ['highmountain', '高山'],
    '34,21': ['highmountain', '高山'],
    '35,21': ['highmountain', '高山'],
    '40,21': ['highmountain', '高山'],
    '41,21': ['highmountain', '高山'],
    '42,21': ['highmountain', '高山'],
    '43,21': ['highmountain', '高山'],
    '44,21': ['highmountain', '高山'],
    '45,21': ['highmountain', '高山'],
    '57,21': ['highmountain', '高山'],
    '58,21': ['highmountain', '高山'],
    '59,21': ['highmountain', '高山'],
    '61,21': ['forest', '森林'],
    '62,21': ['forest', '森林'],
    '63,21': ['highmountain', '高山'],
    '64,21': ['highmountain', '高山'],
    '65,21': ['highmountain', '高山'],
    '66,21': ['highmountain', '高山'],
    '67,21': ['highmountain', '高山'],
    '68,21': ['highmountain', '高山'],
    '69,21': ['highmountain', '高山'],
    '70,21': ['highmountain', '高山'],
    '78,21': ['highmountain', '高山'],
    '79,21': ['highmountain', '高山'],
    '80,21': ['highmountain', '高山'],
    '81,21': ['highmountain', '高山'],
    '20,22': ['highmountain', '高山'],
    '21,22': ['highmountain', '高山'],
    '33,22': ['highmountain', '高山'],
    '34,22': ['highmountain', '高山'],
    '41,22': ['highmountain', '高山'],
    '42,22': ['highmountain', '高山'],
    '43,22': ['highmountain', '高山'],
    '44,22': ['highmountain', '高山'],
    '45,22': ['highmountain', '高山'],
    '54,22': ['highmountain', '高山'],
    '55,22': ['highmountain', '高山'],
    '56,22': ['highmountain', '高山'],
    '57,22': ['highmountain', '高山'],
    '58,22': ['highmountain', '高山'],
    '59,22': ['highmountain', '高山'],
    '60,22': ['forest', '森林'],
    '61,22': ['forest', '森林'],
    '62,22': ['forest', '森林'],
    '63,22': ['highmountain', '高山'],
    '64,22': ['highmountain', '高山'],
    '65,22': ['forest', '森林'],
    '66,22': ['forest', '森林'],
    '67,22': ['highmountain', '高山'],
    '68,22': ['highmountain', '高山'],
    '69,22': ['highmountain', '高山'],
    '70,22': ['highmountain', '高山'],
    '71,22': ['highmountain', '高山'],
    '72,22': ['highmountain', '高山'],
    '77,22': ['highmountain', '高山'],
    '78,22': ['highmountain', '高山'],
    '79,22': ['highmountain', '高山'],
    '80,22': ['highmountain', '高山'],
    '81,22': ['highmountain', '高山'],
    '20,23': ['highmountain', '高山'],
    '21,23': ['highmountain', '高山'],
    '33,23': ['highmountain', '高山'],
    '34,23': ['highmountain', '高山'],
    '40,23': ['highmountain', '高山'],
    '41,23': ['highmountain', '高山'],
    '42,23': ['highmountain', '高山'],
    '43,23': ['highmountain', '高山'],
    '44,23': ['highmountain', '高山'],
    '45,23': ['highmountain', '高山'],
    '54,23': ['highmountain', '高山'],
    '55,23': ['highmountain', '高山'],
    '56,23': ['highmountain', '高山'],
    '57,23': ['highmountain', '高山'],
    '58,23': ['highmountain', '高山'],
    '59,23': ['forest', '森林'],
    '60,23': ['forest', '森林'],
    '61,23': ['forest', '森林'],
    '62,23': ['forest', '森林'],
    '63,23': ['forest', '森林'],
    '64,23': ['forest', '森林'],
    '65,23': ['forest', '森林'],
    '66,23': ['forest', '森林'],
    '67,23': ['highmountain', '高山'],
    '68,23': ['highmountain', '高山'],
    '69,23': ['highmountain', '高山'],
    '70,23': ['highmountain', '高山'],
    '71,23': ['highmountain', '高山'],
    '72,23': ['highmountain', '高山'],
    '77,23': ['highmountain', '高山'],
    '78,23': ['highmountain', '高山'],
    '79,23': ['highmountain', '高山'],
    '80,23': ['highmountain', '高山'],
    '81,23': ['highmountain', '高山'],
    '82,23': ['highmountain', '高山'],
    '83,23': ['highmountain', '高山'],
    '20,24': ['highmountain', '高山'],
    '21,24': ['highmountain', '高山'],
    '22,24': ['forest', '森林'],
    '23,24': ['forest', '森林'],
    '28,24': ['highmountain', '高山'],
    '29,24': ['highmountain', '高山'],
    '33,24': ['highmountain', '高山'],
    '34,24': ['highmountain', '高山'],
    '35,24': ['mountain', '山地'],
    '36,24': ['mountain', '山地'],
    '37,24': ['mountain', '山地'],
    '40,24': ['highmountain', '高山'],
    '41,24': ['highmountain', '高山'],
    '42,24': ['highmountain', '高山'],
    '43,24': ['highmountain', '高山'],
    '44,24': ['highmountain', '高山'],
    '45,24': ['highmountain', '高山'],
    '54,24': ['highmountain', '高山'],
    '55,24': ['highmountain', '高山'],
    '56,24': ['highmountain', '高山'],
    '57,24': ['highmountain', '高山'],
    '58,24': ['highmountain', '高山'],
    '59,24': ['forest', '森林'],
    '60,24': ['forest', '森林'],
    '61,24': ['forest', '森林'],
    '62,24': ['forest', '森林'],
    '63,24': ['forest', '森林'],
    '64,24': ['forest', '森林'],
    '65,24': ['forest', '森林'],
    '66,24': ['forest', '森林'],
    '67,24': ['highmountain', '高山'],
    '68,24': ['highmountain', '高山'],
    '69,24': ['highmountain', '高山'],
    '71,24': ['mountain', '山地'],
    '72,24': ['mountain', '山地'],
    '73,24': ['mountain', '山地'],
    '77,24': ['highmountain', '高山'],
    '78,24': ['highmountain', '高山'],
    '79,24': ['highmountain', '高山'],
    '80,24': ['highmountain', '高山'],
    '81,24': ['highmountain', '高山'],
    '82,24': ['highmountain', '高山'],
    '83,24': ['highmountain', '高山'],
    '19,25': ['highmountain', '高山'],
    '20,25': ['highmountain', '高山'],
    '21,25': ['forest', '森林'],
    '22,25': ['forest', '森林'],
    '23,25': ['forest', '森林'],
    '24,25': ['highmountain', '高山'],
    '25,25': ['highmountain', '高山'],
    '26,25': ['highmountain', '高山'],
    '27,25': ['highmountain', '高山'],
    '28,25': ['highmountain', '高山'],
    '32,25': ['highmountain', '高山'],
    '33,25': ['highmountain', '高山'],
    '34,25': ['highmountain', '高山'],
    '35,25': ['highmountain', '高山'],
    '36,25': ['highmountain', '高山'],
    '37,25': ['mountain', '山地'],
    '40,25': ['highmountain', '高山'],
    '41,25': ['highmountain', '高山'],
    '42,25': ['highmountain', '高山'],
    '43,25': ['highmountain', '高山'],
    '44,25': ['highmountain', '高山'],
    '45,25': ['highmountain', '高山'],
    '46,25': ['highmountain', '高山'],
    '54,25': ['highmountain', '高山'],
    '55,25': ['highmountain', '高山'],
    '56,25': ['highmountain', '高山'],
    '57,25': ['highmountain', '高山'],
    '58,25': ['highmountain', '高山'],
    '59,25': ['highmountain', '高山'],
    '60,25': ['highmountain', '高山'],
    '61,25': ['forest', '森林'],
    '62,25': ['forest', '森林'],
    '63,25': ['forest', '森林'],
    '64,25': ['forest', '森林'],
    '65,25': ['forest', '森林'],
    '67,25': ['highmountain', '高山'],
    '68,25': ['highmountain', '高山'],
    '69,25': ['highmountain', '高山'],
    '73,25': ['mountain', '山地'],
    '74,25': ['mountain', '山地'],
    '77,25': ['highmountain', '高山'],
    '78,25': ['highmountain', '高山'],
    '79,25': ['highmountain', '高山'],
    '81,25': ['highmountain', '高山'],
    '82,25': ['highmountain', '高山'],
    '83,25': ['highmountain', '高山'],
    '19,26': ['highmountain', '高山'],
    '20,26': ['highmountain', '高山'],
    '21,26': ['forest', '森林'],
    '22,26': ['forest', '森林'],
    '23,26': ['forest', '森林'],
    '24,26': ['forest', '森林'],
    '25,26': ['highmountain', '高山'],
    '26,26': ['highmountain', '高山'],
    '27,26': ['highmountain', '高山'],
    '28,26': ['highmountain', '高山'],
    '29,26': ['highmountain', '高山'],
    '30,26': ['highmountain', '高山'],
    '31,26': ['highmountain', '高山'],
    '32,26': ['highmountain', '高山'],
    '33,26': ['highmountain', '高山'],
    '34,26': ['highmountain', '高山'],
    '35,26': ['highmountain', '高山'],
    '36,26': ['highmountain', '高山'],
    '37,26': ['mountain', '山地'],
    '40,26': ['highmountain', '高山'],
    '41,26': ['highmountain', '高山'],
    '42,26': ['highmountain', '高山'],
    '43,26': ['highmountain', '高山'],
    '44,26': ['highmountain', '高山'],
    '45,26': ['highmountain', '高山'],
    '46,26': ['highmountain', '高山'],
    '54,26': ['highmountain', '高山'],
    '55,26': ['highmountain', '高山'],
    '56,26': ['highmountain', '高山'],
    '57,26': ['highmountain', '高山'],
    '59,26': ['highmountain', '高山'],
    '60,26': ['highmountain', '高山'],
    '61,26': ['forest', '森林'],
    '62,26': ['forest', '森林'],
    '63,26': ['forest', '森林'],
    '64,26': ['forest', '森林'],
    '65,26': ['highmountain', '高山'],
    '67,26': ['highmountain', '高山'],
    '68,26': ['highmountain', '高山'],
    '69,26': ['highmountain', '高山'],
    '70,26': ['highmountain', '高山'],
    '71,26': ['highmountain', '高山'],
    '72,26': ['mountain', '山地'],
    '73,26': ['mountain', '山地'],
    '74,26': ['mountain', '山地'],
    '75,26': ['mountain', '山地'],
    '76,26': ['mountain', '山地'],
    '77,26': ['highmountain', '高山'],
    '78,26': ['highmountain', '高山'],
    '79,26': ['highmountain', '高山'],
    '82,26': ['highmountain', '高山'],
    '19,27': ['highmountain', '高山'],
    '20,27': ['highmountain', '高山'],
    '21,27': ['highmountain', '高山'],
    '22,27': ['forest', '森林'],
    '23,27': ['forest', '森林'],
    '24,27': ['forest', '森林'],
    '25,27': ['forest', '森林'],
    '26,27': ['highmountain', '高山'],
    '27,27': ['highmountain', '高山'],
    '28,27': ['highmountain', '高山'],
    '29,27': ['highmountain', '高山'],
    '30,27': ['highmountain', '高山'],
    '31,27': ['highmountain', '高山'],
    '32,27': ['highmountain', '高山'],
    '33,27': ['highmountain', '高山'],
    '34,27': ['highmountain', '高山'],
    '35,27': ['highmountain', '高山'],
    '36,27': ['highmountain', '高山'],
    '37,27': ['mountain', '山地'],
    '38,27': ['mountain', '山地'],
    '39,27': ['highmountain', '高山'],
    '41,27': ['highmountain', '高山'],
    '42,27': ['highmountain', '高山'],
    '43,27': ['highmountain', '高山'],
    '44,27': ['highmountain', '高山'],
    '45,27': ['highmountain', '高山'],
    '46,27': ['highmountain', '高山'],
    '55,27': ['highmountain', '高山'],
    '56,27': ['highmountain', '高山'],
    '57,27': ['highmountain', '高山'],
    '59,27': ['highmountain', '高山'],
    '60,27': ['highmountain', '高山'],
    '61,27': ['forest', '森林'],
    '62,27': ['forest', '森林'],
    '63,27': ['highmountain', '高山'],
    '64,27': ['forest', '森林'],
    '65,27': ['highmountain', '高山'],
    '66,27': ['highmountain', '高山'],
    '67,27': ['highmountain', '高山'],
    '70,27': ['highmountain', '高山'],
    '71,27': ['mountain', '山地'],
    '72,27': ['mountain', '山地'],
    '73,27': ['mountain', '山地'],
    '74,27': ['mountain', '山地'],
    '75,27': ['mountain', '山地'],
    '76,27': ['mountain', '山地'],
    '77,27': ['mountain', '山地'],
    '19,28': ['highmountain', '高山'],
    '20,28': ['highmountain', '高山'],
    '21,28': ['highmountain', '高山'],
    '22,28': ['forest', '森林'],
    '23,28': ['forest', '森林'],
    '24,28': ['forest', '森林'],
    '25,28': ['forest', '森林'],
    '26,28': ['highmountain', '高山'],
    '27,28': ['highmountain', '高山'],
    '28,28': ['highmountain', '高山'],
    '29,28': ['highmountain', '高山'],
    '30,28': ['highmountain', '高山'],
    '31,28': ['highmountain', '高山'],
    '32,28': ['highmountain', '高山'],
    '33,28': ['highmountain', '高山'],
    '34,28': ['highmountain', '高山'],
    '35,28': ['highmountain', '高山'],
    '36,28': ['highmountain', '高山'],
    '37,28': ['mountain', '山地'],
    '38,28': ['mountain', '山地'],
    '39,28': ['highmountain', '高山'],
    '40,28': ['highmountain', '高山'],
    '41,28': ['highmountain', '高山'],
    '42,28': ['highmountain', '高山'],
    '43,28': ['highmountain', '高山'],
    '44,28': ['highmountain', '高山'],
    '45,28': ['highmountain', '高山'],
    '46,28': ['highmountain', '高山'],
    '52,28': ['highmountain', '高山'],
    '59,28': ['highmountain', '高山'],
    '60,28': ['highmountain', '高山'],
    '61,28': ['forest', '森林'],
    '62,28': ['forest', '森林'],
    '63,28': ['highmountain', '高山'],
    '67,28': ['mountain', '山地'],
    '68,28': ['mountain', '山地'],
    '69,28': ['mountain', '山地'],
    '70,28': ['mountain', '山地'],
    '71,28': ['mountain', '山地'],
    '74,28': ['mountain', '山地'],
    '19,29': ['highmountain', '高山'],
    '20,29': ['highmountain', '高山'],
    '21,29': ['highmountain', '高山'],
    '22,29': ['highmountain', '高山'],
    '23,29': ['forest', '森林'],
    '24,29': ['forest', '森林'],
    '26,29': ['highmountain', '高山'],
    '27,29': ['highmountain', '高山'],
    '28,29': ['highmountain', '高山'],
    '29,29': ['highmountain', '高山'],
    '30,29': ['highmountain', '高山'],
    '31,29': ['highmountain', '高山'],
    '32,29': ['highmountain', '高山'],
    '33,29': ['highmountain', '高山'],
    '35,29': ['highmountain', '高山'],
    '36,29': ['highmountain', '高山'],
    '37,29': ['mountain', '山地'],
    '38,29': ['mountain', '山地'],
    '39,29': ['highmountain', '高山'],
    '40,29': ['highmountain', '高山'],
    '41,29': ['highmountain', '高山'],
    '42,29': ['highmountain', '高山'],
    '43,29': ['highmountain', '高山'],
    '44,29': ['highmountain', '高山'],
    '45,29': ['highmountain', '高山'],
    '46,29': ['highmountain', '高山'],
    '47,29': ['highmountain', '高山'],
    '51,29': ['highmountain', '高山'],
    '52,29': ['highmountain', '高山'],
    '59,29': ['highmountain', '高山'],
    '60,29': ['highmountain', '高山'],
    '61,29': ['highmountain', '高山'],
    '62,29': ['highmountain', '高山'],
    '63,29': ['highmountain', '高山'],
    '64,29': ['highmountain', '高山'],
    '66,29': ['highmountain', '高山'],
    '67,29': ['mountain', '山地'],
    '68,29': ['mountain', '山地'],
    '69,29': ['mountain', '山地'],
    '71,29': ['mountain', '山地'],
    '72,29': ['mountain', '山地'],
    '73,29': ['mountain', '山地'],
    '74,29': ['mountain', '山地'],
    '21,30': ['highmountain', '高山'],
    '22,30': ['highmountain', '高山'],
    '23,30': ['highmountain', '高山'],
    '28,30': ['highmountain', '高山'],
    '29,30': ['highmountain', '高山'],
    '30,30': ['highmountain', '高山'],
    '31,30': ['highmountain', '高山'],
    '32,30': ['highmountain', '高山'],
    '34,30': ['highmountain', '高山'],
    '35,30': ['mountain', '山地'],
    '36,30': ['mountain', '山地'],
    '37,30': ['highmountain', '高山'],
    '38,30': ['mountain', '山地'],
    '39,30': ['highmountain', '高山'],
    '40,30': ['highmountain', '高山'],
    '41,30': ['highmountain', '高山'],
    '42,30': ['highmountain', '高山'],
    '43,30': ['highmountain', '高山'],
    '44,30': ['highmountain', '高山'],
    '45,30': ['highmountain', '高山'],
    '46,30': ['highmountain', '高山'],
    '47,30': ['highmountain', '高山'],
    '51,30': ['highmountain', '高山'],
    '57,30': ['highmountain', '高山'],
    '58,30': ['highmountain', '高山'],
    '59,30': ['highmountain', '高山'],
    '61,30': ['highmountain', '高山'],
    '62,30': ['highmountain', '高山'],
    '63,30': ['highmountain', '高山'],
    '64,30': ['highmountain', '高山'],
    '66,30': ['highmountain', '高山'],
    '67,30': ['highmountain', '高山'],
    '69,30': ['mountain', '山地'],
    '70,30': ['mountain', '山地'],
    '73,30': ['mountain', '山地'],
    '74,30': ['mountain', '山地'],
    '75,30': ['mountain', '山地'],
    '23,31': ['highmountain', '高山'],
    '24,31': ['highmountain', '高山'],
    '25,31': ['highmountain', '高山'],
    '26,31': ['highmountain', '高山'],
    '27,31': ['highmountain', '高山'],
    '28,31': ['highmountain', '高山'],
    '29,31': ['highmountain', '高山'],
    '31,31': ['highmountain', '高山'],
    '32,31': ['highmountain', '高山'],
    '34,31': ['highmountain', '高山'],
    '35,31': ['mountain', '山地'],
    '36,31': ['highmountain', '高山'],
    '37,31': ['mountain', '山地'],
    '38,31': ['highmountain', '高山'],
    '39,31': ['highmountain', '高山'],
    '40,31': ['highmountain', '高山'],
    '41,31': ['highmountain', '高山'],
    '42,31': ['highmountain', '高山'],
    '43,31': ['highmountain', '高山'],
    '44,31': ['highmountain', '高山'],
    '45,31': ['highmountain', '高山'],
    '46,31': ['highmountain', '高山'],
    '47,31': ['highmountain', '高山'],
    '48,31': ['forest', '森林'],
    '49,31': ['forest', '森林'],
    '50,31': ['forest', '森林'],
    '51,31': ['highmountain', '高山'],
    '52,31': ['highmountain', '高山'],
    '54,31': ['highmountain', '高山'],
    '57,31': ['highmountain', '高山'],
    '58,31': ['highmountain', '高山'],
    '59,31': ['highmountain', '高山'],
    '60,31': ['highmountain', '高山'],
    '61,31': ['highmountain', '高山'],
    '63,31': ['highmountain', '高山'],
    '64,31': ['highmountain', '高山'],
    '67,31': ['highmountain', '高山'],
    '68,31': ['mountain', '山地'],
    '69,31': ['mountain', '山地'],
    '71,31': ['mountain', '山地'],
    '72,31': ['mountain', '山地'],
    '73,31': ['mountain', '山地'],
    '74,31': ['highmountain', '高山'],
    '75,31': ['highmountain', '高山'],
    '35,32': ['mountain', '山地'],
    '36,32': ['mountain', '山地'],
    '37,32': ['highmountain', '高山'],
    '38,32': ['highmountain', '高山'],
    '39,32': ['highmountain', '高山'],
    '40,32': ['highmountain', '高山'],
    '41,32': ['highmountain', '高山'],
    '42,32': ['highmountain', '高山'],
    '43,32': ['highmountain', '高山'],
    '44,32': ['highmountain', '高山'],
    '45,32': ['highmountain', '高山'],
    '46,32': ['highmountain', '高山'],
    '47,32': ['forest', '森林'],
    '48,32': ['forest', '森林'],
    '49,32': ['forest', '森林'],
    '50,32': ['forest', '森林'],
    '51,32': ['highmountain', '高山'],
    '52,32': ['highmountain', '高山'],
    '53,32': ['highmountain', '高山'],
    '54,32': ['highmountain', '高山'],
    '67,32': ['mountain', '山地'],
    '68,32': ['mountain', '山地'],
    '69,32': ['mountain', '山地'],
    '70,32': ['mountain', '山地'],
    '71,32': ['mountain', '山地'],
    '72,32': ['mountain', '山地'],
    '73,32': ['highmountain', '高山'],
    '74,32': ['highmountain', '高山'],
    '24,33': ['highmountain', '高山'],
    '25,33': ['highmountain', '高山'],
    '26,33': ['highmountain', '高山'],
    '34,33': ['highmountain', '高山'],
    '35,33': ['mountain', '山地'],
    '36,33': ['highmountain', '高山'],
    '37,33': ['highmountain', '高山'],
    '38,33': ['highmountain', '高山'],
    '39,33': ['highmountain', '高山'],
    '40,33': ['highmountain', '高山'],
    '41,33': ['highmountain', '高山'],
    '42,33': ['highmountain', '高山'],
    '43,33': ['highmountain', '高山'],
    '44,33': ['highmountain', '高山'],
    '45,33': ['highmountain', '高山'],
    '46,33': ['highmountain', '高山'],
    '47,33': ['forest', '森林'],
    '48,33': ['forest', '森林'],
    '49,33': ['forest', '森林'],
    '50,33': ['forest', '森林'],
    '51,33': ['highmountain', '高山'],
    '52,33': ['highmountain', '高山'],
    '53,33': ['highmountain', '高山'],
    '54,33': ['highmountain', '高山'],
    '68,33': ['mountain', '山地'],
    '69,33': ['mountain', '山地'],
    '71,33': ['mountain', '山地'],
    '72,33': ['mountain', '山地'],
    '73,33': ['mountain', '山地'],
    '74,33': ['highmountain', '高山'],
    '75,33': ['highmountain', '高山'],
    '24,34': ['highmountain', '高山'],
    '25,34': ['highmountain', '高山'],
    '26,34': ['highmountain', '高山'],
    '27,34': ['highmountain', '高山'],
    '28,34': ['highmountain', '高山'],
    '29,34': ['highmountain', '高山'],
    '30,34': ['highmountain', '高山'],
    '31,34': ['highmountain', '高山'],
    '32,34': ['highmountain', '高山'],
    '33,34': ['highmountain', '高山'],
    '34,34': ['highmountain', '高山'],
    '35,34': ['highmountain', '高山'],
    '36,34': ['highmountain', '高山'],
    '37,34': ['highmountain', '高山'],
    '38,34': ['highmountain', '高山'],
    '39,34': ['highmountain', '高山'],
    '40,34': ['highmountain', '高山'],
    '41,34': ['highmountain', '高山'],
    '42,34': ['highmountain', '高山'],
    '43,34': ['highmountain', '高山'],
    '44,34': ['highmountain', '高山'],
    '45,34': ['highmountain', '高山'],
    '46,34': ['highmountain', '高山'],
    '48,34': ['forest', '森林'],
    '49,34': ['forest', '森林'],
    '50,34': ['forest', '森林'],
    '51,34': ['highmountain', '高山'],
    '53,34': ['highmountain', '高山'],
    '54,34': ['highmountain', '高山'],
    '68,34': ['mountain', '山地'],
    '69,34': ['mountain', '山地'],
    '71,34': ['mountain', '山地'],
    '72,34': ['mountain', '山地'],
    '73,34': ['mountain', '山地'],
    '74,34': ['highmountain', '高山'],
    '75,34': ['highmountain', '高山'],
    '24,35': ['highmountain', '高山'],
    '25,35': ['highmountain', '高山'],
    '26,35': ['highmountain', '高山'],
    '27,35': ['highmountain', '高山'],
    '28,35': ['highmountain', '高山'],
    '29,35': ['highmountain', '高山'],
    '30,35': ['highmountain', '高山'],
    '31,35': ['highmountain', '高山'],
    '32,35': ['highmountain', '高山'],
    '33,35': ['highmountain', '高山'],
    '34,35': ['highmountain', '高山'],
    '35,35': ['highmountain', '高山'],
    '36,35': ['highmountain', '高山'],
    '37,35': ['highmountain', '高山'],
    '38,35': ['highmountain', '高山'],
    '39,35': ['highmountain', '高山'],
    '44,35': ['highmountain', '高山'],
    '45,35': ['highmountain', '高山'],
    '70,35': ['mountain', '山地'],
    '71,35': ['mountain', '山地'],
    '72,35': ['mountain', '山地'],
    '73,35': ['highmountain', '高山'],
    '74,35': ['highmountain', '高山'],
    '75,35': ['highmountain', '高山'],
    '27,36': ['highmountain', '高山'],
    '28,36': ['highmountain', '高山'],
    '29,36': ['highmountain', '高山'],
    '30,36': ['highmountain', '高山'],
    '31,36': ['highmountain', '高山'],
    '32,36': ['highmountain', '高山'],
    '33,36': ['highmountain', '高山'],
    '34,36': ['highmountain', '高山'],
    '35,36': ['highmountain', '高山'],
    '36,36': ['highmountain', '高山'],
    '37,36': ['highmountain', '高山'],
    '38,36': ['highmountain', '高山'],
    '72,36': ['highmountain', '高山'],
    '73,36': ['highmountain', '高山'],
    '74,36': ['highmountain', '高山'],
    '52,50': ['forest', '森林'],
    '53,50': ['forest', '森林'],
    '52,51': ['forest', '森林'],
    '53,51': ['forest', '森林'],
    '12,52': ['forest', '森林'],
    '13,52': ['forest', '森林'],
    '49,52': ['forest', '森林'],
    '50,52': ['forest', '森林'],
    '51,52': ['forest', '森林'],
    '53,52': ['highmountain', '高山'],
    '54,52': ['highmountain', '高山'],
    '55,52': ['highmountain', '高山'],
    '56,52': ['highmountain', '高山'],
    '12,53': ['forest', '森林'],
    '13,53': ['forest', '森林'],
    '48,53': ['highmountain', '高山'],
    '50,53': ['highmountain', '高山'],
    '51,53': ['highmountain', '高山'],
    '52,53': ['highmountain', '高山'],
    '53,53': ['highmountain', '高山'],
    '54,53': ['highmountain', '高山'],
    '55,53': ['highmountain', '高山'],
    '12,54': ['forest', '森林'],
    '13,54': ['forest', '森林'],
    '45,54': ['highmountain', '高山'],
    '46,54': ['highmountain', '高山'],
    '47,54': ['highmountain', '高山'],
    '48,54': ['highmountain', '高山'],
    '49,54': ['highmountain', '高山'],
    '50,54': ['highmountain', '高山'],
    '51,54': ['highmountain', '高山'],
    '52,54': ['highmountain', '高山'],
    '53,54': ['highmountain', '高山'],
    '54,54': ['highmountain', '高山'],
    '11,55': ['forest', '森林'],
    '12,55': ['forest', '森林'],
    '13,55': ['forest', '森林'],
    '17,55': ['highmountain', '高山'],
    '44,55': ['highmountain', '高山'],
    '45,55': ['highmountain', '高山'],
    '46,55': ['highmountain', '高山'],
    '47,55': ['highmountain', '高山'],
    '48,55': ['highmountain', '高山'],
    '49,55': ['highmountain', '高山'],
    '50,55': ['highmountain', '高山'],
    '51,55': ['highmountain', '高山'],
    '52,55': ['highmountain', '高山'],
    '53,55': ['highmountain', '高山'],
    '54,55': ['highmountain', '高山'],
    '10,56': ['forest', '森林'],
    '11,56': ['forest', '森林'],
    '12,56': ['forest', '森林'],
    '13,56': ['forest', '森林'],
    '15,56': ['highmountain', '高山'],
    '16,56': ['highmountain', '高山'],
    '17,56': ['highmountain', '高山'],
    '44,56': ['highmountain', '高山'],
    '45,56': ['mountain', '山地'],
    '46,56': ['highmountain', '高山'],
    '47,56': ['highmountain', '高山'],
    '49,56': ['highmountain', '高山'],
    '50,56': ['highmountain', '高山'],
    '51,56': ['highmountain', '高山'],
    '52,56': ['highmountain', '高山'],
    '53,56': ['highmountain', '高山'],
    '54,56': ['highmountain', '高山'],
    '10,57': ['forest', '森林'],
    '11,57': ['forest', '森林'],
    '12,57': ['highmountain', '高山'],
    '13,57': ['highmountain', '高山'],
    '16,57': ['highmountain', '高山'],
    '17,57': ['highmountain', '高山'],
    '19,57': ['highmountain', '高山'],
    '43,57': ['forest', '森林'],
    '44,57': ['mountain', '山地'],
    '45,57': ['mountain', '山地'],
    '46,57': ['mountain', '山地'],
    '47,57': ['highmountain', '高山'],
    '48,57': ['highmountain', '高山'],
    '49,57': ['highmountain', '高山'],
    '50,57': ['highmountain', '高山'],
    '51,57': ['highmountain', '高山'],
    '52,57': ['highmountain', '高山'],
    '12,58': ['highmountain', '高山'],
    '13,58': ['highmountain', '高山'],
    '14,58': ['highmountain', '高山'],
    '15,58': ['highmountain', '高山'],
    '16,58': ['highmountain', '高山'],
    '17,58': ['highmountain', '高山'],
    '18,58': ['highmountain', '高山'],
    '19,58': ['highmountain', '高山'],
    '43,58': ['forest', '森林'],
    '44,58': ['forest', '森林'],
    '45,58': ['mountain', '山地'],
    '46,58': ['mountain', '山地'],
    '47,58': ['mountain', '山地'],
    '48,58': ['highmountain', '高山'],
    '49,58': ['highmountain', '高山'],
    '50,58': ['highmountain', '高山'],
    '12,59': ['highmountain', '高山'],
    '13,59': ['highmountain', '高山'],
    '14,59': ['highmountain', '高山'],
    '15,59': ['highmountain', '高山'],
    '16,59': ['highmountain', '高山'],
    '17,59': ['highmountain', '高山'],
    '18,59': ['highmountain', '高山'],
    '19,59': ['highmountain', '高山'],
    '43,59': ['forest', '森林'],
    '44,59': ['forest', '森林'],
    '45,59': ['mountain', '山地'],
    '46,59': ['mountain', '山地'],
    '47,59': ['mountain', '山地'],
    '48,59': ['highmountain', '高山'],
    '49,59': ['highmountain', '高山'],
    '50,59': ['highmountain', '高山'],
    '12,60': ['forest', '森林'],
    '13,60': ['forest', '森林'],
    '14,60': ['highmountain', '高山'],
    '15,60': ['highmountain', '高山'],
    '16,60': ['forest', '森林'],
    '17,60': ['highmountain', '高山'],
    '18,60': ['highmountain', '高山'],
    '19,60': ['highmountain', '高山'],
    '43,60': ['forest', '森林'],
    '44,60': ['forest', '森林'],
    '45,60': ['mountain', '山地'],
    '46,60': ['mountain', '山地'],
    '47,60': ['mountain', '山地'],
    '48,60': ['highmountain', '高山'],
    '49,60': ['highmountain', '高山'],
    '10,61': ['highmountain', '高山'],
    '11,61': ['highmountain', '高山'],
    '14,61': ['highmountain', '高山'],
    '15,61': ['highmountain', '高山'],
    '16,61': ['forest', '森林'],
    '17,61': ['highmountain', '高山'],
    '18,61': ['highmountain', '高山'],
    '19,61': ['highmountain', '高山'],
    '44,61': ['highmountain', '高山'],
    '45,61': ['highmountain', '高山'],
    '46,61': ['highmountain', '高山'],
    '47,61': ['highmountain', '高山'],
    '48,61': ['highmountain', '高山'],
    '49,61': ['highmountain', '高山'],
    '11,62': ['highmountain', '高山'],
    '12,62': ['highmountain', '高山'],
    '13,62': ['highmountain', '高山'],
    '14,62': ['highmountain', '高山'],
    '15,62': ['highmountain', '高山'],
    '16,62': ['highmountain', '高山'],
    '18,62': ['highmountain', '高山'],
    '19,62': ['highmountain', '高山'],
    '44,62': ['highmountain', '高山'],
    '45,62': ['highmountain', '高山'],
    '15,63': ['forest', '森林'],
    '16,63': ['forest', '森林'],
    '17,63': ['forest', '森林'],
    '18,63': ['highmountain', '高山'],
    '19,63': ['highmountain', '高山'],
    '18,64': ['highmountain', '高山'],
    '19,64': ['highmountain', '高山']
  };

  function getMapRenderZoom(logicalZoom = null, snapshot = mapState.snapshot) {
    const candidate = logicalZoom === null || logicalZoom === undefined
      ? (typeof mapState !== 'undefined' && mapState ? Number(mapState.zoom) : DEFAULT_MAP_ZOOM)
      : Number(logicalZoom);
    const safeZoom = Number.isFinite(candidate) ? candidate : DEFAULT_MAP_ZOOM;
    const clampedZoom = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, safeZoom));
    const factor = shouldMapLayerFollowZoom(snapshot) ? WORLD_MAP_RENDER_ZOOM_FACTOR : SUBMAP_RENDER_ZOOM_FACTOR;
    return clampedZoom * factor;
  }

  const styleText = `
    #page-map,
    .split-left-page[data-target='page-map'] {
      padding-left: 0 !important;
      padding-right: 0 !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }

    #page-map::-webkit-scrollbar,
    .split-left-page[data-target='page-map']::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
    }

    #page-map .map-layout,
    .split-left-page[data-target='page-map'] .map-layout {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    #page-map .map-layout > .map-hero-card,
    .split-left-page[data-target='page-map'] > .map-hero-card {
      width: 100% !important;
      min-height: 0 !important;
      align-self: stretch !important;
      position: relative !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      overflow: visible !important;
    }

    #page-map .map-layout > .map-hero-card {
      height: auto !important;
      min-height: 0 !important;
    }

    .split-left-page[data-target='page-map'] > .map-hero-card {
      height: auto !important;
      min-height: 0 !important;
      flex: 0 0 auto !important;
      padding-bottom: 6px !important;
    }

    #page-map .map-layout,
    .split-page .map-layout {
      display: grid !important;
      align-items: start !important;
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 10px !important;
    }

    #page-map .map-layout > .map-side-stack {
      display: flex !important;
    }

    #page-map .map-layout > .map-hero-card .map-left-route-card {
      display: block !important;
      flex: 0 0 auto;
      height: auto !important;
      min-height: 0 !important;
    }

    .split-left-page[data-target='page-map'] > .map-hero-card .map-left-route-card {
      display: block !important;
      flex: 0 0 auto;
      height: auto !important;
      min-height: 0 !important;
    }

    .split-right-page[data-target='page-map'] .map-route-card {
      display: none !important;
    }

    .split-left-page[data-target='page-map'] > .map-hero-card .map-control-strip {
      padding: 0 2px !important;
      margin: 0 !important;
    }

    .map-status-strip,
    .map-hero-card .module-foot {
      display: none !important;
    }

    .split-left-page[data-target='page-map'] > .map-hero-card .map-status-strip {
      display: none !important;
    }

    .split-left-page[data-target='page-map'] > .map-hero-card .module-foot {
      display: none !important;
    }

    .map-legend-strip,
    .map-focus-pill,
    .map-coord-strip,
    .map-canvas-hud {
      display: none !important;
    }

    #page-map .map-canvas.map-canvas-large,
    .split-page .map-canvas.map-canvas-large,
    .map-canvas.map-canvas-large.interactive-map {
      position: relative;
      display: block;
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      flex: 0 0 auto !important;
      align-self: stretch !important;
      aspect-ratio: ${WORLD_IMAGE_WIDTH} / ${WORLD_IMAGE_HEIGHT} !important;
      margin-top: 42px !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      margin-bottom: 8px;
      border-radius: 14px;
      border: 1px solid rgba(148,190,220,0.46);
      background: linear-gradient(180deg, #1c3142, #12202d);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04), 0 16px 30px rgba(0,0,0,0.22);
      overflow: hidden;
      cursor: crosshair;
      isolation: isolate;
      touch-action: none;
    }

    .map-canvas.dragging {
      cursor: crosshair;
      -webkit-user-drag: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .map-canvas.dragging .map-world,
    .map-canvas.map-transforming .map-world {
      will-change: transform;
    }

    .map-canvas.dragging .map-node-layer,
    .map-canvas.map-transforming .map-node-layer {
      pointer-events: none;
    }

    .map-canvas.is-editing {
      cursor: crosshair;
    }

    .map-canvas.is-editing .map-node {
      cursor: grab;
    }

    .map-canvas.edit-node-dragging .map-node {
      cursor: grabbing;
    }

    .map-canvas::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 50% 46%, rgba(255,255,255,0.08), transparent 32%),
        linear-gradient(180deg, rgba(255,255,255,0.06), transparent 26%, rgba(0,0,0,0.20));
      mix-blend-mode: screen;
      opacity: 0.72;
      z-index: 0;
    }

    .map-canvas::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 50% 50%, transparent 48%, rgba(6,12,18,0.12) 76%, rgba(5,11,18,0.52) 100%),
        linear-gradient(180deg, rgba(255,255,255,0.03), transparent 20%, rgba(0,0,0,0.18));
      z-index: 5;
    }

    .map-toolbar {
      display: none !important;
    }

    .map-canvas::before,
    .map-canvas::after {
      display: none !important;
    }

    .map-control-strip {
      position: relative;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 0;
      flex: 0 0 auto;
    }

    .map-stage-head {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      pointer-events: none;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      width: auto;
      margin: 0;
      padding: 0;
    }

    .map-stage-head > * {
      pointer-events: auto;
    }

    .map-mini-panel {
      position: relative;
      left: auto;
      top: auto;
      z-index: 2;
      flex: 0 0 auto;
      width: 136px;
    }

    .map-mini-world {
      position: relative;
      width: 100%;
      aspect-ratio: 1981 / 1110;
      cursor: grab;
      touch-action: none;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(164,196,219,0.20);
      background: rgba(14,24,34,0.92);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
    }

    .map-mini-art {
      position: absolute;
      inset: 0;
      background-image: url('${ASSETS.world}');
      background-repeat: no-repeat;
      background-size: 100% 100%;
      background-position: center;
      filter: none;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }

    .map-mini-viewport {
      position: absolute;
      cursor: grab;
      touch-action: none;
      border: 1px solid rgba(130,227,255,0.95);
      box-shadow: 0 0 0 9999px rgba(8,15,22,0.22), inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 10px rgba(95,211,248,0.20);
      background: rgba(117,215,255,0.08);
      border-radius: 4px;
    }

    .map-mini-world.dragging,
    .map-mini-world.dragging .map-mini-viewport {
      cursor: grabbing;
    }

    .map-mini-marker {
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 0 1px rgba(11,20,30,0.86), 0 0 8px rgba(0,0,0,0.24);
    }

    .map-mini-marker.current { background: #f3d27d; }
    .map-mini-marker.target { background: #7fe4ff; }
    .map-mini-marker.is-hidden { display: none; }
    }


    #page-map .map-layout .map-tool-btn,
    .split-page .map-tool-btn {
      width: 36px;
      height: 36px;
      padding: 2px !important;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      appearance: none !important;
      -webkit-appearance: none !important;
      border: 1px solid rgba(180,240,255,0.85) !important;
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(26,50,66,0.98), rgba(16,33,48,0.98)) !important;
      color: #ffffff !important;
      font-family: 'Segoe UI Symbol', 'Noto Sans Symbols 2', var(--font-ui), sans-serif !important;
      font-size: 22px !important;
      line-height: 1;
      font-weight: 800;
      cursor: pointer;
      text-shadow: 0 1px 2px rgba(0,0,0,0.72) !important;
      box-shadow: 0 8px 18px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.05) !important;
      transition: transform 0.12s ease, filter 0.12s ease, opacity 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, color 0.12s ease;
      outline: none;
      opacity: 1 !important;
      user-select: none;
    }

    #page-map .map-layout .map-tool-btn:hover,
    .split-page .map-tool-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.08) contrast(1.04);
      border-color: rgba(191,239,255,0.82) !important;
      box-shadow: 0 10px 22px rgba(0,0,0,0.30), inset 0 0 0 1px rgba(255,255,255,0.08) !important;
    }

    .map-tool-btn:disabled {
      display: none !important;
    }

    .map-tool-btn:disabled:hover {
      transform: none;
    }

    .map-tool-btn.active {
      border-color: rgba(111,212,255,0.82) !important;
      color: #ffffff !important;
      box-shadow: inset 0 0 14px rgba(111,212,255,0.18), 0 8px 18px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(255,255,255,0.07) !important;
    }

    .map-tool-btn[data-map-control='enter'].active {
      border-color: rgba(118,226,255,0.62) !important;
      color: #dffbff !important;
      background: linear-gradient(180deg, rgba(28,66,82,0.98), rgba(14,36,48,0.98)) !important;
      box-shadow: inset 0 0 14px rgba(106,220,255,0.18), 0 6px 14px rgba(0,0,0,0.24), 0 0 10px rgba(80,206,245,0.16) !important;
    }

    .map-tool-btn[data-map-control='back'].active {
      border-color: rgba(255,211,134,0.58);
      color: #fff0ca;
      background: linear-gradient(180deg, rgba(72,54,30,0.96), rgba(40,28,15,0.96));
      box-shadow: inset 0 0 14px rgba(255,209,120,0.14), 0 6px 14px rgba(0,0,0,0.24), 0 0 10px rgba(222,179,95,0.12);
    }

    .map-tool-btn.wide {
      width: auto;
      min-width: 54px;
      padding: 0 10px;
      border-radius: 999px;
      font-size: 11px;
    }

    .map-legend-strip {
      position: absolute;
      left: 10px;
      top: 56px;
      z-index: 8;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      max-width: 58%;
    }

    .map-canvas.is-calibrating .map-legend-strip,
    .map-canvas.is-calibrating .map-focus-pill,
    .map-canvas.is-calibrating .map-coord-strip,
    .map-canvas.is-calibrating .map-node-layer,
    .map-canvas.is-calibrating .map-free-marker,
    .map-canvas.is-calibrating .map-crosshair,
    .map-canvas.is-calibrating .map-canvas-hud {
      display: none !important;
    }

    .map-canvas.is-calibrating .map-node-layer {
      display: block !important;
      pointer-events: auto;
    }


    .map-legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: 999px;
      padding: 5px 8px;
      background: rgba(12,21,32,0.72);
      border: 1px solid rgba(180,200,220,0.16);
      color: rgba(239,245,249,0.86);
      font-size: 9px;
      line-height: 1;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
    }

    .map-legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #d7e0e5;
      box-shadow: 0 2px 6px rgba(0,0,0,0.22);
      flex: 0 0 auto;
    }

    .map-legend-dot.major {
      background: #d3b46c;
      box-shadow: 0 2px 6px rgba(126,96,36,0.30);
    }

    .map-focus-pill {
      position: absolute;
      left: 166px;
      top: 10px;
      z-index: 8;
      border-radius: 999px;
      padding: 6px 10px;
      border: 1px solid rgba(170,194,214,0.18);
      background: rgba(11,21,32,0.78);
      color: #edf3f8;
      font-size: 10px;
      line-height: 1;
      white-space: nowrap;
      box-shadow: 0 8px 18px rgba(0,0,0,0.20);
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .map-coord-strip {
      position: absolute;
      right: 10px;
      top: 124px;
      z-index: 8;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 5px;
      pointer-events: none;
    }

    .map-coord-chip {
      border-radius: 999px;
      padding: 5px 8px;
      background: rgba(10,20,30,0.82);
      border: 1px solid rgba(176,198,220,0.18);
      color: rgba(233,240,245,0.90);
      font-size: 9px;
      line-height: 1;
      white-space: nowrap;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.18);
    }

    .map-coord-chip.live {
      color: #f8fbff;
      border-color: rgba(114,168,215,0.36);
      background: rgba(24,62,92,0.88);
    }

    .map-world {
      position: absolute;
      inset: 0;
      transform-origin: center center;
      z-index: 1;
      will-change: auto;
      backface-visibility: visible;
    }

    .map-terrain,
    .map-node-layer {
      position: absolute;
      inset: 0;
    }

    .map-terrain {
      pointer-events: none;
      -webkit-user-drag: none;
      user-select: none;
      z-index: 1;
      overflow: hidden;
    }

    .map-node-layer {
      z-index: 4;
      overflow: hidden;
    }

    .map-terrain-art {
      position: absolute;
      inset: 0;
      background-image: url('${ASSETS.world}');
      background-repeat: no-repeat;
      background-size: 100% 100%;
      background-position: center;
      filter: none;
      box-shadow: inset 0 0 28px rgba(0,0,0,0.03);
      image-rendering: auto;
      image-rendering: smooth;
    }

    .map-terrain-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      filter: saturate(1.02) contrast(1.04) brightness(0.97);
    }

    .map-continent-fill {
      stroke: #d0dab8;
      stroke-width: 16;
      vector-effect: non-scaling-stroke;
    }

    .map-continent-label {
      fill: rgba(239,246,250,0.76);
      font-size: 68px;
      font-weight: 700;
      letter-spacing: 4px;
      paint-order: stroke;
      stroke: rgba(11,21,32,0.52);
      stroke-width: 8;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }

    .map-canvas.dragging .map-terrain-svg,
    .map-canvas.map-transforming .map-terrain-svg {
      filter: none;
    }

    .map-terrain-region {
      fill: rgba(99,196,138,0.12);
      stroke: rgba(99,196,138,0.28);
      stroke-width: 10;
      vector-effect: non-scaling-stroke;
    }

    .map-terrain-region.forest {
      fill: rgba(43,138,68,0.28);
      stroke: rgba(99,196,138,0.38);
    }

    .map-terrain-region.mountain {
      fill: rgba(127,94,76,0.22);
      stroke: rgba(171,142,118,0.22);
    }

    .map-terrain-region.ice {
      fill: rgba(198,225,240,0.25);
      stroke: rgba(220,240,255,0.28);
    }

    .map-terrain-region.water {
      fill: rgba(72,160,200,0.35);
      stroke: rgba(123,203,235,0.48);
    }

    .map-terrain-region.border {
      fill: rgba(255,176,71,0.10);
      stroke: rgba(255,176,71,0.22);
    }

    .map-terrain-mask {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 50% 46%, rgba(255,255,255,0.06), transparent 28%),
        linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.08));
      pointer-events: none;
    }

    .map-node {
      position: absolute;
      transform: translate(-50%, -50%) scale(var(--node-ui-scale, 1));
      transform-origin: center center;
      display: block;
      cursor: pointer;
      z-index: 4;
      padding: 0;
      border: none;
      background: transparent;
      pointer-events: auto;
      transition: opacity .18s ease, transform .18s ease, filter .18s ease;
    }

    .map-canvas.dragging .map-node,
    .map-canvas.map-transforming .map-node {
      transition: none;
    }

    .map-node.is-hidden {
      opacity: 0;
      pointer-events: none;
    }

    .map-node:hover {
      filter: brightness(1.06);
    }

    .map-canvas.dragging .map-node:hover,
    .map-canvas.map-transforming .map-node:hover {
      filter: none;
    }

    .map-node.point .map-dot {
      display: block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #edf2f5;
      box-shadow: 0 0 0 2px rgba(8,14,20,0.46), 0 2px 8px rgba(0,0,0,0.32);
      border: 1px solid rgba(10,16,22,0.90);
    }

    .map-node.point .map-dot.major {
      width: 9px;
      height: 9px;
      background: #d8bd72;
      box-shadow: 0 0 0 2px rgba(38,30,16,0.42), 0 3px 10px rgba(0,0,0,0.34);
    }

    .map-node.point.point-kind-settlement .map-dot {
      width: 8px;
      height: 8px;
      background: #d8bd72;
      box-shadow: 0 0 0 2px rgba(38,30,16,0.42), 0 3px 10px rgba(0,0,0,0.34);
    }

    .map-node.point.point-kind-terrain .map-dot {
      width: 6px;
      height: 6px;
      background: #8fcfe0;
      box-shadow: 0 0 0 2px rgba(16,32,38,0.36), 0 2px 8px rgba(0,0,0,0.28);
    }

    .map-node.point.point-kind-dynamic .map-dot {
      background: #d06a60;
    }

    .map-node.state-ruins.point:not(.current):not(.origin) .map-dot {
      background: #cf6d64;
      border-color: rgba(86,20,20,0.92);
      box-shadow: 0 0 0 2px rgba(49,12,12,0.44), 0 0 0 4px rgba(176,67,58,0.16), 0 3px 10px rgba(65,18,14,0.34);
    }

    .map-node.state-rebuild.point:not(.current):not(.origin) .map-dot {
      background: #d8bd72;
      border-color: rgba(92,70,20,0.92);
      box-shadow: 0 0 0 2px rgba(53,43,15,0.42), 0 0 0 4px rgba(220,189,93,0.14), 0 3px 10px rgba(69,54,16,0.30);
    }

    .map-node.state-rebuilt.point:not(.current):not(.origin) .map-dot {
      background: #76c894;
      border-color: rgba(18,68,40,0.90);
      box-shadow: 0 0 0 2px rgba(13,42,24,0.42), 0 0 0 4px rgba(97,194,129,0.14), 0 3px 10px rgba(14,49,24,0.30);
    }

    .map-node.point.point-kind-settlement .map-node-label { color: #fff2bf; }
    .map-node.point.point-kind-terrain .map-node-label { color: #f4fcff; }
    .map-node.state-ruins .map-node-label { color: rgba(255,202,194,0.97); }
    .map-node.state-rebuild .map-node-label { color: rgba(255,233,181,0.97); }
    .map-node.state-rebuilt .map-node-label { color: rgba(207,248,219,0.97); }

    .map-node-state-tag {
      margin-left: 4px;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.1px;
      opacity: 0.96;
    }

    .map-node-state-tag.is-ruins { color: rgba(255,183,171,0.98); }
    .map-node-state-tag.is-rebuild { color: rgba(255,224,148,0.98); }
    .map-node-state-tag.is-rebuilt { color: rgba(178,245,198,0.98); }

    .map-node.current.point .map-dot {
      background: #e16f65;
      box-shadow: 0 0 0 2px rgba(198,94,84,0.10), 0 0 7px rgba(198,94,84,0.20);
    }

    .map-node.origin.point .map-dot {
      background: #d8bd72;
      box-shadow: 0 0 0 2px rgba(216,189,114,0.10), 0 0 7px rgba(216,189,114,0.20);
    }

    .map-node.point.enterable .map-dot {
      position: relative;
      border-color: rgba(120,223,255,0.96);
    }

    .map-node.point.enterable:not(.current):not(.origin) .map-dot {
      box-shadow: 0 0 0 2px rgba(8,14,20,0.46), 0 0 0 4px rgba(73,164,202,0.18), 0 3px 12px rgba(32,98,131,0.32);
    }

    .map-node.point.enterable.current .map-dot,
    .map-node.point.enterable.origin .map-dot {
      box-shadow: 0 0 0 2px rgba(8,14,20,0.46), 0 0 0 4px rgba(73,164,202,0.18), 0 0 10px rgba(95,208,243,0.36);
    }

    .map-canvas.dragging .map-node.point .map-dot,
    .map-canvas.map-transforming .map-node.point .map-dot {
      box-shadow: none;
    }

    .map-node.point.enterable .map-dot::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 15px;
      height: 15px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1px dashed rgba(127,229,255,0.58);
      opacity: 0.92;
      pointer-events: none;
    }

    .map-node.point.enterable:hover .map-dot::after { border-style: solid; }

    .map-node-label {
      position: absolute;
      left: 50%;
      top: var(--label-top, 100%);
      bottom: var(--label-bottom, auto);
      transform: translate(calc(var(--label-shift-x, -50%) + var(--label-offset-x, 0px)), calc(var(--label-shift-y, 2px) + var(--label-offset-y, 0px)));
      padding: 2px 4px;
      border-radius: 6px;
      font-family: var(--font-ui);
      font-size: 10px;
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: 0.12px;
      color: #f8fcff;
      white-space: nowrap;
      background: rgba(4, 10, 14, 0.42);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 1px 4px rgba(0,0,0,0.22);
      text-shadow: 0 1px 1px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,0.95), 0 0 9px rgba(0,0,0,0.82);
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
      pointer-events: auto;
      user-select: none;
    }

    .map-node.edge-left {
      --label-shift-x: 4px;
    }

    .map-node.edge-right {
      --label-shift-x: calc(-100% - 4px);
    }

    .map-node.edge-bottom {
      --label-top: auto;
      --label-bottom: 100%;
      --label-shift-y: -4px;
    }

    .map-node.edge-top {
      --label-shift-y: 8px;
    }

    .map-node.custom-node .map-dot {
      background: #79d8ff;
      box-shadow: 0 0 0 2px rgba(39,117,151,0.18), 0 2px 8px rgba(0,0,0,0.32);
    }

    .map-node[data-node='史莱克学院'] {
      z-index: 5;
    }
    .map-node[data-node='史莱克学院'] .map-dot {
      width: 14px;
      height: 14px;
      background: #ffd872;
      box-shadow: 0 0 0 3px rgba(38,30,16,0.6), 0 4px 14px rgba(0,0,0,0.45);
      border: 1px solid rgba(255,255,255,0.8);
    }

    .map-node.current .map-node-label {
      color: #ffd0c9;
    }

    .map-node.origin .map-node-label {
      color: #ffe6ad;
    }

    .map-node-enter-tag {
      margin-left: 3px;
      color: rgba(140,233,255,0.96);
      font-weight: 700;
      text-shadow: 0 0 8px rgba(66,171,207,0.42);
    }

    .map-node.current .map-node-enter-tag { color: #ffd7d0; }
    .map-node.origin .map-node-enter-tag { color: #ffe9b8; }

    .map-free-marker {
      display: none !important;
      position: absolute;
      width: 8px;
      height: 8px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      z-index: 6;
      pointer-events: none;
      transition: opacity .12s ease;
    }

    .map-free-marker.current {
      background: rgba(216,189,114,0.22);
      border: 1px solid rgba(216,189,114,0.68);
      box-shadow: 0 0 0 2px rgba(216,189,114,0.10);
    }

    .map-free-marker.target {
      background: rgba(206,108,96,0.20);
      border: 1px solid rgba(206,108,96,0.62);
      box-shadow: 0 0 0 2px rgba(206,108,96,0.08);
    }

    .map-free-marker.is-hidden {
      opacity: 0;
    }

    .map-crosshair {
      display: none !important;
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 7;
      --cross-x: 50%;
      --cross-y: 50%;
      opacity: 1;
      transition: opacity .12s ease;
    }

    .map-crosshair.is-hidden {
      opacity: 0;
    }

    .map-crosshair-line {
      position: absolute;
      background: rgba(255,255,255,0.24);
      box-shadow: 0 0 8px rgba(255,255,255,0.08);
    }

    .map-crosshair-line.h {
      left: 0;
      right: 0;
      top: var(--cross-y);
      height: 1px;
      transform: translateY(-50%);
    }

    .map-crosshair-line.v {
      top: 0;
      bottom: 0;
      left: var(--cross-x);
      width: 1px;
      transform: translateX(-50%);
    }

    .map-crosshair-dot {
      position: absolute;
      left: var(--cross-x);
      top: var(--cross-y);
      width: 12px;
      height: 12px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.78);
      background: rgba(63,122,175,0.20);
      box-shadow: 0 0 0 4px rgba(63,122,175,0.08), 0 0 12px rgba(63,122,175,0.18);
    }

    .map-canvas-hud {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: 10px;
      z-index: 8;
      display: grid;
      grid-template-columns: 1.16fr 0.84fr;
      gap: 8px;
    }

    .map-maintenance-menu {
      position: fixed;
      z-index: var(--mvu-z-popover, 10060);
      display: grid;
      gap: 4px;
      width: 126px;
      padding: 6px;
      border-radius: 10px;
      border: 1px solid rgba(77,240,255,0.22);
      background: rgba(4,14,24,0.94);
      box-shadow: 0 14px 30px rgba(0,0,0,0.34), inset 0 0 12px rgba(77,240,255,0.04);
    }

    .map-maintenance-menu button {
      appearance: none;
      -webkit-appearance: none;
      min-height: 28px;
      padding: 6px 8px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #d9f8ff;
      font-size: 11px;
      font-weight: 760;
      line-height: 1;
      text-align: left;
      cursor: pointer;
    }

    .map-maintenance-menu button:hover {
      background: rgba(77,240,255,0.12);
      color: #8bf4ff;
    }

    .map-maintenance-modal {
      position: fixed;
      inset: 0;
      z-index: var(--mvu-z-modal, 10050);
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(1, 8, 14, 0.58);
      backdrop-filter: blur(8px);
    }

    .map-maintenance-dialog {
      width: min(430px, 94vw);
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: 14px;
      border: 1px solid rgba(77,240,255,0.26);
      background: linear-gradient(180deg, rgba(9, 29, 43, 0.98), rgba(5, 17, 28, 0.98));
      box-shadow: 0 22px 70px rgba(0,0,0,0.48), inset 0 0 18px rgba(77,240,255,0.05);
      color: #e8f8ff;
    }

    .map-maintenance-dialog h3 {
      margin: 0;
      font-size: 16px;
      line-height: 1.2;
      color: #f2fbff;
    }

    .map-maintenance-dialog small {
      color: rgba(175, 220, 236, 0.78);
      font-size: 11px;
      line-height: 1.35;
    }

    .map-maintenance-grid {
      display: grid;
      gap: 8px;
    }

    .map-maintenance-field {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .map-maintenance-field span {
      color: rgba(175, 220, 236, 0.78);
      font-size: 11px;
      line-height: 1;
    }

    .map-maintenance-field input,
    .map-maintenance-field select,
    .map-maintenance-field textarea {
      width: 100%;
      min-width: 0;
      border: 1px solid rgba(77,240,255,0.24);
      border-radius: 9px;
      background: rgba(3, 16, 27, 0.86);
      color: #f2fbff;
      padding: 9px 10px;
      font-size: 13px;
      outline: none;
    }

    .map-maintenance-field textarea {
      min-height: 64px;
      resize: vertical;
    }

    .map-maintenance-checks {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .map-maintenance-checks label {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      padding: 8px;
      border: 1px solid rgba(77,240,255,0.16);
      border-radius: 9px;
      background: rgba(10, 35, 50, 0.56);
      color: #dff7ff;
      font-size: 12px;
    }

    .map-maintenance-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }

    .map-maintenance-actions button {
      appearance: none;
      -webkit-appearance: none;
      min-height: 32px;
      padding: 7px 12px;
      border-radius: 9px;
      border: 1px solid rgba(77,240,255,0.22);
      background: rgba(10, 35, 50, 0.78);
      color: #dff7ff;
      font-size: 12px;
      font-weight: 760;
      cursor: pointer;
    }

    .map-maintenance-actions button[data-map-maintenance-submit="confirm"] {
      background: rgba(77, 240, 255, 0.16);
      color: #8bf4ff;
    }

    .map-hover-tooltip {
      position: absolute;
      left: 0;
      top: 0;
      z-index: 11;
      min-width: 0;
      max-width: 180px;
      padding: 0;
      border-radius: 0;
      background: transparent;
      border: none;
      box-shadow: none;
      pointer-events: none;
      backdrop-filter: none;
      transform: translate(10px, -10px);
    }

    .map-hover-tooltip b {
      display: block;
      margin-bottom: 2px;
      font-size: 10px;
      color: #eef7ff;
      font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.45);
    }

    .map-hover-tooltip span {
      display: block;
      font-size: 10px;
      line-height: 1.35;
      color: rgba(220,238,248,0.88);
      text-shadow: 0 1px 3px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.45);
    }

    .map-hud-card {
      border-radius: 12px;
      padding: 8px 9px;
      background: rgba(8,16,24,0.58);
      border: 1px solid rgba(180,206,227,0.10);
      box-shadow: 0 6px 18px rgba(0,0,0,0.18);
    }

    .map-hud-card b {
      display: block;
      margin-bottom: 4px;
      font-size: 9px;
      color: rgba(199,215,228,0.72);
      font-weight: 500;
    }

    .map-hud-card span {
      display: block;
      font-size: 10px;
      line-height: 1.35;
      color: #eef4f7;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .map-hud-card.live {
      border-color: rgba(255,241,213,0.18);
    }

    .map-hud-card.gold {
      border-color: rgba(205,155,66,0.28);
    }

    .map-hud-card.actionable {
      cursor: pointer;
      transition: .18s ease;
    }

    .map-hud-card.actionable:hover {
      border-color: rgba(228,173,70,0.38);
      box-shadow: inset 0 0 12px rgba(218,164,61,0.12), 0 0 12px rgba(171,122,31,0.08);
    }

    .map-hud-card.actionable.disabled {
      cursor: default;
      opacity: .72;
      filter: saturate(.78);
    }

    .map-status-strip {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
    }

    .map-status-chip {
      border-radius: 12px;
      padding: 7px 8px;
      background: rgba(10,18,27,0.82);
      border: 1px solid rgba(173,196,216,0.10);
      box-shadow: 0 8px 18px rgba(0,0,0,0.16);
    }

    .map-status-chip b {
      display: block;
      margin-bottom: 4px;
      font-size: 9px;
      color: rgba(193,210,223,0.68);
      font-weight: 600;
    }

    .map-status-chip.is-error {
      border-color: rgba(248,113,113,0.30);
      background: rgba(58,22,22,0.88);
    }

    .map-status-chip span {
      font-size: 10px;
      line-height: 1.35;
      color: #eef4f7;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .map-status-chip.live {
      border-color: rgba(101,151,197,0.24);
      background: rgba(18,41,60,0.90);
    }

    .map-status-chip.gold {
      border-color: rgba(200,169,98,0.22);
      background: rgba(52,43,25,0.86);
    }

    .map-side-card {
      background: linear-gradient(180deg, rgba(8,16,24,0.88), rgba(11,21,31,0.78));
      border-color: rgba(165,188,208,0.10);
      box-shadow: 0 12px 28px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.03);
    }

    .map-side-badge {
      border-radius: 999px;
      padding: 4px 7px;
      border: 1px solid rgba(171,194,214,0.16);
      background: rgba(16,29,41,0.88);
      font-size: 9px;
      line-height: 1;
      color: #dbe7ef;
      white-space: nowrap;
    }

    .map-side-badge.gold {
      background: rgba(53,44,26,0.90);
      border-color: rgba(205,166,92,0.22);
      color: #f0dcab;
    }

    .map-panel-mode-strip {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin: 0 0 8px;
    }

    .map-panel-mode-btn {
      appearance: none;
      cursor: pointer;
      font: inherit;
    }

    .map-panel-mode-btn.current {
      border-color: rgba(101,151,197,0.32);
      background: rgba(18,41,60,0.92);
      color: #eef8ff;
    }

    .map-layer-pills,
    .map-event-strip {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .map-layer-pill,
    .map-event-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 999px;
      padding: 5px 8px;
      border: 1px solid rgba(170,192,213,0.14);
      background: rgba(13,24,35,0.82);
      font-size: 9px;
      line-height: 1;
      color: #dfe9ef;
      box-shadow: 0 4px 10px rgba(0,0,0,0.16);
    }

    .map-layer-pill[data-map-layer-pill] {
      cursor: pointer;
      transition: .18s ease;
    }

    .map-layer-pill[data-map-layer-pill]:hover {
      border-color: rgba(146,187,221,0.28);
      color: #ffffff;
    }

    .map-layer-pill.current,
    .map-event-chip.live {
      color: #f7fbff;
      border-color: rgba(98,150,197,0.30);
      background: rgba(32,71,104,0.92);
    }

    .map-npc-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 6px;
      max-height: min(360px, 42vh);
      overflow-y: auto;
      padding-right: 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(118,226,255,0.34) rgba(255,255,255,0.04);
    }

    .map-npc-panel {
      min-width: 0;
      height: 100%;
    }

    .map-npc-panel--unified {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .map-npc-panel--unified .map-npc-list {
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
      margin-top: 0;
      padding-right: 2px;
    }

    .map-npc-roster-head {
      flex: 0 0 auto;
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 2px 2px 8px;
      margin-bottom: 2px;
      border-bottom: 1px solid rgba(118,226,255,0.15);
      background: linear-gradient(180deg, rgba(8,16,24,0.98), rgba(8,16,24,0.74));
      color: rgba(216, 243, 255, 0.78);
      font-size: 10px;
      line-height: 1.2;
    }

    .map-npc-roster-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: #76e2ff;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      text-shadow: 0 0 8px rgba(118,226,255,0.4);
      overflow: hidden;
    }

    .map-npc-roster-title::before {
      content: '';
      flex: 0 0 auto;
      width: 3px;
      height: 1em;
      border-radius: 999px;
      background: #76e2ff;
      box-shadow: 0 0 8px rgba(118,226,255,0.55), 0 0 14px rgba(118,226,255,0.22);
    }

    .map-npc-roster-title-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .map-npc-roster-badge {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 7px;
      border-radius: 4px;
      border: 1px solid rgba(118,226,255,0.16);
      background: rgba(118,226,255,0.1);
      color: #dff5ff;
      font-size: 9px;
      line-height: 1;
      white-space: nowrap;
    }

    .map-npc-empty {
      flex: 0 0 auto;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px dashed rgba(146,187,221,0.22);
      background: rgba(10, 22, 32, 0.42);
      font-size: 11px;
      line-height: 1.6;
      color: #9fbccc;
    }

    .map-npc-card {
      flex: 0 0 auto;
      border-radius: 8px;
      border: 1px solid rgba(168, 192, 214, 0.14);
      border-left: 2px solid rgba(118,226,255,0.2);
      background: linear-gradient(90deg, rgba(16,32,46,0.7), rgba(16,32,46,0.2));
      padding: 8px 10px;
      min-height: 42px;
      transition: .18s ease;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto auto auto;
      align-items: start;
      column-gap: 8px;
      row-gap: 4px;
      overflow: hidden;
    }

    .map-npc-card.current {
      border-color: rgba(118,226,255,0.34);
      border-left-color: rgba(118,226,255,0.88);
      background: linear-gradient(90deg, rgba(16,32,46,0.92), rgba(16,32,46,0.34));
      box-shadow: 0 0 0 1px rgba(118,226,255,0.08), 0 10px 24px rgba(0,0,0,0.18), 0 0 18px rgba(118,226,255,0.12);
    }

    .map-npc-card-head {
      display: contents;
    }

    .map-npc-name {
      appearance: none;
      border: 0;
      background: transparent;
      padding: 0;
      margin: 0;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.2;
      color: #eef7fd;
      text-shadow: 0 0 8px rgba(118,226,255,0.16);
      text-align: left;
      cursor: pointer;
      grid-column: 1;
      grid-row: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .map-npc-card-head .map-event-chip {
      grid-column: 2;
      grid-row: 1;
      justify-self: end;
      align-self: start;
      padding: 4px 7px;
      font-size: 9px;
      border-radius: 4px;
      background: rgba(118,226,255,0.1);
      border-color: rgba(118,226,255,0.16);
      color: #dff5ff;
      box-shadow: none;
    }

    .map-npc-card-head .map-event-chip.live {
      background: rgba(118,226,255,0.16);
      border-color: rgba(118,226,255,0.24);
      color: #f3fbff;
    }

    .map-npc-name:hover,
    .map-npc-name.current {
      color: #76e2ff;
      text-shadow: 0 0 10px rgba(118,226,255,0.28);
    }

    .map-npc-meta {
      margin-top: 0;
      padding-top: 2px;
      border-top: 1px solid rgba(118,226,255,0.08);
      font-size: 10px;
      line-height: 1.4;
      color: #8aabc2;
      grid-column: 1 / -1;
      grid-row: 2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .map-npc-meta.is-location {
      color: #8aabc2;
      font-weight: 500;
    }

    .map-npc-actions {
      display: none;
      grid-template-columns: repeat(auto-fit, minmax(42px, 1fr));
      gap: 4px;
      grid-column: 1 / -1;
      grid-row: 3;
      margin-top: 2px;
    }

    .map-npc-card.current .map-npc-actions,
    .map-npc-card:hover .map-npc-actions,
    .map-npc-card:focus-within .map-npc-actions,
    .map-npc-actions.is-visible {
      display: grid;
    }

    .map-npc-action-btn {
      appearance: none;
      border: 1px solid rgba(170,192,213,0.14);
      background: rgba(13,24,35,0.82);
      color: #dfe9ef;
      border-radius: 999px;
      padding: 5px 6px;
      font-size: 9px;
      line-height: 1;
      cursor: pointer;
      transition: .18s ease;
      box-shadow: 0 4px 10px rgba(0,0,0,0.16);
      min-width: 0;
      white-space: nowrap;
    }

    .map-npc-action-btn:hover {
      border-color: rgba(146,187,221,0.28);
      color: #ffffff;
    }

    .map-npc-action-btn.current {
      color: #f7fbff;
      border-color: rgba(98,150,197,0.30);
      background: rgba(32,71,104,0.92);
    }

    .map-event-chip.warn {
      color: #fff0eb;
      border-color: rgba(196,98,83,0.24);
      background: rgba(120,49,43,0.78);
    }

    .map-request-code {
      margin: 0;
      border-radius: 10px;
      padding: 10px 12px;
      border: 1px solid rgba(134,171,201,0.16);
      background: rgba(8,14,22,0.72);
      color: #dce6ed;
      font-size: 10px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
      box-shadow: inset 0 0 16px rgba(0,0,0,0.14);
      max-height: 52px;
      overflow-y: auto;
    }

    .map-action-control-row {
      display: grid;
      grid-template-columns: minmax(108px, 0.34fr) minmax(0, 1fr);
      align-items: stretch;
      gap: 6px;
      min-width: 0;
      margin-bottom: 5px;
    }

    .map-action-primary,
    .map-action-select-wrap,
    .map-action-detail-cell {
      min-width: 0;
      border: 1px solid rgba(134,171,201,0.14);
      background: rgba(7,18,27,0.56);
      color: #dcecf7;
      font: inherit;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.025);
    }

    .map-action-primary {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 6px;
      border-radius: 8px;
      padding: 6px 9px;
      cursor: pointer;
      text-align: left;
    }

    .map-action-primary b,
    .map-action-select-wrap b,
    .map-action-detail-cell b {
      color: rgba(150,200,218,0.78);
      font-size: 10px;
      line-height: 1;
      font-weight: 700;
      white-space: nowrap;
    }

    .map-action-primary span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #f2fbff;
      font-size: 11px;
      line-height: 1;
      font-weight: 700;
    }

    .map-action-select-wrap {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 7px;
      border-radius: 8px;
      padding: 5px 8px;
    }

    .map-action-select {
      min-width: 0;
      width: 100%;
      border: 0;
      outline: none;
      background: transparent;
      color: #f1fbff;
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
    }

    .map-action-select option {
      background: #06111c;
      color: #eef8ff;
    }

    .map-action-primary:hover:not(.disabled),
    .map-action-primary:focus-visible,
    .map-action-select-wrap:focus-within,
    .map-method-select:hover:not(.disabled),
    .map-method-select:focus-visible {
      border-color: rgba(118,226,255,0.32);
      background: rgba(12,36,52,0.72);
      outline: none;
    }

    .map-action-detail-row {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.8fr) minmax(0, 1.2fr);
      gap: 1px;
      min-width: 0;
      overflow: hidden;
    }

    .map-action-detail-row.has-method {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(28px, auto));
    }

    .map-action-detail-cell {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 6px;
      border-radius: 0;
      padding: 5px 9px;
    }

    .map-action-detail-cell > b,
    .map-action-detail-cell > span,
    .map-inline-training-select {
      grid-row: 1;
    }

    .map-action-detail-cell > b {
      grid-column: 1;
    }

    .map-action-detail-cell > span,
    .map-inline-training-select {
      grid-column: 2;
    }

    .map-action-detail-cell span {
      min-width: 0;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      text-overflow: clip;
      white-space: normal;
      color: #e9f9ff;
      font-size: 10.5px;
      line-height: 1.18;
      text-align: left;
    }

    .map-method-select {
      cursor: pointer;
    }

    .map-action-detail-cell.is-actionable {
      cursor: pointer;
    }

    .map-action-detail-cell.is-actionable:hover,
    .map-action-detail-cell.is-actionable:focus-visible {
      border-color: rgba(118, 226, 255, 0.28);
      background: linear-gradient(180deg, rgba(13, 45, 64, 0.72), rgba(3, 16, 25, 0.72));
    }

    .map-action-primary.disabled,
    .map-action-detail-row.disabled,
    .map-method-select.disabled {
      opacity: 0.5;
      cursor: default;
    }

    .map-method-select.is-hidden,
    .map-duration-select-wrap.is-hidden,
    .map-inline-training-select.is-hidden,
    .map-action-detail-cell span.is-hidden {
      display: none;
    }

    .map-action-detail-cell.training-active [data-map-request-targetloc] {
      display: none;
    }

    .map-move-action-layer {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(0, 8, 14, 0.62);
      backdrop-filter: blur(6px);
    }

    .map-move-action-dialog {
      width: min(420px, 94vw);
      border: 1px solid rgba(118, 226, 255, 0.22);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(10, 24, 36, 0.96), rgba(3, 12, 20, 0.98));
      box-shadow: 0 18px 46px rgba(0, 0, 0, 0.42), inset 0 0 0 1px rgba(255, 255, 255, 0.025);
      color: #e8f7ff;
      overflow: hidden;
    }

    .map-move-action-head,
    .map-move-action-row,
    .map-move-action-actions {
      display: grid;
      gap: 6px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(134, 171, 201, 0.12);
    }

    .map-move-action-head b {
      font-size: 13px;
      line-height: 1.2;
      color: #f4fbff;
    }

    .map-move-action-head span,
    .map-move-action-row span {
      min-width: 0;
      color: #9fbdd0;
      font-size: 11px;
      line-height: 1.35;
    }

    .map-move-action-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px;
      background: rgba(134, 171, 201, 0.08);
    }

    .map-move-action-row {
      background: rgba(5, 16, 25, 0.92);
      border-bottom: 0;
    }

    .map-move-action-row b {
      color: rgba(150, 200, 218, 0.82);
      font-size: 10px;
      line-height: 1;
    }

    .map-move-action-method {
      grid-column: 1 / -1;
    }

    .map-move-action-method select {
      width: 100%;
      min-width: 0;
      border: 1px solid rgba(134, 171, 201, 0.16);
      border-radius: 6px;
      background: rgba(6, 17, 28, 0.94);
      color: #f1fbff;
      padding: 7px 8px;
      font: inherit;
      font-size: 12px;
      outline: none;
    }

    .map-move-action-method option {
      background: #06111c;
      color: #eef8ff;
    }

    .map-move-action-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-bottom: 0;
      background: rgba(2, 9, 16, 0.72);
    }

    .map-move-action-actions button {
      border: 1px solid rgba(134, 171, 201, 0.18);
      border-radius: 7px;
      background: rgba(12, 28, 41, 0.9);
      color: #eaf8ff;
      padding: 8px 10px;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .map-move-action-actions button:hover:not(:disabled),
    .map-move-action-actions button:focus-visible {
      border-color: rgba(118, 226, 255, 0.34);
      background: rgba(16, 45, 64, 0.96);
      outline: none;
    }

    .map-move-action-actions button[data-map-move-action-submit] {
      border-color: rgba(118, 226, 255, 0.28);
      background: rgba(18, 74, 98, 0.92);
    }

    .map-move-action-actions button:disabled {
      opacity: 0.45;
      cursor: default;
    }

    .simple-row.actionable {
      cursor: pointer;
      transition: all 0.2s;
      border-radius: 6px;
      padding: 4px;
      margin: -4px;
      margin-bottom: 2px;
      border: 1px solid transparent;
    }

    .simple-row.actionable:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.1);
      color: #ffffff;
    }

    .simple-row.actionable.active {
      background: rgba(118,226,255,0.12);
      border-color: rgba(118,226,255,0.2);
      color: #76e2ff;
    }

    .simple-row.actionable.disabled {
      opacity: 0.4;
      cursor: default;
      opacity: 0.42;
    }

    @media (max-width: 980px) {
      #page-map .map-layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .map-status-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .map-focus-pill {
        max-width: calc(100% - 340px);
      }

      .map-canvas-hud {
        grid-template-columns: 1fr;
      }
    }

    .map-hero-card.is-compact .map-focus-pill,
    .map-hero-card.is-compact .map-coord-strip,
    .map-hero-card.is-compact .map-canvas-hud {
      display: none !important;
    }

    .map-hero-card.is-compact .map-control-strip {
      gap: 4px;
      margin-bottom: 6px;
    }

    .map-hero-card.is-compact .map-toolbar {
      left: 8px;
      top: 8px;
      gap: 4px;
    }

    .map-hero-card.is-compact .map-tool-btn {
      width: 28px !important;
      height: 28px !important;
      font-size: 14px !important;
      background: linear-gradient(180deg, rgba(26,50,66,0.98), rgba(16,33,48,0.98)) !important;
      color: #ffffff !important;
    }

    .map-hero-card.is-compact .map-legend-strip {
      left: 8px;
      top: 42px;
      gap: 4px;
      max-width: 140px;
    }

    .map-hero-card.is-compact .map-legend-chip {
      padding: 4px 6px;
      font-size: 8px;
    }

    .map-hero-card.is-compact .map-status-strip {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .map-hero-card.is-compact .module-foot {
      gap: 6px;
      flex-wrap: wrap;
    }

    .map-hero-card.is-compact [data-map-foot-hint] {
      font-size: 9px;
      line-height: 1.25;
    }

    .map-hero-card.is-ultra-compact .map-legend-strip {
      display: none;
    }

    .map-hero-card.is-ultra-compact .map-status-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `;

  const mapHtml = `
    <div class='map-layout'>
      <div class='map-hero-card'>
        <div class='map-stage-head'>
          <div class='map-control-strip'>
            <button type='button' class='map-tool-btn' data-map-control='zoom-in' title='放大'>+</button>
            <button type='button' class='map-tool-btn' data-map-control='zoom-out' title='缩小'>−</button>
            <button type='button' class='map-tool-btn' data-map-control='back' title='返回上级预览'>↶</button>
            <button type='button' class='map-tool-btn' data-map-control='focus' title='Current location'>◎</button>
            <button type='button' class='map-tool-btn' data-map-control='reset' title='全图'>⌂</button>
          </div>
          <div class='map-mini-panel'>
            <div class='map-mini-world'>
              <div class='map-mini-art'></div>
              <div class='map-mini-viewport' data-map-mini-viewport></div>
              <div class='map-mini-marker current is-hidden' data-map-mini-current></div>
              <div class='map-mini-marker target is-hidden' data-map-mini-target></div>
            </div>
          </div>
        </div>
          <div class='map-canvas map-canvas-large interactive-map'>
          <div class='map-world' data-map-world>
            <div class='map-terrain' data-map-terrain></div>
            <div class='map-node-layer' data-map-node-layer></div>
            <div class='map-free-marker current is-hidden' data-map-free-current></div>
            <div class='map-free-marker target is-hidden' data-map-free-target></div>
          </div>
          <div class='map-crosshair is-hidden' data-map-crosshair>
            <div class='map-crosshair-line h'></div>
            <div class='map-crosshair-line v'></div>
            <div class='map-crosshair-dot'></div>
          </div>
          <div class='map-canvas-hud'>
            <div class='map-hud-card live'><b>位置链</b><span data-map-chain>正在读取地图数据</span></div>
          </div>
          <div class='map-hover-tooltip is-hidden' data-map-hover-tooltip>
            <b data-map-hover-coord>--,--</b>
            <span data-map-hover-terrain>地形：无</span>
          </div>
        </div>
        <div class='mvu-simple-card map-side-card map-route-card map-left-route-card map-command-card'>
          <div class='simple-head'>
            <div class='simple-title'>行动</div>
            <span class='map-side-badge gold' data-map-request-chip>停留中</span>
          </div>
          <div class='map-action-control-row'>
            <button type='button' class='map-action-primary' data-map-action-execute title='执行当前行动'>
              <b>行动</b><span data-map-selected-action data-map-request-panel-hint>待命</span>
            </button>
            <label class='map-action-select-wrap'>
              <b>选择</b>
              <select class='map-action-select' data-map-action-select aria-label='选择行动'>
                <option value=''>待命</option>
              </select>
            </label>
          </div>
          <div class='map-action-detail-row' data-map-travel-panel>
            <div class='map-action-detail-cell' data-map-training-cell>
              <b data-map-request-label='0'>目标</b>
              <span data-map-request-targetloc>无</span>
              <select class='map-action-select map-inline-training-select is-hidden' data-map-training-select aria-label='选择训练内容'>
                <option value='力量'>力量</option>
                <option value='防御'>防御</option>
                <option value='敏捷'>敏捷</option>
                <option value='体魄'>体魄</option>
                <option value='精神'>精神</option>
              </select>
            </div>
            <button type='button' class='map-action-detail-cell map-method-select is-hidden' data-map-travel-cycle title='切换移动方式'><b>方式</b><span data-map-request-method>无</span></button>
            <div class='map-action-detail-cell' data-map-duration-cell>
              <b data-map-request-label='1'>说明</b>
              <span data-map-request-coord data-map-duration-text>无</span>
            </div>
            <div class='map-action-detail-cell'><b data-map-request-label='2'>消耗</b><span data-map-request-cost>无</span></div>
          </div>
        </div>
        <div class='map-status-strip'>
          <div class='map-status-chip live'><b>焦点</b><span data-map-anchor>载入中</span></div>
          <div class='map-status-chip'><b>层级</b><span data-map-layer-label>大陆级</span></div>
          <div class='map-status-chip gold'><b>可视节点</b><span data-map-visible-nodes>0</span></div>
          <div class='map-status-chip'><b>状态</b><span data-map-request-chip>停留中</span></div>
          <div class='map-status-chip' data-map-sync-chip><b>同步</b><span data-map-sync-status>待同步</span></div>
        </div>
      </div>

      <div class='stack-3 map-side-stack'>
        <div class='mvu-simple-card map-side-card'>
          <div class='simple-head'>
            <div class='simple-title' data-map-primary-panel-title>详细信息</div>
            <span class='map-side-badge' data-map-panel-mode-badge>跟随</span>
          </div>
          <div class='map-panel-mode-strip'>
            <button type='button' class='map-layer-pill map-panel-mode-btn current' data-map-panel-mode='follow'>跟随当前位置</button>
            <button type='button' class='map-layer-pill map-panel-mode-btn' data-map-panel-mode='selection'>查看选中节点</button>
          </div>
          <div class='simple-list'>
            <div class='simple-row'><b data-map-panel-primary-label>当前位置</b><span data-map-current-name>载入中 · --,--</span></div>
            <div class='simple-row'><b>类别</b><span data-map-focus-type>无</span></div>
            <div class='simple-row'><b>功能</b><span data-map-focus-faction>无</span></div>
            <div class='simple-row'><b>可用</b><span data-map-focus-childmap>无</span></div>
          </div>
        </div>

        <div class='mvu-simple-card map-side-card'>
          <div class='simple-head'>
            <div class='simple-title' data-map-secondary-panel-title>人物</div>
            <span class='map-side-badge' data-map-secondary-panel-badge><span data-map-npc-count>0</span> 人</span>
          </div>
          <div class='map-npc-list' data-map-npc-list><div class='map-npc-empty'>点击当前节点后，在此浏览在场人物与可执行互动。</div></div>
        </div>
      </div>
    </div>
  `;

  const mapState = {
    zoom: DEFAULT_MAP_ZOOM,
    panX: 0,
    panY: 0,
    layer: 'continent',
    selectedNode: '',
    currentNode: '',
    selectedFreePoint: null,
    currentFreePoint: null,
    pendingTravelRequest: null,
    待移动后动作: null,
    cursorClientX: null,
    cursorClientY: null,
    hoverLocalX: null,
    hoverLocalY: null,
    hoverCoord: null,
    hoverCanvas: null,
    lastTravelNote: '',
    selectedAction: '',
    selectedNpc: '',
    routineTicks: 6,
    训练项目: '力量',
    lastNodeAction: null,
    snapshot: null,
    bounds: { ...DEFAULT_IMAGE_BOUNDS },
    items: [],
    itemMap: new Map(),
    coordSystem: MAP_COORD_SYSTEM_IMAGE,
    currentMapId: 'map_douluo_world',
    mapLevel: 'world',
    baseSnapshot: null,
    previewViewStack: [],
    previewKey: '',
    previewTrail: [],
    layerFollowsZoom: true,
    hasLoaded: false,
    infoPanelMode: 'follow',
    uiRefCache: new Map(),
    scopedUiRefCache: new WeakMap(),
    lastRefreshSignature: '',
    lastLayoutSignature: null,
    syncStatus: '待同步',
    syncDetail: '',
    lastSyncAt: 0,
    忽略画布点击至: 0
  };

  const mapDragState = { active: false, startX: 0, startY: 0, 起始客户端X: 0, 起始客户端Y: 0, originX: 0, originY: 0, sourceCanvas: null, moved: false, lastDragAt: 0, raf: 0, lastMiniMapSyncAt: 0 };
  const miniMapDragState = { active: false, sourceEl: null, pointerId: null, offsetX: 0, offsetY: 0 };
  const mapDerivedCache = { renderableItems: new Map(), terrainInfo: new Map(), nearestVisibleNode: new Map() };
  let pointerBound = false;
  let hoverSyncRaf = 0;
  let hoverSyncCanvas = null;
  let hoverSyncTimeout = null;
  const MAP_HOVER_INFO_DEBOUNCE_MS = 180;

  function invalidateMapDerivedCache() {
    mapDerivedCache.renderableItems.clear();
    mapDerivedCache.terrainInfo.clear();
    mapDerivedCache.nearestVisibleNode.clear();
  }

  function cancelScheduledHoverSync() {
    if (hoverSyncRaf) {
      cancelAnimationFrame(hoverSyncRaf);
      hoverSyncRaf = 0;
    }
    if (hoverSyncTimeout) {
      clearTimeout(hoverSyncTimeout);
      hoverSyncTimeout = null;
    }
  }

  function resolveSnapshotCoordSystem() {
    return MAP_COORD_SYSTEM_IMAGE;
  }

  function getImageCoordFromRatio(left, top) {
    return {
      x: Number((clamp(toNumber(left, 0), 0, 1) * Math.max(1, WORLD_IMAGE_WIDTH - 1)).toFixed(2)),
      y: Number((clamp(toNumber(top, 0), 0, 1) * Math.max(1, WORLD_IMAGE_HEIGHT - 1)).toFixed(2))
    };
  }

  function getDefaultMapCoordCenter() {
    return {
      x: Number(((WORLD_IMAGE_WIDTH - 1) / 2).toFixed(2)),
      y: Number(((WORLD_IMAGE_HEIGHT - 1) / 2).toFixed(2))
    };
  }

  function getCoordFromMapRatio(left, top) {
    const 边界 = sanitizeBounds(mapState.bounds || DEFAULT_IMAGE_BOUNDS);
    return {
      x: Number((边界.minX + clamp(toNumber(left, 0), 0, 1) * Math.max(1, 边界.width)).toFixed(2)),
      y: Number((边界.minY + clamp(toNumber(top, 0), 0, 1) * Math.max(1, 边界.height)).toFixed(2))
    };
  }

  function toText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text || fallback;
  }

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function roundCoord(value) {
    return Math.round(toNumber(value, 0));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeEntries(obj) {
    return obj && typeof obj === 'object' ? Object.entries(obj) : [];
  }

  function deepGet(obj, path, fallback = undefined) {
    if (!obj || !path) return fallback;
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let cursor = obj;
    for (const part of parts) {
      if (!cursor || typeof cursor !== 'object' || !(part in cursor)) return fallback;
      cursor = cursor[part];
    }
    return cursor === undefined ? fallback : cursor;
  }

  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getMvuHost() {
    const candidates = [];
    try { if (window.Mvu) candidates.push(window.Mvu); } catch (_) {}
    try { if (window.top && window.top !== window && window.top.Mvu) candidates.push(window.top.Mvu); } catch (_) {}
    try { if (typeof Mvu !== 'undefined' && Mvu) candidates.push(Mvu); } catch (_) {}
    return candidates.find(Boolean) || null;
  }

  async function waitForMvuReady() {
    try {
      if (typeof waitGlobalInitialized === 'function') {
        await waitGlobalInitialized('Mvu');
        return;
      }
    } catch (_) {}
    try {
      if (window.top && window.top !== window && typeof window.top.waitGlobalInitialized === 'function') {
        await window.top.waitGlobalInitialized('Mvu');
      }
    } catch (_) {}
  }

  async function getAllVariablesSafe() {
    const host = getMvuHost();
    if (host && typeof host.getAllVariables === 'function') {
      return await Promise.resolve(host.getAllVariables());
    }
    if (window.getAllVariables && typeof window.getAllVariables === 'function') {
      return await Promise.resolve(window.getAllVariables());
    }
    return null;
  }

  function getSharedMvuRefreshHub() {
    const hubKey = '__dragonUiSharedMvuRefreshHub';
    const existingHub = window[hubKey];
    if (existingHub && typeof existingHub.subscribe === 'function' && typeof existingHub.trigger === 'function') {
      return existingHub;
    }

    const subscribers = new Map();
    let bindingsReady = false;
    let running = false;
    let pending = false;
    let lastTriggerArgs = [];

    const getAllVariablesDirect = async () => {
      const host = getMvuHost();
      if (host && typeof host.getAllVariables === 'function') {
        return await Promise.resolve(host.getAllVariables());
      }
      if (window.getAllVariables && typeof window.getAllVariables === 'function') {
        return await Promise.resolve(window.getAllVariables());
      }
      return null;
    };

    const schedulePendingDispatch = () => {
      const runner = () => hub.dispatch(...lastTriggerArgs);
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(runner);
        return;
      }
      Promise.resolve().then(runner);
    };

    const hub = {
      async getAllVariables() {
        return await getAllVariablesDirect();
      },

      async dispatch(...args) {
        lastTriggerArgs = args;
        if (running) {
          pending = true;
          return;
        }
        running = true;
        try {
          const vars = await getAllVariablesDirect();
          const entries = Array.from(subscribers.entries());
          for (const [subscriberId, subscriber] of entries) {
            try {
              await Promise.resolve(subscriber.handler(vars, ...args));
            } catch (error) {
              console.warn(`[sheep_map_restore] shared refresh subscriber failed: ${subscriberId}`, error);
            }
          }
        } finally {
          running = false;
          if (pending) {
            pending = false;
            schedulePendingDispatch();
          }
        }
      },

      trigger(...args) {
        return hub.dispatch(...args);
      },

      ensureBindings() {
        if (bindingsReady) return;
        bindingsReady = true;

        const host = getMvuHost();
        const eventName = host && host.events ? host.events.VARIABLE_UPDATE_ENDED : '';
        let bound = false;
        const triggerFromEvent = (...args) => hub.trigger({ source: 'event', eventName }, ...args);

        if (host && eventName && typeof host.on === 'function') {
          try {
            host.on(eventName, triggerFromEvent);
            bound = true;
          } catch (_) {}
        }

        if (host && eventName && typeof host.addEventListener === 'function') {
          try {
            host.addEventListener(eventName, triggerFromEvent);
            bound = true;
          } catch (_) {}
        }

        if (eventName) {
          try {
            window.addEventListener(eventName, triggerFromEvent);
            bound = true;
          } catch (_) {}
          try {
            if (window.top && window.top !== window && typeof window.top.addEventListener === 'function') {
              window.top.addEventListener(eventName, triggerFromEvent);
              bound = true;
            }
          } catch (_) {}
        }

        if (!hub.刷新轮询计时器) {
          hub.刷新轮询计时器 = window.setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            hub.trigger({ source: 'poll' });
          }, 1500);
        }

        if (!hub.可见性处理函数) {
          hub.可见性处理函数 = () => {
            if (document.visibilityState === 'visible') hub.trigger({ source: 'visibility' });
          };
          document.addEventListener('visibilitychange', hub.可见性处理函数);
        }

        if (!hub.聚焦处理函数) {
          hub.聚焦处理函数 = () => hub.trigger({ source: 'focus' });
          window.addEventListener('focus', hub.聚焦处理函数);
        }

        if (!bound && window.__MVU_DEBUG__) {
          console.info('sheep_map_restore: shared polling fallback enabled.');
        }
      },

      subscribe(subscriberId, handler, options = {}) {
        if (!subscriberId || typeof handler !== 'function') return () => {};
        subscribers.set(subscriberId, { handler });
        hub.ensureBindings();
        if (options.immediate !== false) {
          hub.trigger({ source: 'subscribe', subscriberId });
        }
        return () => {
          subscribers.delete(subscriberId);
        };
      }
    };

    window[hubKey] = hub;
    return hub;
  }

  function bindMvuUpdates(handler) {
    const hub = getSharedMvuRefreshHub();
    const 取消订阅 = hub.subscribe('dragon-ui-sheep-map', async (vars, ...args) => {
      try {
        await Promise.resolve(handler(vars, ...args));
      } catch (error) {
        console.error('sheep_map_restore polling refresh failed', error);
      }
    });
    注册地图卸载(取消订阅);
    return 取消订阅;
  }

  function resolveRootData(vars) {
    if (!vars || typeof vars !== 'object') return null;
    const candidates = [vars, vars.data, vars.variables, vars.payload, vars.state, vars.mvu, vars.root];
    for (const item of candidates) {
      if (!item || typeof item !== 'object') continue;
      if (item.stat_data && typeof item.stat_data === 'object' && (item.stat_data.char || item.stat_data.world || item.stat_data.sys)) {
        return item.stat_data;
      }
      if (item.char || item.world || item.sys || item.org) {
        return item;
      }
    }
    return null;
  }

  function buildEffectiveSd(rawSd) {
    if (!rawSd || typeof rawSd !== 'object') return { rootData: null, rawData: null };
    const liveMap = (rawSd.map && typeof rawSd.map === 'object' && Object.keys(rawSd.map).length)
      ? rawSd.map
      : ((rawSd.display_map && typeof rawSd.display_map === 'object' && Object.keys(rawSd.display_map).length)
        ? rawSd.display_map
        : {});
    return {
      rootData: {
        sys: rawSd.sys || {},
        world: rawSd.world || {},
        org: rawSd.org || {},
        map: liveMap,
        char: rawSd.char || {}
      },
      rawData: rawSd
    };
  }

  function buildCharactersByLocationIndex(rootData, activeName = '') {
    const charactersByLoc = new Map();
    const digestParts = [];
    const charData = deepGet(rootData, 'char', {});
    const 动态地点表 = deepGet(rootData, 'world.动态地点', {}) || {};
    const 静态地点表 = deepGet(rootData, 'world.地点', {}) || {};
    const 读取静态节点父级 = 节点名 => {
      const 目标名 = toText(节点名, '').trim();
      if (!目标名) return null;
      const 访问 = (地点表, 父名 = '') => {
        if (!地点表 || typeof 地点表 !== 'object') return null;
        for (const [当前名, 当前节点] of Object.entries(地点表)) {
          const 显示名 = toText(当前节点 && 当前节点.name, 当前名);
          if (当前名 === 目标名 || 显示名 === 目标名) return { 名称: 当前名, 父名, 父级链: 父名 ? [父名] : [] };
          const 子节点 = getMapNodeChildren(当前节点);
          const 命中 = 子节点 ? 访问(子节点, 当前名) : null;
          if (命中) return { ...命中, 父级链: 父名 ? [父名, ...命中.父级链] : 命中.父级链 };
        }
        return null;
      };
      return 访问(静态地点表);
    };
    const 写入人物地点索引 = (地点名, 条目) => {
      const 安全地点名 = toText(地点名, '').trim();
      if (!安全地点名) return;
      if (!charactersByLoc.has(安全地点名)) charactersByLoc.set(安全地点名, []);
      const 已有条目 = charactersByLoc.get(安全地点名);
      if (已有条目.some(已有 => 已有 && 已有.id === 条目.id && 已有.所在子节点 === 条目.所在子节点)) return;
      已有条目.push(条目);
    };
    const 读取节点父级链 = (具体地点名, 动态命中名, 静态命中, 原地点片段列表) => {
      const 父级链 = [];
      const 加入父级 = 父名 => {
        const 安全父名 = toText(父名, '').trim();
        if (安全父名 && 安全父名 !== 具体地点名 && !父级链.includes(安全父名)) 父级链.push(安全父名);
      };
      const 具体地点片段列表 = toText(具体地点名, '').split('-').map(片段 => 片段.trim()).filter(Boolean);
      if (具体地点片段列表.length >= 2) {
        for (let index = 1; index < 具体地点片段列表.length; index += 1) {
          加入父级(具体地点片段列表.slice(0, index).join('-'));
        }
      }
      if (动态命中名) {
        const 动态父节点名 = toText(动态地点表[动态命中名] && 动态地点表[动态命中名].归属父节点, '');
        加入父级(动态父节点名);
        const 动态父级静态命中 = 读取静态节点父级(动态父节点名);
        (动态父级静态命中 && 动态父级静态命中.父级链 || []).forEach(加入父级);
      } else if (静态命中) {
        (静态命中.父级链 || []).forEach(加入父级);
      } else if (原地点片段列表.length >= 2) {
        for (let index = 1; index < 原地点片段列表.length; index += 1) {
          加入父级(原地点片段列表.slice(0, index).join('-'));
        }
      }
      return 父级链;
    };
    safeEntries(charData).forEach(([charId, charInfo]) => {
      const npcName = toText(charInfo && (charInfo.name || deepGet(charInfo, 'base.name', '')), charId);
      if (!npcName || npcName === activeName || charId === activeName) return;
      const charLoc = toText(charInfo && charInfo.状态 && charInfo.状态.位置, '');
      const npcFaction = toText(charInfo && (deepGet(charInfo, '社交.主身份', '') || deepGet(charInfo, '所属势力', '')), '');
      const npcState = toText(deepGet(charInfo, '状态.行动', ''), '');
      const npcMetaParts = [];
      if (npcFaction) npcMetaParts.push(npcFaction);
      if (npcState) npcMetaParts.push(`状态 ${npcState}`);
      const 地点片段列表 = 拆分地点路径(charLoc);
      const 去大陆前缀地点 = 归一地点名(charLoc);
      const 末级地点 = 地点片段列表[地点片段列表.length - 1] || '';
      const 动态候选名 = [charLoc, 去大陆前缀地点, 末级地点]
        .concat(地点片段列表.length >= 2 ? [地点片段列表.slice(-2).join('-')] : [])
        .filter(Boolean);
      const 动态命中名 = 动态候选名.find(地点名 => 动态地点表[地点名]);
      const 静态命中 = 动态命中名 ? null : (读取静态节点父级(charLoc) || 读取静态节点父级(去大陆前缀地点) || 读取静态节点父级(末级地点));
      const 具体地点名 = 动态命中名 || (静态命中 && 静态命中.名称) || 末级地点 || 去大陆前缀地点 || charLoc;
      const 父级链 = 读取节点父级链(具体地点名, 动态命中名, 静态命中, 地点片段列表);
      const 基础条目 = { id: charId, name: npcName, meta: npcMetaParts.join(' · '), location: charLoc, raw: charInfo, 所在子节点: 具体地点名 };
      写入人物地点索引(具体地点名, { ...基础条目, 可交互: true });
      父级链.forEach(父节点名 => {
        写入人物地点索引(父节点名, {
          ...基础条目,
          meta: `位于：${具体地点名}`,
          可交互: false
        });
      });
      digestParts.push([charId, npcName, charLoc, npcFaction, npcState].join(':'));
    });
    charactersByLoc.forEach(entries => entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')));
    digestParts.sort();
    return { charactersByLoc, characterDigest: digestParts.join('||') };
  }

  function 格式化人物卡信息(人物条目 = null) {
    const 原文 = toText(人物条目 && 人物条目.meta, '').trim();
    if (!原文) return '';
    const 片段列表 = 原文.split(' · ').map(片段 => 片段.trim()).filter(Boolean);
    const 精简片段列表 = [];
    片段列表.forEach(片段 => {
      if (片段列表.some(其他片段 => 其他片段 !== 片段 && 其他片段.startsWith(`${片段}/`))) return;
      if (!精简片段列表.includes(片段)) 精简片段列表.push(片段);
    });
    return 精简片段列表.join(' · ');
  }

  function 解析索引人物条目(snapshot, 地点名 = '', 原始地点名 = '') {
    if (!snapshot || !(snapshot.charactersByLoc instanceof Map)) return [];
    const 原始路径片段 = 拆分地点路径(原始地点名);
    const 显示路径片段 = 拆分地点路径(地点名);
    const 地点候选列表 = [
      toText(原始地点名, ''),
      归一地点名(原始地点名),
      原始路径片段.length >= 2 ? 原始路径片段.slice(-2).join('-') : '',
      toText(地点名, ''),
      归一地点名(地点名),
      显示路径片段.length >= 2 ? 显示路径片段.slice(-2).join('-') : ''
    ].filter(Boolean);
    const 收集结果 = [];
    const 已收录 = new Set();
    const 加入条目 = 条目列表 => {
      if (!Array.isArray(条目列表)) return;
      条目列表.forEach(条目 => {
        const 条目键 = `${toText(条目 && 条目.id, '')}::${toText(条目 && 条目.name, '')}`;
        if (!条目键.trim() || 已收录.has(条目键)) return;
        已收录.add(条目键);
        收集结果.push(条目);
      });
    };
    地点候选列表.forEach(候选地点 => 加入条目(snapshot.charactersByLoc.get(候选地点)));
    return 收集结果;
  }

  function resolveActiveCharacter(sd) {
    const chars = sd && sd.char && typeof sd.char === 'object' ? sd.char : {};
    const named = [deepGet(sd, 'sys.玩家名', ''), '主角', '玩家'].filter(Boolean);
    for (const name of named) {
      if (chars[name]) return [name, chars[name]];
    }
    return safeEntries(chars)[0] || ['未知角色', {}];
  }

  function inferMapLevelFromId(mapId) {
    if (!mapId) return 'world';
    if (mapId.includes('district')) return 'district';
    if (mapId.includes('_city') || mapId.includes('city_')) return 'city';
    if (mapId.includes('region')) return 'region';
    return mapId === 'map_douluo_world' ? 'world' : 'world';
  }

  function getMapLevelText(level) {
    if (level === 'world') return '世界图';
    if (level === 'continent') return '大陆图';
    if (level === 'region') return '区域图';
    if (level === 'city') return '城市图';
    if (level === 'district') return '街区图';
    return '地图';
  }

  function getMapDisplayName(mapId = mapState.currentMapId, mapMeta = null) {
    const safeMapId = toText(mapId, 'map_douluo_world');
    const explicitName = toText((mapMeta && mapMeta.name) || '', '');
    if (explicitName) return explicitName;
    if (safeMapId === 'map_douluo_world') return '斗罗大陆总图';
    if (/^map_/i.test(safeMapId)) return '未命名子图';
    return '未命名地图';
  }

  function isTerrainReferenceName(name = '') {
    return /(森林|生命之湖|冰火两仪眼|极北之地|山脉|山地|盆地|之地|海域|群岛|岛)/.test(name);
  }

  function inferPointKind(name, source, type, icon) {
    const safeName = toText(name, '');
    if (source === 'settlement') return 'settlement';
    if (source === 'dynamic') return 'dynamic';
    if (isTerrainReferenceName(safeName) || toText(type, '').includes('地形')) return 'terrain';
    if (SMALL_SETTLEMENT_NAMES.has(safeName) || CAPITAL_NAMES.has(safeName) || CITY_NAMES.has(safeName) || /城|都/.test(safeName) || icon === 'capital' || icon === 'city' || icon === 'town' || icon === 'port') return 'settlement';
    return 'node';
  }

  function toTextList(value) {
    if (Array.isArray(value)) return value.map(entry => toText(entry, '')).filter(Boolean);
    const text = toText(value, '');
    if (!text) return [];
    return text.split(/[、，,|/]+/).map(entry => entry.trim()).filter(Boolean);
  }

  function escapeJsonPointer(value = '') {
    return String(value || '').replace(/~/g, '~0').replace(/\//g, '~1');
  }

  function 解码地图JsonPointer路径(pointer = '') {
    const 原文 = String(pointer ?? '').trim();
    if (!原文 || 原文 === '/') return [];
    return 原文.split('/').slice(1).map(片段 => 片段.replace(/~1/g, '/').replace(/~0/g, '~'));
  }

  function 写入地图对象路径值(目标 = {}, 路径 = [], 值 = undefined) {
    if (!目标 || typeof 目标 !== 'object' || !Array.isArray(路径) || !路径.length) return false;
    let 当前 = 目标;
    for (let 序号 = 0; 序号 < 路径.length; 序号 += 1) {
      const 片段 = 路径[序号];
      const 末段 = 序号 === 路径.length - 1;
      if (末段) {
        当前[片段] = cloneJsonValue(值, 值);
        return true;
      }
      const 下一片段 = 路径[序号 + 1];
      if (!当前[片段] || typeof 当前[片段] !== 'object') 当前[片段] = /^\d+$/.test(String(下一片段)) ? [] : {};
      当前 = 当前[片段];
    }
    return false;
  }

  function getMapNodeChildren(rawNode) {
    if (!rawNode || typeof rawNode !== 'object') return null;
    const children = rawNode.children || rawNode['子节点'] || rawNode.child_nodes || rawNode.childNodes || null;
    return children && typeof children === 'object' ? children : null;
  }

  function 收集内联子图载荷索引(visibleNodes = {}, visibleDynamics = {}, rootData = {}) {
    const availableChildMaps = {};
    const previewChildMaps = {};
    const dynamicSource = deepGet(rootData, 'world.动态地点', {});
    [...Object.entries(visibleNodes || {}), ...Object.entries(visibleDynamics || {})].forEach(([name, rawNode]) => {
      const 子节点 = getMapNodeChildren(rawNode);
      const 有静态子节点 = !!(子节点 && Object.keys(子节点).length);
      const 有动态子节点 = getDynamicEntriesByParent(dynamicSource, name)
        .some(([dynName]) => toText(dynName, '') !== toText(name, ''));
      if (!有静态子节点 && !有动态子节点) return;
      availableChildMaps[name] = `preview_${name}`;
    });
    return { availableChildMaps, previewChildMaps };
  }

  function getMapNodeTextField(rawNode, keys = [], fallback = '') {
    if (!rawNode || typeof rawNode !== 'object') return fallback;
    for (const key of keys) {
      if (rawNode[key] !== undefined && rawNode[key] !== null && rawNode[key] !== '') {
        return toText(rawNode[key], fallback);
      }
    }
    return fallback;
  }

  function getMapNodeNumberField(rawNode, keys = [], fallback = NaN) {
    if (!rawNode || typeof rawNode !== 'object') return fallback;
    for (const key of keys) {
      if (rawNode[key] !== undefined && rawNode[key] !== null && rawNode[key] !== '') {
        return toNumber(rawNode[key], fallback);
      }
    }
    return fallback;
  }

  function getMapNodeListField(rawNode, keys = []) {
    if (!rawNode || typeof rawNode !== 'object') return [];
    for (const key of keys) {
      const value = rawNode[key];
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) return value.map(entry => toText(entry, '')).filter(Boolean);
      return toTextList(value);
    }
    return [];
  }

  function toSafeNodeToken(value = 'node') {
    return toText(value, 'node')
      .replace(/[^\w\u4e00-\u9fa5]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'node';
  }

  const NODE_KIND_LABELS = {
    city_hub: '城市枢纽',
    academy_hub: '学院枢纽',
    branch_hub: '分部枢纽',
    garrison_hub: '驻地枢纽',
    hub: '枢纽节点',
    commerce: '商贸节点',
    study: '学术节点',
    craft: '工坊节点',
    training: '训练节点',
    rest: '生活节点',
    intel: '情报节点',
    administration: '政务节点',
    landmark: '地标节点'
  };

  const NODE_INTERACTION_LABELS = {
    inspect: '查看',
    enter: '进入',
    study: '研读',
    meditate: '冥想',
    train: '训练',
    train_body: '肉体训练',
    train_mind: '精神训练',
    battle: '战斗',
    talk: '对话',
    trade: '交易',
    bid: '竞拍',
    craft: '委托工坊',
    rest: '休整',
    sleep: '睡眠',
    intel: '情报',
    brief: '汇报',
    search: '搜索',
    patrol: '巡逻'
  };

  const NODE_SERVICE_LABELS = {
    preview: '预览',
    study: '学习',
    train: '训练',
    battle: '战斗',
    shop: '商店',
    auction: '竞拍',
    black_market: '黑市',
    craft: '工坊委托',
    rest: '休息',
    intel: '情报',
    briefing: '政务'
  };

  const 地图维护地点模板 = {
    place: { 标签: '普通地点', 类型: '动态地点', 节点类型: '地点' },
    city: { 标签: '城市', 类型: '城市', 节点类型: '城市', 默认商店: true },
    shop: { 标签: '商店', 类型: '商店', 节点类型: '商店', 默认商店: true },
    craft: { 标签: '工坊', 类型: '工坊', 节点类型: '工坊' },
    guild: { 标签: '协会', 类型: '协会', 节点类型: '协会', 默认商店: true },
    training: { 标签: '训练点', 类型: '训练设施', 节点类型: '训练' },
    rest: { 标签: '休息点', 类型: '休息设施', 节点类型: '休息' },
  };

  function getNodeKindLabel(kind = '') {
    return NODE_KIND_LABELS[toText(kind, '')] || toText(kind, '未分类');
  }

  function getNodeInteractionLabel(action = '') {
    return NODE_INTERACTION_LABELS[toText(action, '')] || toText(action, '查看');
  }

  function getNodeServiceLabel(service = '') {
    return NODE_SERVICE_LABELS[toText(service, '')] || toText(service, '服务');
  }

  function getCultivationTalentRate(tier = '') {
    return {
      绝世妖孽: 4.5,
      顶级天才: 3.5,
      天才: 2.5,
      优秀: 1.5,
      正常: 1.0,
      劣等: 0.5,
    }[toText(tier, '正常')] || 1.0;
  }

  function roundRoutineGrowthValue(value) {
    return Number(Number(value || 0).toFixed(4));
  }

  function getMeditationYouthYieldMultiplier(角色 = {}) {
    const 年龄 = Math.max(0, toNumber(deepGet(角色, '属性.年龄', 0), 0));
    const 天赋 = toText(deepGet(角色, '属性.天赋梯队', '正常'), '正常');
    const 有效天赋 = 年龄 < 15 && ['天才', '顶级天才', '绝世妖孽'].includes(天赋)
      ? '天才'
      : (年龄 < 18 && ['顶级天才', '绝世妖孽'].includes(天赋) ? '顶级天才' : 天赋);
    if (年龄 < 12) return ({ 劣等: 0.05, 正常: 0.10, 优秀: 0.20, 天才: 0.36, 顶级天才: 0.36, 绝世妖孽: 0.36 }[有效天赋] || 0.10);
    if (年龄 < 18) return ({ 劣等: 0.10, 正常: 0.18, 优秀: 0.42, 天才: 0.62, 顶级天才: 0.82, 绝世妖孽: 0.82 }[有效天赋] || 0.25);
    if (年龄 < 22) return ({ 劣等: 0.16, 正常: 0.26, 优秀: 0.72, 天才: 1.00, 顶级天才: 1.05, 绝世妖孽: 1.10 }[有效天赋] || 0.40);
    if (年龄 < 30) return ({ 劣等: 0.20, 正常: 0.32, 优秀: 0.90, 天才: 1.10, 顶级天才: 1.85, 绝世妖孽: 5.20 }[有效天赋] || 0.45);
    return 1;
  }

  function getMeditationSoulPowerGrowthPreview(角色 = {}, 持续tick = 6) {
    const stat = deepGet(角色, '属性', {}) || {};
    if (['无魂力', '普通人'].includes(toText(stat.天赋梯队, ''))) return 0;
    const coreCount = Math.max(0, Math.floor(toNumber(deepGet(角色, '魂核.核心.数量', 0), 0)));
    const stageBaseRate = coreCount <= 0 ? 0.25 : coreCount === 1 ? 0.46 : coreCount === 2 ? 0.46 : 0.96;
    const multiplier = Math.max(1, toNumber(deepGet(stat, '训练加成.修炼倍率', 1), 1));
    let growth = stageBaseRate * (Math.max(1, toNumber(持续tick, 6)) / 6) * getCultivationTalentRate(stat.天赋梯队) * getMeditationYouthYieldMultiplier(角色) * multiplier;
    if (deepGet(角色, '功法.玄天功')) growth *= 1.1;
    if (toNumber(stat.等级, 0) >= 20 && toNumber(stat.等级, 0) < 30) growth *= 1.024;
    else if (toNumber(stat.等级, 0) >= 30 && toNumber(stat.等级, 0) < 40) growth *= 1.014;
    else if (toNumber(stat.等级, 0) >= 40 && toNumber(stat.等级, 0) < 60) growth *= 0.865;
    return growth > 0 && growth < 0.01 ? 0.01 : roundRoutineGrowthValue(growth);
  }

  function formatRoutineDeltaValue(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return '0';
    if (Math.abs(num - Math.round(num)) < 0.0001) return String(Math.round(num));
    return num.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  function 获取地图日常动作tick() {
    const 数值 = Math.floor(toNumber(mapState.routineTicks, 6));
    return Math.max(1, Math.min(144, Number.isFinite(数值) ? 数值 : 6));
  }

  function 格式化地图日常时长(ticks = 6) {
    const 安全tick = Math.max(1, Math.floor(toNumber(ticks, 6)));
    const 分钟 = 安全tick * 10;
    if (分钟 < 60) return `${分钟} 分钟`;
    const 小时 = 分钟 / 60;
    return Number.isInteger(小时) ? `${小时} 小时` : `${小时.toFixed(1).replace(/\.0$/, '')} 小时`;
  }

  function 是否地图可变时长动作(action = '') {
    return ['meditate', 'train', 'train_body', 'train_mind', 'rest', 'sleep'].includes(toText(action, ''));
  }

  function 获取地图训练项目() {
    const 项目 = toText(mapState.训练项目, '力量');
    return ['力量', '防御', '敏捷', '体魄', '精神'].includes(项目) ? 项目 : '力量';
  }

  function 获取地图训练执行动作() {
    return 获取地图训练项目() === '精神' ? 'train_mind' : 'train_body';
  }

  function 获取地图训练项目标题() {
    return `${获取地图训练项目()}训练`;
  }

  function 构建拟态来源提示(snapshot, 节点项 = null) {
    const 角色数据 = deepGet(snapshot, 'activeChar', {}) || {};
    const 地点文本 = [
      toText(deepGet(snapshot, 'currentLoc', ''), ''),
      toText(节点项 && 节点项.name, ''),
      toText(节点项 && 节点项.type, ''),
      toText(节点项 && 节点项.nodeKind, ''),
    ].join(' ');
    const 武魂文本 = (() => {
      try {
        return JSON.stringify(deepGet(角色数据, '武魂', {}));
      } catch (error) {
        return '';
      }
    })();
    const 命中来源 = [];
    if (/(冰|雪|寒|霜)/.test(武魂文本) && /(冰|雪|寒|霜|冰川|冰山)/.test(地点文本)) 命中来源.push('冰系拟态');
    if (/(火|炎|焰|熔)/.test(武魂文本) && /(火山|熔岩|炎|热)/.test(地点文本)) 命中来源.push('火系拟态');
    if (/(水|海|潮|雨|雾)/.test(武魂文本) && /(海|湖|河|潮|湿地|水域)/.test(地点文本)) 命中来源.push('水系拟态');
    if (/(木|林|草|藤|花)/.test(武魂文本) && /(森林|林海|草原|藤|花海|雨林)/.test(地点文本)) 命中来源.push('木系拟态');
    if (/(土|岩|山|石)/.test(武魂文本) && /(山|岩|矿|洞窟)/.test(地点文本)) 命中来源.push('土系拟态');
    if (/(雷|电|霆)/.test(武魂文本) && /(雷|电|风暴|雷暴)/.test(地点文本)) 命中来源.push('雷系拟态');
    return 命中来源.length ? `拟态来源：${命中来源.join(' + ')}` : '拟态来源：无明显匹配';
  }

  function buildRoutineActionPreview(snapshot, action = '', 节点项 = null, durationTicks = 6) {
    const safeAction = toText(action, '');
    const 持续tick = Math.max(1, Math.floor(toNumber(durationTicks, 6)));
    const 时长文本 = 格式化地图日常时长(持续tick);
    const activeChar = deepGet(snapshot, 'activeChar', {}) || {};
    const stat = deepGet(activeChar, '属性', {}) || {};
    const 拟态来源提示 = 构建拟态来源提示(snapshot, 节点项);
    const 训练项目标题 = 获取地图训练项目标题();
    const multiplier = Math.max(0, toNumber(deepGet(stat, '训练加成.修炼倍率', 1), 1));
    const currentMen = Math.max(0, toNumber(stat.精神力, 0));
    const menMax = Math.max(0, toNumber(stat.精神力上限, 0));
    const currentVit = Math.max(0, toNumber(stat.体力, 0));
    const vitMax = Math.max(0, toNumber(stat.体力上限, 0));
    const currentSp = Math.max(0, toNumber(stat.魂力, 0));
    const spMax = Math.max(0, toNumber(stat.魂力上限, 0));
    const age = Math.max(0, toNumber(stat.年龄, 0));
    const coreCount = Math.max(0, toNumber(deepGet(activeChar, '魂核.核心.数量', 0), 0));
    const hasPurpleDemonEye = !!deepGet(activeChar, '功法.紫极魔瞳');

    if (safeAction === 'meditate') {
      const spRate = coreCount === 0 ? 0.05 : coreCount === 1 ? 0.2 : coreCount === 2 ? 0.3 : 0.4;
      const menGain = Math.max(0, Math.min(menMax, Math.floor(currentMen + menMax * 0.008 * 持续tick)) - currentMen);
      const vitGain = Math.max(0, Math.min(vitMax, Math.floor(currentVit + vitMax * 0.005 * 持续tick)) - currentVit);
      const spGain = Math.max(0, Math.min(spMax, Math.floor(currentSp + spMax * spRate * 持续tick)) - currentSp);
      const spMaxGain = getMeditationSoulPowerGrowthPreview(activeChar, 持续tick);
      return {
        slotReason: `精神+${formatRoutineDeltaValue(menGain)} / 体力+${formatRoutineDeltaValue(vitGain)} / 魂力+${formatRoutineDeltaValue(spGain)} / 魂力上限+${formatRoutineDeltaValue(spMaxGain)}`,
        detailText: `精神+${formatRoutineDeltaValue(menGain)} / 体力+${formatRoutineDeltaValue(vitGain)} / 魂力+${formatRoutineDeltaValue(spGain)} / 魂力上限+${formatRoutineDeltaValue(spMaxGain)}`,
        logText: `角色进行了约 ${时长文本}的冥想，本次预计恢复精神 ${formatRoutineDeltaValue(menGain)}、体力 ${formatRoutineDeltaValue(vitGain)}、魂力 ${formatRoutineDeltaValue(spGain)}，并让魂力上限成长 ${formatRoutineDeltaValue(spMaxGain)}。`,
        mimicHint: 拟态来源提示,
      };
    }

    if (safeAction === 'train_body') {
      const requiredVit = vitMax * 0.3;
      const canTrain = currentVit >= requiredVit;
      const gain = 0.05 * Math.floor(持续tick / 6) * multiplier;
      return {
        slotReason: canTrain
          ? `${训练项目标题}+${formatRoutineDeltaValue(gain)}`
          : `体力需达到 ${formatRoutineDeltaValue(requiredVit)}`,
        detailText: canTrain
          ? `${训练项目标题}+${formatRoutineDeltaValue(gain)}`
          : `体力不足：${formatRoutineDeltaValue(currentVit)} / ${formatRoutineDeltaValue(requiredVit)}`,
        logText: canTrain
          ? `角色进行了约 ${时长文本}的${训练项目标题}，消耗体力，并使${训练项目标题}加成提升 ${formatRoutineDeltaValue(gain)}。`
          : `角色尝试进行${训练项目标题}，但当前体力只有 ${formatRoutineDeltaValue(currentVit)}，不足以完成训练。`,
        mimicHint: 拟态来源提示,
      };
    }

    if (safeAction === 'train_mind') {
      const requiredMen = menMax * 0.1;
      const canTrain = currentMen > requiredMen;
      let gain = age <= 40 ? 0.02 * Math.floor(持续tick / 6) * multiplier : 0;
      if (hasPurpleDemonEye) gain = Math.floor(gain * 1.1);
      return {
        slotReason: canTrain
          ? `精神训练+${formatRoutineDeltaValue(gain)}`
          : `精神需高于 ${formatRoutineDeltaValue(requiredMen)}`,
        detailText: canTrain
          ? `精神训练+${formatRoutineDeltaValue(gain)}`
          : `精神不足：${formatRoutineDeltaValue(currentMen)} / ${formatRoutineDeltaValue(requiredMen)}`,
        logText: canTrain
          ? `角色进行了约 ${时长文本}的精神训练，消耗了大量精神力，并使精神上限训练加成提升 ${formatRoutineDeltaValue(gain)}。`
          : `角色尝试进行精神训练，但当前精神只有 ${formatRoutineDeltaValue(currentMen)}，不足以支撑完整训练。`,
        mimicHint: 拟态来源提示,
      };
    }

    if (safeAction === 'rest') {
      const spGain = Math.max(0, Math.min(spMax, Math.floor(currentSp + spMax * 0.01 * 持续tick)) - currentSp);
      return {
        slotReason: `魂力+${formatRoutineDeltaValue(spGain)}`,
        detailText: `魂力+${formatRoutineDeltaValue(spGain)}`,
        logText: `角色进行了约 ${时长文本}的休整，本次主要恢复魂力 ${formatRoutineDeltaValue(spGain)}。`,
        mimicHint: 拟态来源提示,
      };
    }

    if (safeAction === 'sleep') {
      const menGain = Math.max(0, Math.min(menMax, Math.floor(currentMen + menMax * 0.01 * 持续tick)) - currentMen);
      const vitGain = Math.max(0, Math.min(vitMax, Math.floor(currentVit + vitMax * 0.01 * 持续tick)) - currentVit);
      const spGain = Math.max(0, Math.min(spMax, Math.floor(currentSp + spMax * 0.01 * 持续tick)) - currentSp);
      return {
        slotReason: `精神+${formatRoutineDeltaValue(menGain)} / 体力+${formatRoutineDeltaValue(vitGain)} / 魂力+${formatRoutineDeltaValue(spGain)}`,
        detailText: `精神+${formatRoutineDeltaValue(menGain)} / 体力+${formatRoutineDeltaValue(vitGain)} / 魂力+${formatRoutineDeltaValue(spGain)}`,
        logText: `角色睡眠休整约 ${时长文本}，预计恢复精神 ${formatRoutineDeltaValue(menGain)}、体力 ${formatRoutineDeltaValue(vitGain)}、魂力 ${formatRoutineDeltaValue(spGain)}。`,
        mimicHint: 拟态来源提示,
      };
    }

    if (safeAction === 'study') {
      return {
        slotReason: '研读',
        detailText: '研读',
        logText: '角色进行了约 1 小时的研读与学习，主要推进阅读与知识积累类内容。',
        mimicHint: 拟态来源提示,
      };
    }

    return {
      slotReason: 时长文本,
      detailText: 时长文本,
      logText: `角色在当前节点完成了【${getNodeInteractionLabel(safeAction)}】动作。`,
      mimicHint: 拟态来源提示,
    };
  }

  function formatBehaviorLabels(values, formatter, fallback = '无') {
    const items = Array.isArray(values) ? values.map(entry => formatter(entry)).filter(Boolean) : [];
    return items.length ? items.join(' / ') : fallback;
  }

  function inferNodeKind(name, type, canEnter) {
    const text = `${toText(name, '')} ${toText(type, '')}`;
    if (canEnter) {
      if (/学院/.test(text)) return 'academy_hub';
      if (/分部|唐门/.test(text)) return 'branch_hub';
      if (/驻地|防军|军/.test(text)) return 'garrison_hub';
      if (/城|主城|都市/.test(text)) return 'city_hub';
      return 'hub';
    }
    if (/拍卖|黑市|商店|杂货|交易/.test(text)) return 'commerce';
    if (/图书馆|教学|藏书|静室|修炼室/.test(text)) return 'study';
    if (/锻造师协会|制造师协会|设计师协会|修理师协会|副职业|实验|研究|工坊|暗器|锻造|制造|修理|设计/.test(text)) return 'craft';
    if (/修炼|训练|训练场|演武|斗魂|实训|健身|锻炼/.test(text)) return 'training';
    if (/宿舍|寝室|营房|休息|生活|大本营|营地/.test(text)) return 'rest';
    if (/指挥|情报|巡防/.test(text)) return 'intel';
    if (/议政|政务/.test(text)) return 'administration';
    return 'landmark';
  }

  function inferNodeInteractions(nodeKind, name, type, canEnter) {
    const text = `${toText(name, '')} ${toText(type, '')}`;
    if (canEnter) return ['enter', 'inspect'];
    if (nodeKind === 'commerce') return /拍卖/.test(text) ? ['inspect', 'bid'] : ['inspect', 'trade'];
    if (nodeKind === 'study') return ['inspect', 'meditate'];
    if (nodeKind === 'craft') return ['inspect', 'talk', 'meditate'];
    if (nodeKind === 'training') return ['inspect', 'train', 'meditate'];
    if (nodeKind === 'rest') return ['inspect', 'rest', 'meditate'];
    if (nodeKind === 'intel') return ['inspect', 'meditate'];
    if (nodeKind === 'administration') return ['inspect', 'meditate'];
    return ['inspect', 'meditate'];
  }

  function inferNodeActionSlots(nodeKind, name, type, canEnter, interactions = [], services = []) {
    const text = `${toText(name, '')} ${toText(type, '')}`;
    if (canEnter) return ['enter', 'inspect'];
    if (nodeKind === 'commerce') return /拍卖/.test(text) ? ['bid', 'trade'] : ['trade'];
    if (nodeKind === 'study') return ['meditate'];
    if (nodeKind === 'craft') return ['craft', 'meditate'];
    if (nodeKind === 'training') return (services.includes('battle') || /演武|斗魂|擂台|实战/.test(text)) ? ['train', 'battle', 'meditate'] : ['train', 'meditate'];
    if (nodeKind === 'rest') return ['rest', 'meditate'];
    if (nodeKind === 'intel') return ['meditate'];
    if (nodeKind === 'administration') return ['meditate'];
    if (interactions.length) return interactions.filter(action => ['trade', 'bid', 'craft', 'battle', 'meditate', 'rest', 'sleep', 'train', 'train_body', 'train_mind'].includes(toText(action, ''))).slice(0, 4);
    return ['meditate'];
  }

  function inferNodeServices(nodeKind, name, type, canEnter) {
    const text = `${toText(name, '')} ${toText(type, '')}`;
    if (canEnter) return ['preview'];
    if (nodeKind === 'commerce') return /黑市/.test(text) ? ['black_market'] : (/拍卖/.test(text) ? ['auction'] : ['shop']);
    if (nodeKind === 'study') return [];
    if (nodeKind === 'craft') return ['craft'];
    if (nodeKind === 'training') return ['train'];
    if (nodeKind === 'rest') return ['rest'];
    if (nodeKind === 'intel') return [];
    if (nodeKind === 'administration') return [];
    return [];
  }

  function deriveNodeBehaviorMeta(name, rawItem = {}, options = {}) {
    const type = toText(options.type !== undefined ? options.type : rawItem.type, '');
    const canEnter = !!options.canEnter;
    const explicitKind = toText(options.nodeKind !== undefined ? options.nodeKind : (rawItem.node_kind || rawItem.nodeKind), '');
    const nodeKind = explicitKind || inferNodeKind(name, type, canEnter);
    const interactions = toTextList(options.interactions !== undefined ? options.interactions : rawItem.interactions);
    const services = toTextList(options.services !== undefined ? options.services : rawItem.services);
    const actionSlots = toTextList(options.actionSlots !== undefined ? options.actionSlots : (rawItem.action_slots || rawItem.actionSlots));
    const eventId = toText(options.eventId !== undefined ? options.eventId : (rawItem.event_id || rawItem.eventId), '');
    const resolvedInteractions = interactions.length ? interactions : inferNodeInteractions(nodeKind, name, type, canEnter);
    const resolvedServices = services.length ? services : inferNodeServices(nodeKind, name, type, canEnter);
    return {
      nodeKind,
      interactions: resolvedInteractions,
      services: resolvedServices,
      actionSlots: actionSlots.length ? actionSlots : inferNodeActionSlots(nodeKind, name, type, canEnter, resolvedInteractions, resolvedServices),
      eventId: eventId || (canEnter ? '' : `debug.${nodeKind}.${toSafeNodeToken(name)}`)
    };
  }

  function getPrimaryNodeInteraction(item) {
    if (!item) return 'inspect';
    const list = Array.isArray(item.actionSlots) && item.actionSlots.length
      ? item.actionSlots.filter(Boolean)
      : (Array.isArray(item.interactions) ? item.interactions.filter(Boolean) : []);
    return list[0] || (item.canEnter ? 'enter' : 'inspect');
  }

  function 获取当前小时(snapshot = mapState.baseSnapshot || mapState.snapshot) {
    const 当前tick = Math.max(0, toNumber(deepGet(snapshot, 'rootData.world.时间.tick', 0), 0));
    const 当日分钟 = ((当前tick * 10) % (24 * 60) + (24 * 60)) % (24 * 60);
    return Math.floor(当日分钟 / 60);
  }

  function 获取当前时分(snapshot = mapState.baseSnapshot || mapState.snapshot) {
    const 当前tick = Math.max(0, toNumber(deepGet(snapshot, 'rootData.world.时间.tick', 0), 0));
    const 当日分钟 = ((当前tick * 10) % (24 * 60) + (24 * 60)) % (24 * 60);
    return {
      小时: Math.floor(当日分钟 / 60),
      分钟: Math.floor(当日分钟 % 60)
    };
  }

  function 判断商店营业中(snapshot = mapState.baseSnapshot || mapState.snapshot) {
    const 当前小时 = 获取当前小时(snapshot);
    return 当前小时 >= 9 && 当前小时 < 22;
  }

  function 格式化营业状态(snapshot = mapState.baseSnapshot || mapState.snapshot) {
    const 当前时间 = 获取当前时分(snapshot);
    const 时间文本 = `${String(当前时间.小时).padStart(2, '0')}:${String(当前时间.分钟).padStart(2, '0')}`;
    return 判断商店营业中(snapshot) ? `营业中 ${时间文本}` : `已关门 ${时间文本}`;
  }

  function 归一地点名(地点 = '') {
    return toText(地点, '').replace(/^斗罗大陆-/, '').replace(/^斗灵大陆-/, '').trim();
  }

  function 拆分地点路径(地点 = '') {
    return 归一地点名(地点).split('-').map(片段 => 片段.trim()).filter(Boolean);
  }

  function 获取地点节点及父级(节点名 = '', snapshot = mapState.baseSnapshot || mapState.snapshot) {
    const 目标名 = toText(节点名, '').trim();
    const 根地点 = deepGet(snapshot, 'rootData.world.地点', {}) || {};
    const 访问 = (地点表, 父名 = '', 父节点 = null, 路径 = [], 指针路径 = ['world', '地点']) => {
      if (!地点表 || typeof 地点表 !== 'object') return null;
      for (const [当前名, 当前节点] of Object.entries(地点表)) {
        const 显示名 = toText(当前节点 && 当前节点.name, 当前名);
        const 当前路径 = [...路径, 当前名];
        const 当前指针路径 = [...指针路径, 当前名];
        if (当前名 === 目标名 || 显示名 === 目标名) {
          return { 名称: 当前名, 节点: 当前节点 || {}, 父名, 父节点, 路径: 当前路径, 指针路径: 当前指针路径 };
        }
        const 子节点 = getMapNodeChildren(当前节点);
        const 子字段 = 当前节点 && 当前节点.children ? 'children'
          : 当前节点 && 当前节点['子节点'] ? '子节点'
            : 当前节点 && 当前节点.child_nodes ? 'child_nodes'
              : 当前节点 && 当前节点.childNodes ? 'childNodes'
                : 'children';
        const 子结果 = 子节点 ? 访问(子节点, 当前名, 当前节点 || null, 当前路径, [...当前指针路径, 子字段]) : null;
        if (子结果) return 子结果;
      }
      return null;
    };
    return 访问(根地点);
  }

  function 收集地图节点商店商品样本(地点数据 = {}) {
    const 样本 = [];
    safeEntries(deepGet(地点数据, '商店', {})).forEach(([商店名, 商店数据]) => {
      safeEntries(deepGet(商店数据, '库存', {})).forEach(([商品名, 商品数据]) => {
        if (!商品数据 || typeof 商品数据 !== 'object') return;
        样本.push({
          商店名: toText(商店名, '未知商店'),
          商品名: toText(商品名, '未知商品'),
          库存: Math.max(0, toNumber(商品数据['库存'], 0)),
          价格: Math.max(0, toNumber(商品数据['价格'], 0))
        });
      });
    });
    return 样本;
  }

  function 计算地图节点供给文本(地点数据 = {}) {
    const 商品样本 = 收集地图节点商店商品样本(地点数据);
    if (!商品样本.length) return '充裕';
    const 总库存 = 商品样本.reduce((总和, 项) => 总和 + Math.max(0, toNumber(项 && 项['库存'], 0)), 0);
    const 缺货数 = 商品样本.filter(项 => Math.max(0, toNumber(项 && 项['库存'], 0)) <= 0).length;
    const 均值库存 = 总库存 / Math.max(1, 商品样本.length);
    const 缺货占比 = 缺货数 / Math.max(1, 商品样本.length);
    if (总库存 <= 0 || 缺货占比 >= 0.55 || 均值库存 < 1.5) return '紧缺';
    if (缺货占比 >= 0.3 || 均值库存 < 3.5) return '偏紧';
    if (均值库存 >= 9) return '充裕';
    return '平衡';
  }

  function 计算地图节点价格文本(地点数据 = {}) {
    const 价格样本 = 收集地图节点商店商品样本(地点数据)
      .map(项 => Math.max(0, toNumber(项 && 项['价格'], 0)))
      .filter(价格 => 价格 > 0);
    if (!价格样本.length) return '无';
    const 均价 = 价格样本.reduce((总和, 价格) => 总和 + 价格, 0) / Math.max(1, 价格样本.length);
    if (均价 < 100000) return '低价';
    if (均价 < 2000000) return '中价';
    if (均价 < 50000000) return '高价';
    return '超高价';
  }

  function 读取地图节点成交文本(snapshot = mapState.baseSnapshot || mapState.snapshot) {
    const rootData = snapshot && snapshot.rootData ? snapshot.rootData : {};
    const 播报文本 = toText(deepGet(rootData, 'sys.系统播报', ''), '');
    const 标签匹配 = Array.from(播报文本.matchAll(/\[(买入热|卖出热|竞拍热|兑换热|市场波动)\]/g))
      .map(match => toText(match && match[1], '').trim())
      .filter(Boolean);
    return 标签匹配.length ? 标签匹配[标签匹配.length - 1] : '平稳';
  }

  function 构建星图焦点运营信息(snapshot, focusItem, 焦点名称 = '') {
    const 焦点名 = toText(焦点名称, focusItem ? focusItem.name : '');
    const 命中 = 焦点名 ? 获取地点节点及父级(焦点名, snapshot) : null;
    const 地点数据 = 命中 && 命中.节点 && typeof 命中.节点 === 'object' ? 命中.节点 : {};
    const 父地点数据 = 命中 && 命中.父节点 && typeof 命中.父节点 === 'object' ? 命中.父节点 : {};
    const 取节点字段 = (字段名, 回退值 = '') => toText(地点数据[字段名], toText(父地点数据[字段名], 回退值));
    const 商店地点数据 = 地点数据.商店 && typeof 地点数据.商店 === 'object' && Object.keys(地点数据.商店).length ? 地点数据 : 父地点数据;
    return {
      掌控: 取节点字段('掌控势力', focusItem ? toText(focusItem.faction, '未知') : '未知'),
      防务: 取节点字段('守护军团', '无'),
      经济: 取节点字段('经济状况', '未知'),
      供给: 计算地图节点供给文本(商店地点数据),
      价格: 计算地图节点价格文本(商店地点数据),
      成交: 读取地图节点成交文本(snapshot)
    };
  }

  function 构建地图维护指针路径(片段列表 = []) {
    return `/${片段列表.map(片段 => escapeJsonPointer(片段)).join('/')}`;
  }

  function 判断地图维护动态地点(节点名 = '') {
    const 地点名 = toText(节点名, '').trim();
    if (!地点名) return false;
    return !!deepGet(mapState.baseSnapshot || mapState.snapshot, ['rootData', 'world', '动态地点', 地点名], null);
  }

  function 读取动态地点占用角色列表(地点名 = '') {
    const 目标地点 = toText(地点名, '').trim();
    if (!目标地点) return [];
    return Object.entries(deepGet(mapState.baseSnapshot || mapState.snapshot, 'rootData.char', {}) || {})
      .filter(([, 角色]) => 角色 && typeof 角色 === 'object' && toText(deepGet(角色, '状态.位置', ''), '').trim() === 目标地点)
      .map(([角色名, 角色]) => toText(角色.name || deepGet(角色, 'base.name', ''), 角色名));
  }

  function 获取地图维护父节点名() {
    const 预览锚点 = toText(mapState.snapshot && mapState.snapshot.previewMeta && mapState.snapshot.previewMeta.anchor_name, '');
    if (预览锚点) return 预览锚点;
    if (toText(mapState.currentMapId, 'map_douluo_world') === 'map_douluo_world') return '斗罗大陆';
    if (mapState.selectedFreePoint) return toText(mapState.currentNode || mapState.snapshot?.currentLoc, '斗罗大陆');
    return toText(mapState.selectedNode || mapState.currentNode || mapState.snapshot?.currentLoc, '斗罗大陆');
  }

  function 获取地图维护焦点项() {
    if (mapState.selectedFreePoint) {
      const 最近节点名 = getNearestVisibleMapNode(mapState.selectedFreePoint, mapState.layer, { maxRatioDistance: MAP_NODE_SNAP_RATIO_THRESHOLD, useRenderedRatio: true });
      if (最近节点名 && mapState.itemMap && typeof mapState.itemMap.get === 'function') return mapState.itemMap.get(最近节点名) || null;
      return null;
    }
    const 焦点名 = toText(mapState.selectedNode || mapState.currentNode, '');
    if (焦点名 && mapState.itemMap && typeof mapState.itemMap.get === 'function') return mapState.itemMap.get(焦点名) || null;
    return null;
  }

  function 获取地图维护坐标() {
    const 自由坐标 = mapState.selectedFreePoint || mapState.currentFreePoint || mapState.hoverCoord || null;
    if (自由坐标 && Number.isFinite(toNumber(自由坐标.x, NaN)) && Number.isFinite(toNumber(自由坐标.y, NaN))) {
      return { x: roundCoord(toNumber(自由坐标.x, 0)), y: roundCoord(toNumber(自由坐标.y, 0)) };
    }
    const 焦点项 = 获取地图维护焦点项();
    if (焦点项 && Number.isFinite(toNumber(焦点项.x, NaN)) && Number.isFinite(toNumber(焦点项.y, NaN))) {
      return { x: roundCoord(toNumber(焦点项.x, 0) + 18), y: roundCoord(toNumber(焦点项.y, 0) + 18) };
    }
    const 焦点坐标 = mapState.currentFreePoint || mapState.snapshot?.currentFocusCoord || {};
    return {
      x: Number.isFinite(toNumber(焦点坐标.x, NaN)) ? roundCoord(toNumber(焦点坐标.x, 0) + 18) : 120,
      y: Number.isFinite(toNumber(焦点坐标.y, NaN)) ? roundCoord(toNumber(焦点坐标.y, 0) + 18) : 120
    };
  }

  function 地图节点已损毁(节点项 = null) {
    const 状态 = toText(节点项 && (节点项.state || 节点项['状态']), '').trim().toLowerCase();
    return ['ruins', 'destroyed', 'damaged', '废弃', '损毁', '破坏', '遗址'].includes(状态);
  }

  function 派发地图维护补丁(patchOps = [], message = '地图维护已写入。') {
    if (!Array.isArray(patchOps) || !patchOps.length) return;
    window.dispatchEvent(new CustomEvent('map-maintenance-request', { detail: { patchOps, message } }));
  }

  function 构建地图维护商店(地点名 = '', 模板键 = 'place') {
    const 清理名 = toText(地点名, '新地点').trim() || '新地点';
    const 商店名 = 模板键 === 'shop' ? 清理名 : `${清理名}杂货店`;
    return {
      [商店名]: {
        库存: {},
        下次刷新tick: 0
      }
    };
  }

  function 判断地图维护城市类型(模板键 = '') {
    return toText(模板键, '') === 'city';
  }

  function 构建地图维护城市数据(输入 = {}) {
    const 地点名 = toText(输入.地点名, '').trim() || '新城市';
    const 描述 = toText(输入.描述, '').trim() || '新建立的城市。';
    const 坐标 = 获取地图维护坐标();
    const 子节点 = {};
    const 商店 = 输入.启用商店
      ? 构建地图维护商店(地点名, 'city')
      : {};
    if (输入.启用工坊) {
      子节点[`${地点名}工坊区`] = {
        类型: '工坊',
        状态: 'intact',
        描述: `${地点名}的工坊与委托办理区。`,
      };
    }
    if (输入.启用商店) {
      子节点[`${地点名}商业街`] = {
        类型: '商店',
        状态: 'intact',
        描述: `${地点名}的基础商业街区。`,
      };
    }
    return {
      类型: '城市',
      状态: 'intact',
      描述,
      x: 坐标.x,
      y: 坐标.y,
      掌控势力: '未知',
      人口: 0,
      守护军团: '无',
      经济状况: '未知',
      子节点,
      商店,
    };
  }

  function 构建地图维护地点数据(输入 = {}) {
    const 地点名 = toText(输入.地点名, '').trim() || '临时地点';
    const 模板键 = toText(输入.模板键, 'place');
    const 模板 = 地图维护地点模板[模板键] || 地图维护地点模板.place;
    const 坐标 = 获取地图维护坐标();
    const 新地点 = {
      类型: 模板.类型,
      节点类型: 模板.节点类型,
      状态: 'intact',
      描述: toText(输入.描述, '').trim() || `${模板.标签}。`,
      x: 坐标.x,
      y: 坐标.y,
      归属父节点: 获取地图维护父节点名(),
    };
    if (输入.启用商店) 新地点.商店 = 构建地图维护商店(地点名, 模板键);
    return 新地点;
  }

  function 打开地图维护弹窗(操作 = '', 上下文 = {}) {
    return new Promise(resolve => {
      const 当前操作 = toText(操作, '');
      const 旧弹窗 = document.querySelector('[data-map-maintenance-modal]');
      if (旧弹窗) 旧弹窗.remove();
      const 焦点名 = toText(上下文.焦点名, '');
      const 是新增 = 当前操作 === 'add';
      const 标题 = 是新增 ? '新增地点' : 当前操作 === 'damage' ? '破坏地点' : '修复地点';
      const 模板选项 = Object.entries(地图维护地点模板)
        .map(([键, 模板]) => `<option value="${escapeMapHtml(键)}">${escapeMapHtml(模板.标签)}</option>`)
        .join('');
      const 弹窗 = document.createElement('div');
      弹窗.className = 'map-maintenance-modal';
      弹窗.setAttribute('data-map-maintenance-modal', '1');
      弹窗.innerHTML = `
        <form class="map-maintenance-dialog" data-map-maintenance-form>
          <h3>${escapeMapHtml(标题)}</h3>
          <small>${escapeMapHtml(是新增 ? `坐标 ${获取地图维护坐标().x}, ${获取地图维护坐标().y} · 父节点 ${获取地图维护父节点名()}` : (焦点名 || '当前坐标'))}</small>
          <div class="map-maintenance-grid">
            ${是新增 ? `
              <label class="map-maintenance-field">
                <span>名称</span>
                <input name="地点名" value="临时地点" autocomplete="off" />
              </label>
              <label class="map-maintenance-field">
                <span>类型</span>
                <select name="模板键">${模板选项}</select>
              </label>
              <div class="map-maintenance-checks" data-map-maintenance-extra-options>
                <label data-map-maintenance-extra="shop"><input type="checkbox" name="启用商店" /> 商店</label>
                <label data-map-maintenance-extra="craft"><input type="checkbox" name="启用工坊" /> 工坊</label>
              </div>
              <label class="map-maintenance-field">
                <span>描述</span>
                <textarea name="描述">调试新增地点</textarea>
              </label>
            ` : `
              <label class="map-maintenance-field">
                <span>地点</span>
                <input name="焦点名" value="${escapeMapHtml(焦点名)}" autocomplete="off" readonly />
              </label>
              <label class="map-maintenance-field">
                <span>变更记录</span>
                <textarea name="描述">${escapeMapHtml(当前操作 === 'damage' ? '地点受损，服务暂停。' : '地点修复，服务恢复。')}</textarea>
              </label>
            `}
          </div>
          <div class="map-maintenance-actions">
            <button type="button" data-map-maintenance-submit="cancel">取消</button>
            <button type="submit" data-map-maintenance-submit="confirm">确定</button>
          </div>
        </form>
      `;
      let 已关闭 = false;
      const 关闭 = 结果 => {
        if (已关闭) return;
        已关闭 = true;
        弹窗.remove();
        resolve(结果 || { ok: false });
      };
      注册地图卸载(() => 关闭({ ok: false }));
      注册地图元素事件(弹窗, '', 'click', event => {
        if (event.target === 弹窗) 关闭({ ok: false });
        const 按钮 = event.target instanceof Element ? event.target.closest('[data-map-maintenance-submit="cancel"]') : null;
        if (按钮) 关闭({ ok: false });
      });
      const 表单 = 弹窗.querySelector('[data-map-maintenance-form]');
      const 类型选择 = 表单 ? 表单.querySelector('select[name="模板键"]') : null;
      const 刷新附加选项 = () => {
        if (!类型选择) return;
        const 模板键 = toText(类型选择.value, 'place');
        const 显示附加 = ['place', 'city'].includes(模板键);
        const 附加容器 = 表单.querySelector('[data-map-maintenance-extra-options]');
        if (附加容器) 附加容器.style.display = 显示附加 ? '' : 'none';
        表单.querySelectorAll('[data-map-maintenance-extra] input').forEach(输入框 => {
          输入框.disabled = !显示附加;
          if (!显示附加) 输入框.checked = false;
        });
      };
      if (类型选择) {
        注册地图元素事件(类型选择, '', 'change', 刷新附加选项);
        刷新附加选项();
      }
      注册地图元素事件(表单, '', 'submit', event => {
        event.preventDefault();
        刷新附加选项();
        const 数据 = new FormData(表单);
        关闭({
          ok: true,
          地点名: toText(数据.get('地点名'), '').trim(),
          模板键: toText(数据.get('模板键'), 'place'),
          启用商店: 数据.has('启用商店'),
          启用工坊: 数据.has('启用工坊'),
          焦点名: toText(数据.get('焦点名'), '').trim(),
          描述: toText(数据.get('描述'), '').trim()
        });
      });
      document.body.appendChild(弹窗);
      const 名称输入 = 弹窗.querySelector('input[name="地点名"], textarea[name="描述"]');
      if (名称输入) setTimeout(() => 名称输入.focus(), 30);
    });
  }

  async function 执行地图维护操作(操作 = '') {
    const 当前操作 = toText(操作, '');
    const 焦点项 = 获取地图维护焦点项();
    const 焦点名 = toText(焦点项 && 焦点项.name, mapState.selectedFreePoint ? '' : (mapState.selectedNode || mapState.currentNode || ''));
    if (当前操作 === 'add') {
      const 输入 = await 打开地图维护弹窗('add', { 焦点名 });
      if (!输入.ok) return;
      const 地点名 = toText(输入.地点名, '').trim();
      if (!地点名) return;
      if (判断地图维护城市类型(输入.模板键)) {
        const 新城市 = 构建地图维护城市数据({ ...输入, 地点名 });
        const patchOps = [
          { op: 'add', path: 构建地图维护指针路径(['world', '地点', 地点名]), value: 新城市 },
          { op: 'add', path: '/sys/系统播报', value: `[地图维护] 已新增城市【${地点名}】。` }
        ];
        派发地图维护补丁(patchOps, `已新增城市：${地点名}`);
        return;
      }
      const 新地点 = 构建地图维护地点数据({ ...输入, 地点名 });
      const patchOps = [
        { op: 'add', path: 构建地图维护指针路径(['world', '动态地点', 地点名]), value: 新地点 },
        { op: 'add', path: '/sys/系统播报', value: `[地图维护] 已新增动态地点【${地点名}】。` }
      ];
      派发地图维护补丁(patchOps, `已新增动态地点：${地点名}`);
      return;
    }
    if (!焦点名) {
      if (window.MVU_Toast && typeof window.MVU_Toast.show === 'function') window.MVU_Toast.show('请选择地点。', 'warning');
      return;
    }
    if (当前操作 === 'delete') {
      const 动态地点 = deepGet(mapState.baseSnapshot || mapState.snapshot, ['rootData', 'world', '动态地点', 焦点名], null);
      if (!动态地点) {
        if (window.MVU_Toast && typeof window.MVU_Toast.show === 'function') window.MVU_Toast.show('只能删除动态地点。', 'warning');
        return;
      }
      const 占用角色 = 读取动态地点占用角色列表(焦点名);
      if (占用角色.length) {
        if (window.MVU_Toast && typeof window.MVU_Toast.show === 'function') window.MVU_Toast.show(`仍有角色停留：${占用角色.slice(0, 3).join('、')}`, 'warning');
        return;
      }
      if (!window.confirm(`删除动态地点【${焦点名}】？`)) return;
      const patchOps = [
        { op: 'remove', path: 构建地图维护指针路径(['world', '动态地点', 焦点名]) },
        { op: 'add', path: '/sys/系统播报', value: `[地图维护] 已删除动态地点【${焦点名}】。` }
      ];
      派发地图维护补丁(patchOps, `已删除动态地点：${焦点名}`);
      return;
    }
    const 输入 = await 打开地图维护弹窗(当前操作, { 焦点名 });
    if (!输入.ok) return;
    const 动态地点 = deepGet(mapState.baseSnapshot || mapState.snapshot, ['rootData', 'world', '动态地点', 焦点名], null);
    const 状态值 = 当前操作 === 'damage' ? 'ruins' : 当前操作 === 'repair' ? 'intact' : '';
    if (!状态值) return;
    const 描述值 = toText(输入.描述, '').trim();
    const 状态路径 = 动态地点
      ? 构建地图维护指针路径(['world', '动态地点', 焦点名, '状态'])
      : (() => {
          const 命中 = 获取地点节点及父级(焦点名, mapState.baseSnapshot || mapState.snapshot);
          return 命中 && Array.isArray(命中.指针路径) ? 构建地图维护指针路径([...命中.指针路径, '状态']) : '';
        })();
    if (!状态路径) return;
    const 基础路径 = 状态路径.replace(/\/状态$/, '');
    const 原描述 = toText(焦点项 && (焦点项.desc || 焦点项['描述']), '');
    const 维护描述 = `${原描述 && 原描述 !== '无' ? `${原描述}\n` : ''}[地图维护] ${当前操作 === 'damage' ? '破坏' : '修复'}：${描述值 || (当前操作 === 'damage' ? '地点受损，服务暂停。' : '地点修复，服务恢复。')}`;
    const patchOps = [
      { op: 'add', path: 状态路径, value: 状态值 },
      { op: 'add', path: `${基础路径}/描述`, value: 维护描述 },
      { op: 'add', path: '/sys/系统播报', value: `[地图维护] 【${焦点名}】已${当前操作 === 'damage' ? '破坏，节点动作暂停' : '修复，节点动作恢复'}。` }
    ];
    派发地图维护补丁(patchOps, `${焦点名} 已${当前操作 === 'damage' ? '破坏' : '修复'}`);
  }

  function 规范商店匹配文本(文本 = '') {
    return toText(文本, '')
      .replace(/分会/g, '')
      .replace(/分店/g, '')
      .replace(/东海/g, '')
      .replace(/协会/g, '')
      .replace(/商店|店铺|商城/g, '')
      .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '')
      .trim();
  }

  function 获取节点商店上下文(节点项 = null, snapshot = mapState.baseSnapshot || mapState.snapshot) {
    const 节点名 = toText(节点项 && 节点项.name, '');
    const 命中 = 获取地点节点及父级(节点名, snapshot);
    const 直接商店 = 命中 && 命中.节点 && 命中.节点.商店 && typeof 命中.节点.商店 === 'object' ? 命中.节点.商店 : {};
    const 父商店 = 命中 && 命中.父节点 && 命中.父节点.商店 && typeof 命中.父节点.商店 === 'object' ? 命中.父节点.商店 : {};
    const 商店表 = Object.keys(直接商店).length ? 直接商店 : 父商店;
    const 商店名列表 = Object.keys(商店表 || {});
    if (!商店名列表.length) return { 商店表: {}, 商店名: '', 商品列表: [], 来源地点: 命中 ? (Object.keys(直接商店).length ? 命中.名称 : 命中.父名) : '' };
    const 节点匹配键 = 规范商店匹配文本(节点名);
    const 类型匹配键 = 规范商店匹配文本(toText(节点项 && (节点项.type || 节点项.nodeKind), ''));
    const 商店名 = 商店名列表.find(候选名 => {
      const 商店匹配键 = 规范商店匹配文本(候选名);
      return 商店匹配键 && (商店匹配键.includes(节点匹配键) || 节点匹配键.includes(商店匹配键) || 商店匹配键.includes(类型匹配键));
    }) || (/商店|店铺|杂货/.test(`${节点名} ${toText(节点项 && 节点项.type, '')}`) ? 商店名列表[0] : '');
    const 商品表 = 商店名 && 商店表[商店名] && 商店表[商店名].库存 && typeof 商店表[商店名].库存 === 'object'
      ? 商店表[商店名].库存
      : {};
    const 商品列表 = Object.entries(商品表)
      .filter(([, 商品]) => Number(商品 && 商品.库存 || 0) > 0)
      .slice(0, 5)
      .map(([商品名, 商品]) => ({
        名称: 商品名,
        库存: Number(商品 && 商品.库存 || 0),
        价格: Number(商品 && 商品.价格 || 0),
        货币: toText(商品 && 商品.货币, '联邦币')
      }));
    return { 商店表, 商店名, 商品列表, 来源地点: 命中 ? (Object.keys(直接商店).length ? 命中.名称 : 命中.父名) : '' };
  }

  function 获取节点本地动作(节点项 = null, snapshot = mapState.baseSnapshot || mapState.snapshot) {
    if (!节点项) return [];
    if (地图节点已损毁(节点项)) return [];
    const 动作集合 = new Set();
    const 节点文本 = `${toText(节点项.name, '')} ${toText(节点项.type, '')} ${toText(节点项.nodeKind, '')}`;
    const 商店上下文 = 获取节点商店上下文(节点项, snapshot);
    const 可结算动作集合 = new Set(['trade', 'bid', 'craft', 'battle', 'meditate', 'train_body', 'train_mind', 'rest', 'sleep']);
    const 加入动作 = 动作 => {
      const 标准动作 = toText(动作, '');
      if (!标准动作 || ['inspect', 'enter', 'preview'].includes(标准动作)) return;
      if (标准动作 === 'shop' || 标准动作 === 'black_market') 动作集合.add('trade');
      else if (标准动作 === 'auction') 动作集合.add('bid');
      else if (标准动作 === 'train') {
        动作集合.add('train_body');
        动作集合.add('train_mind');
      } else if (可结算动作集合.has(标准动作)) 动作集合.add(标准动作);
    };
    []
      .concat(Array.isArray(节点项.actionSlots) ? 节点项.actionSlots : [])
      .concat(Array.isArray(节点项.interactions) ? 节点项.interactions : [])
      .concat(Array.isArray(节点项.services) ? 节点项.services : [])
      .forEach(加入动作);
    if (商店上下文.商店名) 加入动作('trade');
    if (/拍卖/.test(节点文本)) 加入动作('bid');
    if (/锻造师协会|制造师协会|设计师协会|修理师协会|副职业|工坊/.test(节点文本)) {
      加入动作('craft');
      加入动作('trade');
    }
    加入动作('meditate');
    加入动作('train_body');
    加入动作('train_mind');
    加入动作('rest');
    加入动作('sleep');
    if (!动作集合.size) 加入动作(getPrimaryNodeInteraction(节点项));
    return Array.from(动作集合).filter(动作 => 动作 && 可结算动作集合.has(动作));
  }

  function 构建星图外壳节点面板(选项 = {}) {
    const snapshot = mapState.snapshot || buildFallbackSnapshot();
    const 指定焦点名 = toText(选项 && 选项.焦点名称, '').trim();
    const 显式自由坐标 = !!(选项 && Object.prototype.hasOwnProperty.call(选项, '自由坐标'));
    const isFreeSelection = 显式自由坐标 ? !!选项.自由坐标 : !!mapState.selectedFreePoint;
    const previewMeta = snapshot.previewMeta || null;
    const inPreview = hasActivePreview();
    const previewCurrentBranch = isPreviewCurrentBranch();
    const previewTrailNames = Array.isArray(mapState.previewTrail) ? mapState.previewTrail.map(名称 => toText(名称, '')).filter(Boolean) : [];
    const previewAnchorName = toText(previewMeta && previewMeta.anchor_name, snapshot.currentFocusName || snapshot.currentLoc);
    const focusItem = isFreeSelection
      ? null
      : getItemByName(指定焦点名)
      || getItemByName(mapState.selectedNode)
      || getItemByName(resolveSelectedNodeForLayer(mapState.layer))
      || getItemByName(snapshot.currentFocusName)
      || snapshot.items[0]
      || null;
    const focusName = isFreeSelection
      ? formatFreePoint(mapState.selectedFreePoint || mapState.currentFreePoint || mapState.hoverCoord, '坐标')
      : toText(focusItem && focusItem.name, 指定焦点名 || snapshot.currentFocusName || snapshot.currentLoc || '未知地点');
    if (!focusName) return null;
    const currentName = getActualCurrentLoc() || snapshot.currentLoc || '未知地点';
    const rawCurrentName = toText(snapshot.currentLocFull || snapshot.currentLoc || currentName, currentName);
    const 在场人物面板 = 构建星图在场人物列表HTML({
      snapshot,
      focusItem,
      detailPanelItem: focusItem,
      panelMode: 'selection',
      isFreeSelection,
      inPreview,
      previewCurrentBranch,
      previewTrailNames,
      previewAnchorName,
      focusName,
      currentName,
      rawCurrentName,
      输出模式: 'dispatch'
    });
    const primaryHtml = 构建星图外壳焦点HTML(snapshot, focusItem, {
      ...选项,
      焦点名称: focusName,
      自由坐标: isFreeSelection,
      地形: toText(选项 && 选项.地形, '')
    });
    const 焦点规范名 = 归一地点名(focusName);
    const 当前规范名 = 归一地点名(currentName);
    const 是否当前位置 = !isFreeSelection && !!焦点规范名 && (焦点规范名 === 当前规范名 || 当前规范名.endsWith(`-${焦点规范名}`));
    const 预览键 = isFreeSelection ? '' : (是否当前位置 ? '当前节点详情' : `地图节点：${focusName}`);

    return {
      ok: true,
      focusName,
      primaryHtml,
      secondaryHtml: `<div class="map-npc-panel map-npc-panel--unified"><div class="map-npc-list">${在场人物面板.html}</div></div>`,
      primaryPreview: 预览键,
      secondaryPreview: 预览键,
    };
  }

  function createRenderItem(name, rawItem, extra = {}) {
    const displayName = extra.displayName || toText(name, '未命名节点');
    const rawX = rawItem && rawItem.x !== undefined ? rawItem.x : NaN;
    const rawY = rawItem && rawItem.y !== undefined ? rawItem.y : NaN;
    const parsedRawX = toNumber(rawX, NaN);
    const parsedRawY = toNumber(rawY, NaN);
    const x = parsedRawX;
    const y = parsedRawY;
    const source = toText(extra.source || (rawItem && rawItem.source) || 'static', 'static');
    const icon = toText(extra.icon || (rawItem && rawItem.icon) || '', '');
    const state = toText(extra.state || (rawItem && rawItem.state) || '可见', '可见');
    const type = toText(extra.type || (rawItem && rawItem.type) || (icon || '节点'), '节点');
    const faction = toText(extra.faction || (rawItem && rawItem.faction) || deepGet(rawItem, 'metadata.faction', '未知'), '未知');
    const importance = toNumber(extra.importance !== undefined ? extra.importance : (rawItem && rawItem.importance !== undefined ? rawItem.importance : deepGet(rawItem, 'metadata.importance', NaN)), NaN);
    const resolvedIcon = getMapNodeTextField(rawItem, ['icon'], icon) || icon;
    const resolvedState = getMapNodeTextField(rawItem, ['state', '状态'], state) || state;
    const resolvedType = getMapNodeTextField(rawItem, ['type', 'node_type', '类型'], type) || type;
    const resolvedFaction = getMapNodeTextField(rawItem, ['faction', 'default_faction', '掌控势力'], faction) || faction;
    const resolvedImportanceCandidate = getMapNodeNumberField(rawItem, ['importance', '重要度'], NaN);
    const resolvedImportance = Number.isFinite(resolvedImportanceCandidate) ? resolvedImportanceCandidate : importance;
    const resolvedDesc = getMapNodeTextField(rawItem, ['desc', '描述'], extra.desc !== undefined ? toText(extra.desc, '无') : '无');
    const resolvedNodeKind = getMapNodeTextField(rawItem, ['node_kind', 'nodeKind', '节点类型'], extra.nodeKind || '') || extra.nodeKind || '';
    const resolvedInteractions = getMapNodeListField(rawItem, ['interactions']).length ? getMapNodeListField(rawItem, ['interactions']) : (extra.interactions || []);
    const resolvedServices = getMapNodeListField(rawItem, ['services']).length ? getMapNodeListField(rawItem, ['services']) : (extra.services || []);
    const resolvedActionSlots = getMapNodeListField(rawItem, ['action_slots', 'actionSlots']).length ? getMapNodeListField(rawItem, ['action_slots', 'actionSlots']) : (extra.actionSlots || []);
    const resolvedEventId = getMapNodeTextField(rawItem, ['event_id', 'eventId'], extra.eventId || '') || extra.eventId || '';
    const resolvedLevel = getMapNodeNumberField(rawItem, ['level', '等级'], toNumber(rawItem && rawItem.level, 0));
    const canEnter = !!extra.canEnter;
    const pointKind = toText(extra.pointKind || inferPointKind(displayName, source, resolvedType, resolvedIcon), 'node');
    const behaviorMeta = deriveNodeBehaviorMeta(displayName, rawItem || {}, {
      type: resolvedType,
      canEnter,
      nodeKind: resolvedNodeKind,
      interactions: resolvedInteractions,
      services: resolvedServices,
      eventId: resolvedEventId
    });
    const validCoord = Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0;
    return {
      id: extra.id || displayName,
      name: displayName,
      rawName: toText(extra.baseName || displayName, displayName),
      source,
      type,
      desc: toText(extra.desc || (rawItem && rawItem.desc) || '无', '无'),
      state,
      icon,
      faction,
      importance,
      canEnter,
      x,
      y,
      validCoord,
      pointKind,
      nodeKind: behaviorMeta.nodeKind,
      interactions: behaviorMeta.interactions,
      services: behaviorMeta.services,
      actionSlots: behaviorMeta.actionSlots,
      eventId: behaviorMeta.eventId,
      major: !!extra.major || canEnter || source === 'settlement',
      level: toNumber(rawItem && rawItem.level, 0),
      type: resolvedType,
      desc: resolvedDesc,
      state: resolvedState,
      icon: resolvedIcon,
      faction: resolvedFaction,
      importance: resolvedImportance,
      nodeKind: resolvedNodeKind || behaviorMeta.nodeKind,
      interactions: resolvedInteractions.length ? resolvedInteractions : behaviorMeta.interactions,
      services: resolvedServices.length ? resolvedServices : behaviorMeta.services,
      actionSlots: resolvedActionSlots.length ? resolvedActionSlots : behaviorMeta.actionSlots,
      eventId: resolvedEventId || behaviorMeta.eventId,
      level: resolvedLevel,
      current: !!extra.current
    };
  }

  function buildRuntimeMapItems(snapshot) {
    const seen = new Set();
    const items = [];
    const pushUnique = item => {
      if (!item || !item.name || seen.has(item.name)) return;
      seen.add(item.name);
      items.push(item);
    };


    snapshot.visibleNodes.forEach(([name, item]) => {
      const hasChildPreview = !!(snapshot.availableChildMaps && snapshot.availableChildMaps[name]);
      const normalizedNodeType = getMapNodeTextField(item, ['type', '类型'], '地图节点');
      const normalizedNodeIcon = getMapNodeTextField(item, ['icon'], '');
      const normalizedNodeState = getMapNodeTextField(item, ['state', '状态'], item && item.level ? `Lv.${item.level}` : '可见');
      const normalizedNodeDesc = getMapNodeTextField(item, ['desc', '描述'], '无');
      const normalizedNodeFaction = getMapNodeTextField(item, ['faction', '掌控势力'], '未知');
      const normalizedNodeImportance = getMapNodeNumberField(item, ['importance', '重要度'], NaN);
      const normalizedNodeInteractions = getMapNodeListField(item, ['interactions']);
      const normalizedNodeServices = getMapNodeListField(item, ['services']);
      const normalizedNodeActionSlots = getMapNodeListField(item, ['action_slots', 'actionSlots']);
      const normalizedNodeEventId = getMapNodeTextField(item, ['event_id', 'eventId'], '');
      pushUnique(createRenderItem(name, item || {}, {
        id: name,
        baseName: name,
        source: toText(item && item.source, 'static'),
        type: toText(item && item.type, '地图节点'),
        icon: toText(item && item.icon, ''),
        state: toText(item && item.state, item && item.level ? `Lv.${item.level}` : '可见'),
        canEnter: hasChildPreview,
        major: hasChildPreview || toNumber(item && item.level, 0) <= 2,
        desc: toText(item && item.desc, '无'),
        faction: toText(item && item.faction, '未知'),
        importance: toNumber(item && item.importance, NaN),
        current: name === snapshot.currentLoc || name === snapshot.currentFocusName,
        currentMapId: snapshot.currentMapId,
        mapLevel: snapshot.mapLevel,
        coordSystem: snapshot.coordSystem
      }));
    });

    snapshot.visibleDynamics.forEach(([name, item]) => {
      const hasChildPreview = !!(snapshot.availableChildMaps && snapshot.availableChildMaps[name]);
      pushUnique(createRenderItem(name, item || {}, {
        id: name,
        baseName: name,
        source: 'dynamic',
        type: toText(item && item.type, '动态地点'),
        state: toText(item && item.state, '动态'),
        pointKind: 'dynamic',
        canEnter: hasChildPreview,
        major: hasChildPreview,
        desc: toText(item && item.desc, '无'),
        faction: toText(item && item.faction, '未知'),
        importance: toNumber(item && item.importance, NaN),
        nodeKind: toText(item && (item.node_kind || item.nodeKind), ''),
        interactions: Array.isArray(item && item.interactions) ? item.interactions : [],
        services: Array.isArray(item && item.services) ? item.services : [],
        actionSlots: Array.isArray(item && (item.action_slots || item.actionSlots)) ? (item.action_slots || item.actionSlots) : [],
        eventId: toText(item && (item.event_id || item.eventId), ''),
        current: name === snapshot.currentLoc || name === snapshot.currentFocusName,
        currentMapId: snapshot.currentMapId,
        mapLevel: snapshot.mapLevel,
        coordSystem: snapshot.coordSystem
      }));
    });


    // 力导向节点自动避让 (Relaxation)：让距离过近的节点互相推开
    if (items.length > 1) {
      const safeDist = 65; // 要求节点之间的最小物理像素距离
      for (let iter = 0; iter < 10; iter++) {
        let moved = false;
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            let dx = items[j].x - items[i].x;
            let dy = items[j].y - items[i].y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < safeDist) {
              if (dist === 0) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); dist = Math.sqrt(dx*dx+dy*dy); }
              const pushFactor = (safeDist - dist) / 2;
              const pushX = (dx / dist) * pushFactor;
              const pushY = (dy / dist) * pushFactor;
              items[i].x -= pushX; items[i].y -= pushY;
              items[j].x += pushX; items[j].y += pushY;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
    }

    return items;
  }

  function sanitizeBounds(bounds) {
    const minX = clamp(toNumber(bounds.minX, 0), 0, WORLD_IMAGE_WIDTH);
    const minY = clamp(toNumber(bounds.minY, 0), 0, WORLD_IMAGE_HEIGHT);
    const maxX = clamp(toNumber(bounds.minX, 0) + Math.max(1, toNumber(bounds.width, WORLD_IMAGE_WIDTH)), 1, WORLD_IMAGE_WIDTH);
    const maxY = clamp(toNumber(bounds.minY, 0) + Math.max(1, toNumber(bounds.height, WORLD_IMAGE_HEIGHT)), 1, WORLD_IMAGE_HEIGHT);
    const width = Math.max(220, maxX - minX);
    const height = Math.max(220, maxY - minY);
    return {
      minX: clamp(minX, 0, WORLD_IMAGE_WIDTH - 1),
      minY: clamp(minY, 0, WORLD_IMAGE_HEIGHT - 1),
      width: clamp(width, 220, WORLD_IMAGE_WIDTH),
      height: clamp(height, 220, WORLD_IMAGE_HEIGHT)
    };
  }

  function 计算地图显示边界(items = [], padding = 180) {
    const 坐标列表 = (Array.isArray(items) ? items : [])
      .filter(item => item && item.validCoord && Number.isFinite(toNumber(item.x, NaN)) && Number.isFinite(toNumber(item.y, NaN)))
      .map(item => ({ x: toNumber(item.x, 0), y: toNumber(item.y, 0) }));
    if (!坐标列表.length) return { ...DEFAULT_IMAGE_BOUNDS };
    const 最小X = Math.min(...坐标列表.map(item => item.x));
    const 最大X = Math.max(...坐标列表.map(item => item.x));
    const 最小Y = Math.min(...坐标列表.map(item => item.y));
    const 最大Y = Math.max(...坐标列表.map(item => item.y));
    const 横向留白 = Math.max(90, toNumber(padding, 180));
    const 纵向留白 = Math.max(90, toNumber(padding, 180));
    return sanitizeBounds({
      minX: 最小X - 横向留白,
      minY: 最小Y - 纵向留白,
      width: Math.max(260, (最大X - 最小X) + 横向留白 * 2),
      height: Math.max(220, (最大Y - 最小Y) + 纵向留白 * 2)
    });
  }


  function inferInitialLayer(snapshot) {
    const zoomHint = toNumber(snapshot && snapshot.currentZoomHint, NaN);
    if (Number.isFinite(zoomHint) && zoomHint > 0) {
      return resolveMapLayerByZoom(clamp(zoomHint, MIN_MAP_ZOOM, MAX_MAP_ZOOM));
    }
    const level = toText(snapshot && snapshot.mapLevel, 'world');
    if (level === 'facility' || level === 'district' || level === 'city') return 'facility';
    if (level === 'region') return 'city';
    return 'continent';
  }

  function shouldMapLayerFollowZoom(snapshot = mapState.snapshot) {
    const level = toText(snapshot && snapshot.mapLevel, 'world');
    return level === 'world' || level === 'continent' || level === 'region';
  }

  function getDefaultZoomForSnapshot(snapshot, layer) {
    return shouldMapLayerFollowZoom(snapshot)
      ? (mapZoomTargets[layer] || DEFAULT_MAP_ZOOM)
      : DEFAULT_MAP_ZOOM;
  }

  function getLocationPathSegments(loc = '') {
    return toText(loc, '')
      .replace(/^斗罗大陆-/, '')
      .replace(/^斗灵大陆-/, '')
      .split('-')
      .map(segment => toText(segment, '').trim())
      .filter(Boolean);
  }

  function collectVisibleLocationNames(snapshotLike) {
    const names = new Set();
    const pushName = value => {
      const name = toText(value, '').trim();
      if (name) names.add(name);
    };
    const collect = value => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(entry => {
          if (Array.isArray(entry)) {
            pushName(entry[0]);
            return;
          }
          if (entry && typeof entry === 'object') pushName(entry.name || entry.id);
        });
        return;
      }
      if (typeof value === 'object') Object.keys(value).forEach(pushName);
    };
    collect(snapshotLike && snapshotLike.visibleNodes);
    collect(snapshotLike && snapshotLike.visibleDynamics);
    collect(snapshotLike && snapshotLike.items);
    return names;
  }

  function resolveVisibleLocationAnchor(snapshotLike, currentLocFull) {
    const fullLoc = toText(currentLocFull, '斗罗大陆-未知地点');
    const pathSegments = getLocationPathSegments(fullLoc);
    const leafName = pathSegments[pathSegments.length - 1] || '未知地点';
    const previewMeta = snapshotLike && snapshotLike.previewMeta
      ? snapshotLike.previewMeta
      : deepGet(snapshotLike, 'preview_meta', null);
    const previewAnchorName = toText(previewMeta && previewMeta.anchor_name, '');
    const currentWithinView = !previewAnchorName || pathSegments.includes(previewAnchorName);
    const visibleNames = currentWithinView ? collectVisibleLocationNames(snapshotLike) : new Set();
    let anchorName = '';
    for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
      const segment = pathSegments[index];
      if (segment && visibleNames.has(segment)) {
        anchorName = segment;
        break;
      }
    }
    if (!anchorName && currentWithinView && previewAnchorName && visibleNames.has(previewAnchorName)) {
      anchorName = previewAnchorName;
    }
    return {
      fullLoc,
      pathSegments,
      leafName,
      anchorName,
      currentWithinView
    };
  }

  function buildMapSnapshot(rootData) {
    const [activeName, activeChar] = resolveActiveCharacter(rootData || {});
    const characterIndexPayload = buildCharactersByLocationIndex(rootData, activeName);
    return buildSnapshotFromMapPayload(rootData, rootData, activeName, activeChar, characterIndexPayload);
  }

  function buildSnapshotFromMapPayload(payload, sourceRootData, activeName, activeChar, cachedIndexes = null) {
    const isPreview = payload && payload.current_map_id && payload.current_map_id !== 'map_douluo_world';
    const rootData = isPreview ? (payload.rootData || sourceRootData || mapState.baseSnapshot?.rootData || {}) : (sourceRootData || payload || {});
    const currentLocFull = toText(deepGet(activeChar, '状态.位置', '斗罗大陆-未知地点'), '斗罗大陆-未知地点');
    const currentMapId = isPreview ? payload.current_map_id : 'map_douluo_world';
    const characterIndexPayload = cachedIndexes && cachedIndexes.charactersByLoc instanceof Map
      ? cachedIndexes
      : buildCharactersByLocationIndex(rootData, activeName);

    const visibleDynamics = {};
    if (isPreview && payload.visible_dynamic_locations && typeof payload.visible_dynamic_locations === 'object') {
      Object.assign(visibleDynamics, payload.visible_dynamic_locations);
    }
    const dynamicSource = deepGet(rootData, 'world.动态地点', {});
    for (const [dynName, dynData] of Object.entries(dynamicSource)) {
      if (!dynData || typeof dynData !== 'object') continue;
      const 动态父节点 = toText(dynData['归属父节点'], '');
      const 预览可见 = isPreview && 动态父节点 === payload.preview_meta?.anchor_name;
      if (预览可见) {
         visibleDynamics[dynName] = dynData;
      }
    }

    const visibleNodes = {};
    if (isPreview && payload.visible_nodes) {
      Object.assign(visibleNodes, payload.visible_nodes);
    } else {
      const rootLocations = deepGet(rootData, 'world.地点', {});
      Object.assign(visibleNodes, rootLocations);
    }

    const currentFocusCoord = {
      x: toNumber(deepGet(activeChar, '状态.横坐标', -1), NaN),
      y: toNumber(deepGet(activeChar, '状态.纵坐标', -1), NaN)
    };
    const currentAnchorMeta = resolveVisibleLocationAnchor({
      currentMapId,
      visibleNodes,
      visibleDynamics,
      previewMeta: payload && payload.preview_meta ? payload.preview_meta : null
    }, currentLocFull);
    const currentLocName = currentAnchorMeta.leafName;
    const currentFocusName = currentAnchorMeta.anchorName;
    const currentFocus = { loc: currentFocusName || (currentAnchorMeta.currentWithinView ? currentLocName : '') };
    const normalizedCurrentFocusCoord = currentAnchorMeta.currentWithinView
      ? currentFocusCoord
      : { x: NaN, y: NaN };

    const 内联子图索引 = isPreview
      ? {
        availableChildMaps: payload.available_child_maps && typeof payload.available_child_maps === 'object' ? payload.available_child_maps : {},
        previewChildMaps: payload.preview_child_maps && typeof payload.preview_child_maps === 'object' ? payload.preview_child_maps : {},
      }
      : 收集内联子图载荷索引(visibleNodes, visibleDynamics, rootData);

    const snapshot = {
      rootData,
      activeName,
      activeChar,
      currentLoc: currentLocName,
      currentLocFull,
      currentFocus,
      currentFocusName,
      currentFocusCoord: normalizedCurrentFocusCoord,
      currentWithinView: currentAnchorMeta.currentWithinView,
      coordSystem: resolveSnapshotCoordSystem(currentMapId, 'world'),
      currentMapId,
      currentZoomHint: 0,
      availableChildMaps: 内联子图索引.availableChildMaps,
      previewChildMaps: 内联子图索引.previewChildMaps,
      travelCandidates: Array.from(new Set([...Object.keys(visibleNodes), ...Object.keys(visibleDynamics)])),
      visibleNodes: safeEntries(visibleNodes),
      visibleDynamics: safeEntries(visibleDynamics),
      mapLevel: isPreview ? payload.map_meta?.map_level || 'city' : 'world',
      mapMeta: isPreview ? payload.map_meta : null,
      previewMeta: isPreview ? payload.preview_meta : null,
      coord_system: resolveSnapshotCoordSystem(),
      charactersByLoc: characterIndexPayload.charactersByLoc,
      characterDigest: characterIndexPayload.characterDigest
    };
    snapshot.items = buildRuntimeMapItems(snapshot);
    snapshot.bounds = isPreview ? 计算地图显示边界(snapshot.items, 240) : { ...DEFAULT_IMAGE_BOUNDS };
    return snapshot;
  }

  function buildMapRefreshSignature(snapshot, previewTrailToken = '') {
    if (!snapshot || typeof snapshot !== 'object') return '';
    const focusCoord = snapshot.currentFocusCoord || {};
    const itemDigest = Array.isArray(snapshot.items)
      ? snapshot.items.map(item => [
          toText(item && item.name, ''),
          toText(item && item.type, ''),
          toText(item && item.nodeKind, ''),
          toText(item && item.state, ''),
          item && item.canEnter ? '1' : '0',
          toText(item && item.eventId, '')
        ].join(':')).join('|')
      : '';
    return [
      toText(snapshot.currentMapId, ''), toText(snapshot.mapLevel, ''), toText(snapshot.currentLocFull, snapshot.currentLoc), toText(snapshot.currentFocusName, ''),
      Number.isFinite(focusCoord.x) ? roundCoord(focusCoord.x) : 'NaN', Number.isFinite(focusCoord.y) ? roundCoord(focusCoord.y) : 'NaN',
      previewTrailToken, snapshot.characterDigest || '', itemDigest
    ].join('¦');
  }

  function getMapInfoPanelMode() {
    return mapState.infoPanelMode === 'selection' ? 'selection' : 'follow';
  }

  function setMapSyncState(status = '待同步', detail = '') {
    mapState.syncStatus = toText(status, '待同步');
    mapState.syncDetail = toText(detail, '');
    mapState.lastSyncAt = Date.now();
  }

  function formatMapSyncTime(timestamp = mapState.lastSyncAt) {
    if (!timestamp) return '--:--:--';
    try { return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false }); } catch (_) { return '--:--:--'; }
  }

  function buildFallbackSnapshot() {
    const fallback = {
      rootData: {
        world: {
          maps: {
            map_douluo_world: {
              name: '世界地图',
              map_level: 'world',
              coord_system: MAP_COORD_SYSTEM_IMAGE,
              coordinate_system: MAP_COORD_SYSTEM_IMAGE,
              bounds: { ...DEFAULT_IMAGE_BOUNDS }
            }
          },
          地点集合: {}
        }
      },
      activeName: '',
      activeChar: {
        状态: { 位置: '' },
        属性: { 魂力: 0, 体力: 0 },
        财富: { 联邦币: 0 },
        装备: { 斗铠: {}, 机甲: {} }
      },
      currentLoc: '',
      currentLocFull: '',
      currentFocus: { loc: '', x: NaN, y: NaN, coord_system: MAP_COORD_SYSTEM_IMAGE },
      currentFocusName: '',
      currentFocusCoord: { x: NaN, y: NaN },
      currentWithinView: true,
      currentMapId: 'map_douluo_world',
      currentZoomHint: 0,
      availableChildMaps: {},
      previewChildMaps: {},
      travelCandidates: [],
      visibleNodes: [],
      visibleDynamics: [],
      mapLevel: 'world',
      coordSystem: MAP_COORD_SYSTEM_IMAGE
    };
    fallback.items = [];
    fallback.bounds = { ...DEFAULT_IMAGE_BOUNDS };
    return fallback;
  }


  function hasActivePreview() {
    return Array.isArray(mapState.previewTrail) ? mapState.previewTrail.length > 0 : !!mapState.previewKey;
  }

  function syncPreviewKeyFromTrail() {
    mapState.previewKey = Array.isArray(mapState.previewTrail) && mapState.previewTrail.length
      ? mapState.previewTrail[mapState.previewTrail.length - 1]
      : '';
  }

  function getDynamicEntriesByParent(dynamicSource, parentName) {
    const source = dynamicSource && typeof dynamicSource === 'object' ? dynamicSource : {};
    const target = toText(parentName, '').trim();
    if (!target) return [];
    return Object.entries(source).filter(([, dynData]) => {
      if (!dynData || typeof dynData !== 'object') return false;
      return toText(dynData['归属父节点'], '').trim() === target;
    });
  }

  function buildPreviewPayloadFromRawLocation(nodeName, rawLocation, container = mapState.snapshot, parentMapId = '', 已访问节点集合 = new Set()) {
    const 安全节点名 = toText(nodeName, '').trim();
    if (!安全节点名 || 已访问节点集合.has(安全节点名)) return null;
    const children = getMapNodeChildren(rawLocation);
    const childEntries = children ? Object.entries(children) : [];
    const dynamicSource = deepGet(
      (mapState.baseSnapshot && mapState.baseSnapshot.rootData) || (mapState.snapshot && mapState.snapshot.rootData) || {},
      'world.动态地点',
      {}
    );
    const dynamicEntries = getDynamicEntriesByParent(dynamicSource, nodeName)
      .filter(([dynName]) => toText(dynName, '') !== nodeName);
    if (!childEntries.length && !dynamicEntries.length) return null;

    const currentMapId = `preview_${nodeName}`;
    const visibleNodeEntries = [];
    const availableChildMaps = {};
    const previewChildMaps = {};
    const validCoords = [];

    childEntries.forEach(([childName, childValue]) => {
      const child = childValue && typeof childValue === 'object' ? childValue : {};
      const nestedChildren = getMapNodeChildren(child);
      const hasChildren = !!(nestedChildren && Object.keys(nestedChildren).length);
      const hasDynamicChildren = getDynamicEntriesByParent(dynamicSource, childName).length > 0;
      const x = toNumber(child.x, NaN);
      const y = toNumber(child.y, NaN);

      if (Number.isFinite(x) && Number.isFinite(y)) validCoords.push({ x, y });

      visibleNodeEntries.push([childName, {
        children: nestedChildren,
        x: Number.isFinite(x) ? x : toNumber(rawLocation && rawLocation.x, NaN),
        y: Number.isFinite(y) ? y : toNumber(rawLocation && rawLocation.y, NaN),
        type: toText(child.type || child.node_type, '地图节点'),
        icon: toText(child.icon, ''),
        desc: toText(child.desc || child.描述, '无'),
        level: toNumber(child.level, 3),
        source: 'static',
        faction: toText(child.default_faction || child.faction, '未知'),
        importance: toNumber(child.importance, NaN),
        node_kind: toText(child.node_kind || child.nodeKind, ''),
        interactions: Array.isArray(child.interactions) ? child.interactions : toTextList(child.interactions),
        services: Array.isArray(child.services) ? child.services : toTextList(child.services),
        action_slots: Array.isArray(child.action_slots) ? child.action_slots : toTextList(child.action_slots || child.actionSlots),
        event_id: toText(child.event_id || child.eventId, ''),
        类型: getMapNodeTextField(child, ['type', 'node_type', '类型'], ''),
        描述: getMapNodeTextField(child, ['desc', '描述'], ''),
        状态: getMapNodeTextField(child, ['state', '状态'], ''),
        掌控势力: getMapNodeTextField(child, ['faction', 'default_faction', '掌控势力'], ''),
        重要度: getMapNodeNumberField(child, ['importance', '重要度'], NaN)
      }]);

      if (hasChildren || hasDynamicChildren) {
        availableChildMaps[childName] = `preview_${childName}`;
      }
    });

    dynamicEntries.forEach(([, dynData]) => {
      const dynX = toNumber(dynData && dynData.x, NaN);
      const dynY = toNumber(dynData && dynData.y, NaN);
      if (Number.isFinite(dynX) && Number.isFinite(dynY)) validCoords.push({ x: dynX, y: dynY });
    });

    dynamicEntries.forEach(([动态地点名, 动态地点数据]) => {
      const 动态节点 = 动态地点数据 && typeof 动态地点数据 === 'object' ? 动态地点数据 : {};
      const 动态子节点 = getMapNodeChildren(动态节点);
      const 有静态子节点 = !!(动态子节点 && Object.keys(动态子节点).length);
      const 有动态子节点 = getDynamicEntriesByParent(dynamicSource, 动态地点名)
        .some(([dynName]) => toText(dynName, '') !== toText(动态地点名, ''));
      if (有静态子节点 || 有动态子节点) availableChildMaps[动态地点名] = `preview_${动态地点名}`;
      const x = toNumber(动态节点.x, NaN);
      const y = toNumber(动态节点.y, NaN);
      visibleNodeEntries.push([动态地点名, {
        children: getMapNodeChildren(动态节点),
        x: Number.isFinite(x) ? x : toNumber(rawLocation && rawLocation.x, NaN),
        y: Number.isFinite(y) ? y : toNumber(rawLocation && rawLocation.y, NaN),
        type: getMapNodeTextField(动态节点, ['节点类型', 'type'], '动态地点'),
        desc: getMapNodeTextField(动态节点, ['描述', 'desc'], '无'),
        state: getMapNodeTextField(动态节点, ['状态', 'state'], '动态'),
        faction: getMapNodeTextField(动态节点, ['势力', 'faction', '掌控势力'], '未知'),
        importance: getMapNodeNumberField(动态节点, ['重要度', 'importance'], NaN),
        node_kind: getMapNodeTextField(动态节点, ['node_kind', 'nodeKind'], ''),
        source: 'dynamic',
        类型: getMapNodeTextField(动态节点, ['节点类型', 'type'], '动态地点'),
        描述: getMapNodeTextField(动态节点, ['描述', 'desc'], '无'),
        状态: getMapNodeTextField(动态节点, ['状态', 'state'], '动态'),
        掌控势力: getMapNodeTextField(动态节点, ['势力', 'faction', '掌控势力'], ''),
        重要度: getMapNodeNumberField(动态节点, ['重要度', 'importance'], NaN)
      }]);
    });

    let focusCoord = { x: NaN, y: NaN };
    if (validCoords.length > 0) {
      focusCoord.x = Number((validCoords.reduce((sum, coord) => sum + coord.x, 0) / validCoords.length).toFixed(2));
      focusCoord.y = Number((validCoords.reduce((sum, coord) => sum + coord.y, 0) / validCoords.length).toFixed(2));
    } else if (rawLocation && Number.isFinite(toNumber(rawLocation.x, NaN)) && Number.isFinite(toNumber(rawLocation.y, NaN))) {
      focusCoord.x = toNumber(rawLocation.x, NaN);
      focusCoord.y = toNumber(rawLocation.y, NaN);
    }

    const inferredMapLevel = childEntries.some(([, childValue]) => toNumber(childValue && childValue.level, 0) >= 4) ? 'facility' : 'city';
    return {
      current_map_id: currentMapId,
      current_zoom_hint: 0,
      current_focus: { loc: nodeName, x: focusCoord.x, y: focusCoord.y, settlement_id: '无', map_id: currentMapId },
      map_meta: {
        name: `${nodeName}区域预览`,
        map_level: inferredMapLevel,
        parent_map_id: parentMapId || 'map_douluo_world',
        anchor_loc: nodeName,
        child_maps: availableChildMaps
      },
      visible_nodes: Object.fromEntries(visibleNodeEntries),
      visible_dynamic_locations: Object.fromEntries(dynamicEntries),
      travel_candidates: Array.from(new Set([
        ...visibleNodeEntries.map(([childName]) => childName),
        ...dynamicEntries.map(([dynName]) => dynName)
      ])),
      available_child_maps: availableChildMaps,
      preview_meta: {
        anchor_name: nodeName,
        parent_name: container?.previewMeta?.anchor_name || container?.currentLoc || '',
        parent_map_id: parentMapId || 'map_douluo_world'
      },
      preview_child_maps: previewChildMaps
    };
  }

  function getNestedPreviewChildMap(container, nodeName) {
    if (!container || !nodeName) return null;
    const targetKey = String(nodeName).split('-').pop();
    const previewChildMaps = container && container.previewChildMaps && typeof container.previewChildMaps === 'object' ? container.previewChildMaps : {};
    if (previewChildMaps[targetKey]) return previewChildMaps[targetKey];
    const 下划线子图载荷 = container && container.preview_child_maps && typeof container.preview_child_maps === 'object' ? container.preview_child_maps : {};
    if (下划线子图载荷[targetKey]) return 下划线子图载荷[targetKey];
    const availableChildMaps = container && container.availableChildMaps && typeof container.availableChildMaps === 'object' ? container.availableChildMaps : {};
    const 下划线可进入子图 = container && container.available_child_maps && typeof container.available_child_maps === 'object' ? container.available_child_maps : {};
    if (!availableChildMaps[targetKey] && !下划线可进入子图[targetKey]) return null;
    const visibleNodeEntries = Array.isArray(container.visibleNodes) ? container.visibleNodes : safeEntries(container.visible_nodes);
    const visibleDynamicEntries = Array.isArray(container.visibleDynamics) ? container.visibleDynamics : safeEntries(container.visible_dynamic_locations);
    const 命中条目 = [...visibleNodeEntries, ...visibleDynamicEntries]
      .find(([name]) => toText(name, '') === targetKey || toText(name, '').split('-').pop() === targetKey);
    const 原始节点 = 命中条目 && 命中条目[1] && typeof 命中条目[1] === 'object' ? 命中条目[1] : null;
    if (!原始节点) return null;
    const 父地图ID = toText(container.currentMapId || container.current_map_id, '');
    const 子图载荷 = buildPreviewPayloadFromRawLocation(targetKey, 原始节点, container, 父地图ID);
    if (!子图载荷) return null;
    if (container.previewChildMaps && typeof container.previewChildMaps === 'object') {
      container.previewChildMaps[targetKey] = 子图载荷;
    } else if (container.preview_child_maps && typeof container.preview_child_maps === 'object') {
      container.preview_child_maps[targetKey] = 子图载荷;
    } else {
      container.previewChildMaps = { [targetKey]: 子图载荷 };
    }
    return 子图载荷;
  }

  function getPreviewPayloadByTrail(snapshot, trail = mapState.previewTrail) {
    if (!snapshot || !Array.isArray(trail) || !trail.length) return null;
    let cursor = snapshot;
    let payload = null;
    for (const nodeName of trail) {
      payload = getNestedPreviewChildMap(cursor, nodeName);
      if (!payload) return null;
      cursor = payload;
    }
    return payload;
  }

  function getPreviewPayload(snapshot, nodeName = mapState.selectedNode) {
    return getNestedPreviewChildMap(snapshot, nodeName);
  }

  function canEnterPreviewNode(nodeName = mapState.selectedNode, snapshot = mapState.snapshot) {
    if (!snapshot || !nodeName) return false;
    const localNodeName = String(nodeName).split('-').pop();
    const availableChildMaps = snapshot.availableChildMaps && typeof snapshot.availableChildMaps === 'object' ? snapshot.availableChildMaps : {};
    const previewChildMaps = snapshot.previewChildMaps && typeof snapshot.previewChildMaps === 'object' ? snapshot.previewChildMaps : {};
    return !!(availableChildMaps[localNodeName] || previewChildMaps[localNodeName]);
  }

  function syncMapStateFromSnapshot(snapshot, options = {}) {
    const { preserveSelection = true, forceLayer = null, initializeLayer = true } = options;
    const previousCurrent = mapState.currentNode;
    const previousSelected = mapState.selectedNode;
    const followCurrentSelection = !mapState.selectedFreePoint && (!previousSelected || previousSelected === previousCurrent);
    mapState.snapshot = snapshot;
    mapState.bounds = snapshot.bounds;
    mapState.items = snapshot.items;
    invalidateMapDerivedCache();
    mapState.itemMap = new Map(snapshot.items.map(item => [item.name, item]));
    mapState.coordSystem = MAP_COORD_SYSTEM_IMAGE;
    mapState.currentMapId = snapshot.currentMapId;
    mapState.mapLevel = snapshot.mapLevel;
    mapState.layerFollowsZoom = shouldMapLayerFollowZoom(snapshot);
    if (forceLayer) {
      mapState.layer = forceLayer;
      mapState.zoom = getDefaultZoomForSnapshot(snapshot, forceLayer);
    } else if (!mapState.hasLoaded && initializeLayer) {
      const initialLayer = inferInitialLayer(snapshot);
      mapState.layer = initialLayer;
      mapState.zoom = getDefaultZoomForSnapshot(snapshot, initialLayer);
    }
    const focusName = toText(snapshot.currentFocusName, snapshot.currentLoc);
    const focusCoordValid = Number.isFinite(snapshot.currentFocusCoord.x) && Number.isFinite(snapshot.currentFocusCoord.y);
    const currentWithinView = snapshot.currentWithinView !== false;
    if (currentWithinView && mapState.itemMap.has(focusName)) {
      mapState.currentNode = focusName;
      mapState.currentFreePoint = null;
    } else if (currentWithinView && focusCoordValid) {
      mapState.currentFreePoint = { x: snapshot.currentFocusCoord.x, y: snapshot.currentFocusCoord.y };
      mapState.currentNode = getNearestVisibleMapNode(mapState.currentFreePoint, mapState.layer);
    } else if (!currentWithinView) {
      mapState.currentNode = '';
      mapState.currentFreePoint = null;
    } else {
      mapState.currentNode = snapshot.items[0] ? snapshot.items[0].name : previousCurrent;
      mapState.currentFreePoint = null;
    }
    if (followCurrentSelection || !preserveSelection || !mapState.itemMap.has(previousSelected)) {
      mapState.selectedNode = mapState.itemMap.has(mapState.currentNode) ? mapState.currentNode : (snapshot.items[0] ? snapshot.items[0].name : previousSelected);
    } else {
      mapState.selectedNode = previousSelected;
    }
    if (!preserveSelection) mapState.selectedFreePoint = null;
  }

  function enterPreviewMode(nodeName = mapState.selectedNode) {
    const payload = getPreviewPayload(mapState.snapshot, nodeName);
    const sourceSnapshot = mapState.baseSnapshot || mapState.snapshot;
    if (!payload || !sourceSnapshot) return false;
    const currentViewState = {
      selectedNode: toText(mapState.selectedNode, ''),
      selectedFreePoint: mapState.selectedFreePoint
        ? { x: toNumber(mapState.selectedFreePoint.x, NaN), y: toNumber(mapState.selectedFreePoint.y, NaN) }
        : null,
      zoom: toNumber(mapState.zoom, DEFAULT_MAP_ZOOM),
      panX: toNumber(mapState.panX, 0),
      panY: toNumber(mapState.panY, 0),
      layer: toText(mapState.layer, inferInitialLayer(mapState.snapshot || sourceSnapshot)),
      currentMapId: toText(mapState.currentMapId, ''),
      exitedNodeName: toText(nodeName, '')
    };
    if (!Array.isArray(mapState.previewViewStack)) mapState.previewViewStack = [];
    mapState.previewViewStack.push(currentViewState);
    mapState.previewTrail = Array.isArray(mapState.previewTrail) ? [...mapState.previewTrail, nodeName] : [nodeName];
    syncPreviewKeyFromTrail();
    mapState.pendingTravelRequest = null;
    const previewSnapshot = buildSnapshotFromMapPayload(payload, sourceSnapshot.rootData, sourceSnapshot.activeName, sourceSnapshot.activeChar);
    syncMapStateFromSnapshot(previewSnapshot, { preserveSelection: false, forceLayer: inferInitialLayer(previewSnapshot), initializeLayer: false });
    mapState.忽略画布点击至 = Date.now() + 420;
    return true;
  }

  function restorePreviewViewState(viewState) {
    if (!viewState || typeof viewState !== 'object') return;
    const desiredNode = toText(viewState.selectedNode || viewState.exitedNodeName, '');
    const desiredLayer = toText(viewState.layer, '');
    if (desiredLayer) mapState.layer = desiredLayer;
    mapState.zoom = clamp(toNumber(viewState.zoom, mapState.zoom), MIN_MAP_ZOOM, MAX_MAP_ZOOM);
    mapState.panX = toNumber(viewState.panX, 0);
    mapState.panY = toNumber(viewState.panY, 0);
    if (viewState.selectedFreePoint
      && Number.isFinite(toNumber(viewState.selectedFreePoint.x, NaN))
      && Number.isFinite(toNumber(viewState.selectedFreePoint.y, NaN))) {
      mapState.selectedFreePoint = {
        x: toNumber(viewState.selectedFreePoint.x, 0),
        y: toNumber(viewState.selectedFreePoint.y, 0)
      };
      mapState.selectedNode = '';
      return;
    }
    mapState.selectedFreePoint = null;
    if (desiredNode && mapState.itemMap && mapState.itemMap.has(desiredNode)) {
      mapState.selectedNode = desiredNode;
      return;
    }
    if (desiredLayer) {
      const resolvedNode = resolveSelectedNodeForLayer(desiredLayer);
      if (resolvedNode) mapState.selectedNode = resolvedNode;
    }
  }

  function exitPreviewMode() {
    if (!hasActivePreview() || !mapState.baseSnapshot) return false;
    const nextTrail = Array.isArray(mapState.previewTrail) ? [...mapState.previewTrail] : [];
    const exitedNodeName = nextTrail.pop() || '';
    const viewState = Array.isArray(mapState.previewViewStack) ? (mapState.previewViewStack.pop() || null) : null;
    mapState.previewTrail = nextTrail;
    syncPreviewKeyFromTrail();
    mapState.pendingTravelRequest = null;
    if (!mapState.previewTrail.length) {
      syncMapStateFromSnapshot(mapState.baseSnapshot, { preserveSelection: false, forceLayer: inferInitialLayer(mapState.baseSnapshot), initializeLayer: false });
      restorePreviewViewState(viewState || { exitedNodeName });
      return true;
    }
    const parentPayload = getPreviewPayloadByTrail(mapState.baseSnapshot, mapState.previewTrail);
    if (!parentPayload) {
      mapState.previewTrail = [];
      syncPreviewKeyFromTrail();
      mapState.previewViewStack = [];
      syncMapStateFromSnapshot(mapState.baseSnapshot, { preserveSelection: false, forceLayer: inferInitialLayer(mapState.baseSnapshot), initializeLayer: false });
      restorePreviewViewState(viewState || { exitedNodeName });
      return true;
    }
    const parentSnapshot = buildSnapshotFromMapPayload(parentPayload, mapState.baseSnapshot.rootData, mapState.baseSnapshot.activeName, mapState.baseSnapshot.activeChar);
    syncMapStateFromSnapshot(parentSnapshot, { preserveSelection: false, forceLayer: inferInitialLayer(parentSnapshot), initializeLayer: false });
    restorePreviewViewState(viewState || { exitedNodeName });
    return true;
  }

  function injectStyle() {
    if (document.getElementById('sheep-map-restore-style')) return;
    const style = document.createElement('style');
    style.id = 'sheep-map-restore-style';
    style.textContent = styleText;
    document.head.appendChild(style);
  }

  function ensurePageMapMarkup() {
    const pageMap = document.getElementById('page-map');
    if (!pageMap) return false;
    if (!pageMap.querySelector('.map-layout')) {
      pageMap.innerHTML = mapHtml;
      invalidateMapUiRefCache();
    }
    return true;
  }

  function refreshSplitMapPages() {
    const layoutSource = document.querySelector('#page-map .map-layout');
    const leftSource = document.querySelector('#page-map .map-layout > .map-hero-card');
    const rightSource = document.querySelector('#page-map .map-layout > .map-side-stack');
    let shellMutated = false;

    function resetMapBindingFlags(root) {
      if (!root || !(root instanceof Element)) return root;
      if (root.dataset) {
        delete root.dataset.mapBound;
        delete root.dataset.mapMiniBound;
      }
      root.querySelectorAll('[data-map-bound], [data-map-mini-bound], .map-canvas.interactive-map, .map-mini-world, [data-map-node-layer], [data-map-control], [data-map-action-select], [data-map-duration-text], [data-map-training-select], [data-map-action-execute], [data-map-node-action], [data-map-maintenance], [data-map-npc-select], [data-map-travel-cycle], [data-map-layer-pill]').forEach(el => {
        if (el.dataset) {
          delete el.dataset.mapBound;
          delete el.dataset.mapMiniBound;
        }
      });
      return root;
    }

    function hasHydratedLeftMap(page) {
      if (!page) return false;
      return !!page.querySelector('.map-canvas.interactive-map [data-map-node-layer]');
    }

    function hasHydratedRightMap(page) {
      if (!page) return false;
      return !!page.querySelector('.map-side-stack [data-map-current-name]');
    }

    function hydrateMapShell(page, source, isReady) {
      if (!page || !source) return false;
      if (isReady(page)) return false;
      page.innerHTML = '';
      page.appendChild(resetMapBindingFlags(source.cloneNode(true)));
      return true;
    }

    function hasHydratedMapStage(stage) {
      if (!stage) return false;
      return !!stage.querySelector('.map-layout .map-canvas.interactive-map [data-map-node-layer]');
    }

    function hydrateMapStage(stage, source) {
      if (!stage || !source) return false;
      if (hasHydratedMapStage(stage)) return false;
      stage.innerHTML = '';
      stage.appendChild(resetMapBindingFlags(source.cloneNode(true)));
      return true;
    }

    document.querySelectorAll(`.split-left-page[data-target='page-map']`).forEach(page => {
      shellMutated = hydrateMapShell(page, leftSource, hasHydratedLeftMap) || shellMutated;
    });
    document.querySelectorAll(`.split-right-page[data-target='page-map']`).forEach(page => {
      shellMutated = hydrateMapShell(page, rightSource, hasHydratedRightMap) || shellMutated;
    });
    document.querySelectorAll('[data-mvu-map-stage]').forEach(stage => {
      shellMutated = hydrateMapStage(stage, layoutSource) || shellMutated;
    });
    if (shellMutated) invalidateMapUiRefCache();
  }

  function bindTabResync() {
    document.querySelectorAll(`.mvu-tab-btn[data-target='page-map']`).forEach(btn => {
      if (btn.dataset.sheepMapBound === '1') return;
      btn.dataset.sheepMapBound = '1';
      注册地图元素事件(btn, 'sheepMapBound', 'click', () => {
        setTimeout(() => syncInteractiveMapUI({ center: true }), 30);
        setTimeout(() => syncInteractiveMapUI({ center: false }), 120);
      });
    });
  }

  function resyncMapShell(options = {}) {
    const { center = false, syncVisual = true } = options || {};
    ensurePageMapMarkup();
    refreshSplitMapPages();
    bindTabResync();
    if (syncVisual) scheduleSync(center);
  }

  try {
    window.__sheepMapResync = resyncMapShell;
    window.__sheepMapRefreshLive = (preserveSelection = true) => refreshLiveMap(preserveSelection);
  } catch (_) {}

  function projectCoord(coord) {
    const 边界 = sanitizeBounds(mapState.bounds || DEFAULT_IMAGE_BOUNDS);
    return {
      left: clamp((toNumber(coord && coord.x, 边界.minX) - 边界.minX) / Math.max(1, 边界.width), 0, 1),
      top: clamp((toNumber(coord && coord.y, 边界.minY) - 边界.minY) / Math.max(1, 边界.height), 0, 1)
    };
  }

  function 计算地图视觉距离(起点, 终点) {
    if (!起点 || !终点) return 0;
    const 边界 = sanitizeBounds(mapState.bounds || DEFAULT_IMAGE_BOUNDS);
    const 起点比例 = projectCoord(起点);
    const 终点比例 = projectCoord(终点);
    const 横向距离 = (起点比例.left - 终点比例.left) * 边界.width;
    const 纵向距离 = (起点比例.top - 终点比例.top) * 边界.width;
    return Math.hypot(横向距离, 纵向距离);
  }

  function convertMapCoordToLocalPoint(coord, canvasEl) {
    if (!canvasEl || !coord || !canvasEl.clientWidth || !canvasEl.clientHeight) return null;
    const ratio = projectCoord(coord);
    return {
      left: ratio.left,
      top: ratio.top,
      x: ratio.left * canvasEl.clientWidth,
      y: ratio.top * canvasEl.clientHeight
    };
  }

  function convertMapLocalPointToCanvasRatio(localX, localY, canvasEl) {
    if (!canvasEl || !canvasEl.clientWidth || !canvasEl.clientHeight) return { left: 0, top: 0 };
    const renderZoom = getMapRenderZoom();
    const cx = canvasEl.clientWidth / 2;
    const cy = canvasEl.clientHeight / 2;
    const worldX = cx + (localX - cx - mapState.panX) / renderZoom;
    const worldY = cy + (localY - cy - mapState.panY) / renderZoom;
    return {
      left: clamp(worldX / canvasEl.clientWidth, 0, 1),
      top: clamp(worldY / canvasEl.clientHeight, 0, 1)
    };
  }

  function convertMapLocalPointToCoord(localX, localY, canvasEl) {
    if (!canvasEl || !canvasEl.clientWidth || !canvasEl.clientHeight) return { x: 0, y: 0 };
    const ratio = convertMapLocalPointToCanvasRatio(localX, localY, canvasEl);
    return getCoordFromMapRatio(ratio.left, ratio.top);
  }

  function getRenderableItems(layer = mapState.layer) {
    const safeLayer = toText(layer, mapState.layer || 'continent');
    const cached = mapDerivedCache.renderableItems.get(safeLayer);
    if (Array.isArray(cached)) return cached;
    const items = mapState.items.filter(item => item && item.validCoord);
    if (!items.length) return [];
    let filtered = items;
    if (safeLayer === 'continent') {
      filtered = items.filter(item => item.pointKind === 'settlement' || item.pointKind === 'terrain' || item.source === 'dynamic' || item.major || item.canEnter);
    } else if (safeLayer === 'city') {
      filtered = items.filter(item => item.source === 'dynamic' || item.major || item.canEnter || item.pointKind === 'terrain');
    }
    const result = filtered.length ? filtered : items;
    mapDerivedCache.renderableItems.set(safeLayer, result);
    return result;
  }

  function getItemByName(name) {
    return mapState.itemMap.get(name) || null;
  }

  function getMapNodeCoord(name) {
    const item = getItemByName(name);
    if (item && item.validCoord) return { x: item.x, y: item.y };
    const focus = mapState.snapshot && mapState.snapshot.currentFocusCoord;
    if (focus && Number.isFinite(focus.x) && Number.isFinite(focus.y)) return { x: focus.x, y: focus.y };
    return getDefaultMapCoordCenter();
  }

  function 推导动态地点坐标(父节点名 = '', options = {}) {
    const 父名 = toText(父节点名, '').replace(/^斗罗大陆-/, '').replace(/^斗灵大陆-/, '').trim();
    if (!父名) return { ok: false, reason: '缺少父节点。' };
    const 快照 = mapState.baseSnapshot || mapState.snapshot || buildFallbackSnapshot();
    const rootData = 快照 && 快照.rootData ? 快照.rootData : {};
    const 父项 = getItemByName(父名);
    const 静态父数据 = deepGet(rootData, ['world', '地点', 父名], null);
    const 动态父数据 = deepGet(rootData, ['world', '动态地点', 父名], null);
    const 父数据 = 静态父数据 || 动态父数据 || null;
    const 父坐标 = 父项 && 父项.validCoord
      ? { x: 父项.x, y: 父项.y }
      : (父数据 && Number.isFinite(toNumber(父数据.x, NaN)) && Number.isFinite(toNumber(父数据.y, NaN))
        ? { x: toNumber(父数据.x, 0), y: toNumber(父数据.y, 0) }
        : null);
    const 同级坐标 = safeEntries(deepGet(rootData, 'world.动态地点', {}))
      .filter(([, item]) => item && typeof item === 'object' && toText(item.归属父节点, '') === 父名)
      .map(([, item]) => ({ x: toNumber(item.x, NaN), y: toNumber(item.y, NaN) }))
      .filter(coord => Number.isFinite(coord.x) && Number.isFinite(coord.y) && coord.x >= 0 && coord.y >= 0);
    const 基准 = 父坐标 || 同级坐标[同级坐标.length - 1] || null;
    if (!基准) return { ok: false, reason: '父节点缺少可用坐标。' };

    const 方位 = toText(options && options.direction, '');
    const 向量 = {
      x: /东/.test(方位) ? 1 : (/西/.test(方位) ? -1 : 0),
      y: /南/.test(方位) ? 1 : (/北/.test(方位) ? -1 : 0),
    };
    if (!向量.x && !向量.y) {
      向量.x = 1;
      向量.y = 1;
    }
    const tick = Math.max(0.1, toNumber(options && options.ticks, 1));
    const 方式 = toText(options && options.method, '步行');
    const 方式倍率 = /飞行|传送/.test(方式) ? 1.5 : (/车|列车|船|巨轮/.test(方式) ? 1.2 : 1);
    const 步长 = clamp(Math.round((14 + tick * 4) * 方式倍率), 12, 72);
    const 偏移序号 = 同级坐标.length + 1;
    let x = roundCoord(基准.x + 向量.x * 步长 + (偏移序号 % 3) * 8);
    let y = roundCoord(基准.y + 向量.y * 步长 + Math.floor(偏移序号 / 3) * 8);
    const 已占用 = new Set(同级坐标.map(coord => `${roundCoord(coord.x)},${roundCoord(coord.y)}`));
    while (已占用.has(`${x},${y}`)) {
      x += 10;
      y += 7;
    }
    return { ok: true, x, y, source: 父坐标 ? 'parent_coord' : 'sibling_coord' };
  }

  function getActualCurrentSnapshot() {
    return hasActivePreview() && mapState.baseSnapshot ? mapState.baseSnapshot : mapState.snapshot;
  }

  function getRawActualCurrentLoc() {
    const snapshot = getActualCurrentSnapshot() || {};
    return toText(
      deepGet(snapshot, 'activeChar.状态.位置', snapshot.currentLocFull || snapshot.currentLoc),
      toText(snapshot.currentLocFull || snapshot.currentLoc, '斗罗大陆-未知地点')
    );
  }

  function getActualCurrentLoc() {
    let loc = getRawActualCurrentLoc();
    // 前端显示时，默认剥离掉大模型强制写的最高级前缀，保持 UI 清爽
    return loc.replace(/^斗罗大陆-/, '').replace(/^斗灵大陆-/, '');
  }

  function getActualCurrentCoord() {
    const snapshot = getActualCurrentSnapshot();
    if (!snapshot) return null;
    const sd = snapshot.rootData || {};
    const charStatus = deepGet(snapshot, 'activeChar.状态') || {};
    const actualLocName = getActualCurrentLoc();
    const 角色横坐标 = Number.isFinite(toNumber(charStatus.current_x, NaN)) ? toNumber(charStatus.current_x, NaN) : toNumber(charStatus.横坐标, NaN);
    const 角色纵坐标 = Number.isFinite(toNumber(charStatus.current_y, NaN)) ? toNumber(charStatus.current_y, NaN) : toNumber(charStatus.纵坐标, NaN);
    const 角色坐标有效 = Number.isFinite(角色横坐标) && 角色横坐标 >= 0 && Number.isFinite(角色纵坐标) && 角色纵坐标 >= 0;

    const pathSegments = actualLocName.split('-').filter(Boolean);
    if (!pathSegments.length) return 角色坐标有效 ? { x: 角色横坐标, y: 角色纵坐标 } : null;

    const 查找地图节点坐标 = targetName => {
      if (!targetName) return null;
      if (Array.isArray(snapshot.items)) {
        const found = snapshot.items.find(item => item.name === targetName || item.name.includes(targetName));
        if (found && Number.isFinite(found.x) && Number.isFinite(found.y)) return { x: found.x, y: found.y };
      }
      const staticLocs = deepGet(sd, 'world.地点', {});
      for (const locKey in staticLocs) {
        const locData = staticLocs[locKey];
        if (!locData) continue;
        if (locKey === targetName || locData.name === targetName) {
          if (Number.isFinite(locData.x) && Number.isFinite(locData.y)) return { x: locData.x, y: locData.y };
        }
        const 子节点 = (locData && locData['子节点'] && typeof locData['子节点'] === 'object')
          ? locData['子节点']
          : (locData && locData.children && typeof locData.children === 'object' ? locData.children : null);
        if (子节点) {
          for (const childKey in 子节点) {
            const child = 子节点[childKey];
            if (childKey === targetName || (child && child.name === targetName)) {
              if (Number.isFinite(child.x) && Number.isFinite(child.y)) return { x: child.x, y: child.y };
            }
          }
        }
      }
      const dynLoc = deepGet(sd, ['world', '动态地点', targetName]);
      if (dynLoc && Number.isFinite(dynLoc.x) && Number.isFinite(dynLoc.y) && dynLoc.x >= 0 && dynLoc.y >= 0) {
        return { x: dynLoc.x, y: dynLoc.y };
      }
      return null;
    };

    const 叶子坐标 = 查找地图节点坐标(pathSegments[pathSegments.length - 1]);
    if (叶子坐标) return 叶子坐标;

    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const targetName = pathSegments[i];
      const 节点坐标 = 查找地图节点坐标(targetName);
      if (节点坐标) return 节点坐标;
    }

    return 角色坐标有效 ? { x: 角色横坐标, y: 角色纵坐标 } : null;
  }

  function isPreviewCurrentBranch() {
    if (!hasActivePreview()) return true;
    const trail = Array.isArray(mapState.previewTrail) ? mapState.previewTrail.filter(Boolean) : [];
    if (!trail.length) return false;
    const actualLoc = getActualCurrentLoc();
    const actualSegments = String(actualLoc || '').split('-').map(item => toText(item, '').trim()).filter(Boolean);
    const trailSegments = [];
    trail.forEach(item => {
      String(item || '').split('-').map(seg => toText(seg, '').trim()).filter(Boolean).forEach(seg => trailSegments.push(seg));
    });
    if (!actualSegments.length || !trailSegments.length) return false;
    const anchor = trailSegments[0];
    const actualLeaf = actualSegments[actualSegments.length - 1];
    if (anchor && actualSegments.includes(anchor)) return true;
    if (actualLeaf && trailSegments.includes(actualLeaf)) return true;
    return trailSegments.every(seg => actualSegments.includes(seg));
  }

  function resolvePreviewTravelTargetLoc(targetLoc = '', options = {}) {
    const { isFree = false } = options || {};
    const rawActualLoc = getRawActualCurrentLoc();
    const worldPrefix = rawActualLoc.startsWith('斗灵大陆-') ? '斗灵大陆' : '斗罗大陆';
    const actualLoc = rawActualLoc.replace(/^斗罗大陆-/, '').replace(/^斗灵大陆-/, '');
    const actualSegments = actualLoc.split('-').map(seg => toText(seg, '').trim()).filter(Boolean);
    const trailSegments = [];
    (Array.isArray(mapState.previewTrail) ? mapState.previewTrail : []).forEach(item => {
      String(item || '').split('-').map(seg => toText(seg, '').trim()).filter(Boolean).forEach(seg => trailSegments.push(seg));
    });
    const normalizedTarget = toText(targetLoc, '').replace(/^斗罗大陆-/, '').replace(/^斗灵大陆-/, '');
    const targetSegments = normalizedTarget ? normalizedTarget.split('-').filter(Boolean) : [];
    if (!trailSegments.length) {
      if (normalizedTarget) return `${worldPrefix}-${normalizedTarget}`;
      return rawActualLoc || `${worldPrefix}-未知地点`;
    }
    const anchorIndex = actualSegments.indexOf(trailSegments[0]);
    const prefixSegments = anchorIndex >= 0 ? actualSegments.slice(0, anchorIndex) : [];
    const baseSegments = [...prefixSegments, ...trailSegments];
    if (isFree) return `${worldPrefix}-${(actualSegments.length ? actualSegments : baseSegments).join('-')}`;
    while (targetSegments.length && baseSegments.includes(targetSegments[0])) targetSegments.shift();
    const resolvedSegments = [...baseSegments, ...targetSegments];
    return resolvedSegments.length ? `${worldPrefix}-${resolvedSegments.join('-')}` : (rawActualLoc || `${worldPrefix}-未知地点`);
  }

  function getCurrentCoord() {
    const actualCoord = getActualCurrentCoord();
    if (actualCoord) return { x: actualCoord.x, y: actualCoord.y };
    return null; // 绝不再回退到 0,0 或者强制取焦点坐标
  }

  function 同步地图结算补丁到本地快照(patchOps = []) {
    const 补丁列表 = Array.isArray(patchOps) ? patchOps : [];
    if (!补丁列表.length || !mapState.baseSnapshot || !mapState.baseSnapshot.rootData) return false;
    let 已变更 = false;
    补丁列表.forEach(patch => {
      if (!patch || !['replace', 'add', 'insert'].includes(toText(patch.op, ''))) return;
      const 路径 = 解码地图JsonPointer路径(patch.path);
      if (!路径.length) return;
      已变更 = 写入地图对象路径值(mapState.baseSnapshot.rootData, 路径, patch.value) || 已变更;
    });
    if (!已变更) return false;
    const nextBaseSnapshot = buildMapSnapshot(mapState.baseSnapshot.rootData);
    mapState.baseSnapshot = nextBaseSnapshot;
    let nextSnapshot = nextBaseSnapshot;
    if (Array.isArray(mapState.previewTrail) && mapState.previewTrail.length) {
      const previewPayload = getPreviewPayloadByTrail(nextBaseSnapshot, mapState.previewTrail);
      if (previewPayload) {
        nextSnapshot = buildSnapshotFromMapPayload(previewPayload, nextBaseSnapshot.rootData, nextBaseSnapshot.activeName, nextBaseSnapshot.activeChar, {
          charactersByLoc: nextBaseSnapshot.charactersByLoc,
          characterDigest: nextBaseSnapshot.characterDigest
        });
      }
    }
    syncMapStateFromSnapshot(nextSnapshot, { preserveSelection: true, initializeLayer: false });
    window.__sheepMapSnapshot = nextSnapshot;
    return true;
  }

  function getSelectedCoord() {
    if (mapState.selectedFreePoint) return { x: mapState.selectedFreePoint.x, y: mapState.selectedFreePoint.y };
    if (mapState.selectedNode) return getMapNodeCoord(mapState.selectedNode);
    return getCurrentCoord();
  }


  const MAIN_MAP_TERRAIN_GRID_V1 = {
    map_id: 'map_douluo_world',
    version: 'terrain-grid-96x68-firstpass-001',
    source: '基于 MAP.jpeg 颜色格网提取的世界地图首轮粗地形。',
    bounds: { min_x: 0, min_y: 0, width: 3174, height: 2246 },
    gridWidth: 96,
    gridHeight: 68,
    rows: [
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWPPPPPPPPPPPPPPPPPPPPPPXWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWPPPPPPPPPPPPPPPPPPPPPPWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWPPPPPPPPPPPPPPHPPPPPPPPWWWMXWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWXPPPPPPPPPPPPPPPXXXPPHPPXWWWMHWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWPPPPPPPPPPPPHPPMMMPPPHPPXWWXHXXWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWXWWHXMXHXWXWWWWWWWWWXMPPPPXPPPPPPPPPPXXPMXPMXMHXWHHXHWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWHHHHMHHHHHMWWWWWWWXMHHXXXPPPPPPPPPPPPHPXXPPXXPHHHHPHMWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWPPPPPPPWWWHWWWXPHPHHHHHPPHHXWWWMMXMHPPXXMMMMPPPPPPPPPPPPHXPXPXXXHPPPPHHWWWWWWWWWWWW",
      "WWWWWWWWWWWWPPPPPPPPPWWPPWPPPPPPHHHPPPPXWWWWHHMHPPXXXXMPXPPXPPHHPPPPPPHPXPPPPPPPPPHHWWWWWWWWWWWW",
      "WWWWWWWWWWWPPPPPPPPPPPPPPPPPPPPPPHHPPXPMWWWXHHHHPPPMPMMPXXPPPHHHHPPPPPPPMXHPPPPPXPHHWWWWWWWWWWWW",
      "WWWWWWWWWWPPPPPPPPPPPPPPPPPPPPPPPPPPPHXHXXXWHHHPPPPPMXPPPXHHHHHHHMXPPPXHHMXHXPXHXPPHWWWWWWWWWWWW",
      "WWWWWWWWWWPPPPPPPPXMPPPPPPPPPXPPPPPPXXPXPPXXHHPPPPPXXPPXXMHHHHMHHHPPPPPXMPXHXXXPMMPHXMWWWWWWWWWW",
      "WWWWWWWWWWPPPPPPPHHMPPPPHPPPXHMMHHPXPPXXPPXXPHPHPPPPMPXPPPHHHHHHHHHPPXPHMPMHPXPPXMMPHHWWWWWWWWWW",
      "WWWWWWWWWWPPPPPPMXHXPPPPPHPPPXXMMHXXMHPMMMPPPPPPPPPPPXHHXPHHHPHHHPPPPHXHMPMHXXPXPMPPHHMWWWWWWWWW",
      "WWWWWWWWWWPPPPPPMHMXPPPPPPPPXMXMHHMXHHPPPHMPPPPPPPPPPPPPPPPHHPHPPPPPPXMXXMXMHPPXXPXPPHMWWWWWWWWW",
      "WWWWWWWWWWPPPPPPXXMPPPPPPPPPPMHXHMMXHHXXPMPMPPPPPPPPPPPPPPPPPPPPPPPHPHHPXHMMPXPPPPPPPHMXWWWWWWWW",
      "WWWWWWWWWWPPPPPPPPPPPPPPPXMHPMHMXMHHHHPPPMXMPPPPPPPPPPPPPPPPPPPPPPHHHPPMXPHPHXXHXPPPHHMWWWWWWWWW",
      "WWWWWWWWWWXPPPPPPPPPPPPPPHPXXMMMHHHXXPPPXMMPHPPPPHPHHHHPPPPPPXPHPMMHMHHHHPXXPXPHHPPPHHWWWWWWWWWW",
      "WWWWWWWWWWXHPPPPPPPHHPHPPPHPPXXHPPHPPPPPPMXPMHPPHHHHHHPPPPPPHHPPHMHXPPPPPPHPPPPPPPPPPHWWWWWWWWWW",
      "WWWWWWWWWWXHHHHHPPPHHHHHPPXPPPXPPPHPPPPPPXMMXHPPHHHHHHHPPHXPXPPPPMPXMXPPPPPPPPXPPXPPPHWWWWWWWWWW",
      "WWWWWWWWWWWHHHHHPPPPHHHHPPHMHMPPPPHPPPPPXXXHXMPPHHHHHHHHPPXMXPPHXHXHXPPPPPPPPPPXXXPPPHWWWWWWWWWW",
      "WWWWWWWWWWWHMHHHPPPPPHHHPPPPPPPPPPMPPPPMXXXPPMPPHHHHHHHHPPHPPHMXPMXXHMMHPPPPPPPXXXPPPXWWWWWWWWWW",
      "WWWWWWWWWWWWMWHHPPPHPPHPPPPPPPPPPHMPPPPXXHXXXXPPPHHHHHXXPPXPPMMXXMXPXXXHPPPPPPXPMPPPPXWWWWWWWWWW",
      "WWWWWWWWWWWWWWHHPPPHMPPPPPHPPHHPPHXHPPPXHXMXXPPPPHHHHPHHXPXMMMMMMMXPXXPMPPPPPXPPPXPPPPWWWWWWWWWW",
      "WWWWWWWWWWWWWWHHHPPPXHPXPPMPPPHHXXXMHPPPPXPXXXPPPHHHPPXMXPXXMMMMMMXHXXMHHXPPPPPPPPHPPHWWWWWWWWWW",
      "WWWWWWWWWWWWWWMHHPPXMXMMXMXMXPPXPHXXPXPPPPXXXXPPPPHPPPPHXMPPMMMMMMHPXXMMHHPPPPMPXPPPHHHWWWWWWWWW",
      "WWWWWWWWWWWWWWWWHPPMMMMMMMXXXMXXXPPPXXHPPPHMXMXPPPPPPPHPHPPXMMMMMXPMPHPMPPPXHHPPPPHHHHWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWHHPHXMMMHMXMXMMMMPXXMPMXHMHMPPMPPPPPPHPPPPPPMMMMMPXXPPHXPHMHXXPPPPHHHWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWXHPPMMMMMMMXPXXMPPPXMPPXHPPXPXXMXHPPPMPPPPPPPXXPPPHPPPHPPPPPPPPPPPHHWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWHPPPHPMMPXHMMXMHMPHXHPHXPXXXMXMHPPXHHPPXPPHPPPXXHHPPPXPPXXPPPPPPPPHWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWXPPPPHMHPPPMXHMPMXHPHMHPPPMMMXXHPPHHXPPPPXXPXPHMHPXPPHHHXHPPPPPPHHHWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWXPPPPPPPXXXXXPMHHPXPPMHMMMPXXXXXMPMXXHPHPXXXMPPMHPXPXHHPHXPPPHHHHHWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWXHHPPPXHPPPPPPPPPPPPHHXMHXPXXXXMMXXXPXHMPPMHPPPPPPXHMPPPHHPPHHHHHXWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWHHPPPXXMXPPPPPPHXHPXPMPPHPXXXMMMHHPHXPPPPHPPPPPPPPHXXHPMXMPHHHHHWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWHHHPPHPPXPPPPPPXXXPPMMHPPXXPPPXPXHPPXPPPPPPPPPPPPPPHXMHPPXPHHHHWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWHHHPPPMPPXMXXMXMHMHXXXPPPPPPHHHHPPPPPPPPPPPPPPPPPPPPHMMHPPPHHHWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWXHHHHPPPXPXXMMXMMXXMPPPPPPHHHHHXHHHPPPPPPHPPPPPPPPPPPPHPXPPHHMWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWXHHHHPPPPPPPXXPHPPPPPPPHHXMHHWWHMHHHHHHHHPPPPHHHPPPPPPPPPPHHMWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWMMMHPPPPPPPPPPPPPPPHPHHXXWPWWWXXXHHHHHHHHHPHHHHHHPPPPPPWPHXWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWMMMHHXHHPPPPPHPPPHHHHWWWWWWWWWWWWHHHHHHHHHHHHHHHHHHHXWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWMMMHHPHHPPPPPPPXXXWWWWWWWWWWWWWWWXWHHHHHHHHHHHHMHHHWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWMMHHHHHHPHWPPPWWWWWWWWWWWWWWWWWWWWXHMMMMHHHHHMHXHWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWMMHHHHHHWWXPWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWMMXHXHHXWWWXWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMXMXXWMMXMXXWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMHHHHHHMMMMMMWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWMMMMMMMMMWWWWWWWWWWWWWWWWWWWWWWWWWXXXMHHHHMPPHHMMMMMXWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWHMHMHMHHHMWWWWWWWWWWWWWWWWWWWWWWWWWHHHPHHHXPPXXHHMMWXWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWMMHMHHHHHHXWWWWWWWWWWWWWWWWWWWWWWWHHPPPMPMXPMMPHHMWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWMHHMHHPPPHHMXWWWWWWWWWWWWWWWWWWWWMHPHXXXXPPMPXHHXWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWXHHXXPPPPPHHMWWWWWWWWWWWWWWWWWWWWMPPPXMHPXPXXXHHWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWHHMMPPHXPPPHHMWWWWWWWWWWWWWWWWWXMHPPXPXPXHHMPPHWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWXHPXHPPMXPPPHHXWWWWWWWWWWWWWWWWXMHPPPPPPXPPPPHXWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWHHPPMPXMXMXPPHHWWWWWWWWWWWWWWWWMHPPMPPPPHXPPHWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWHHPXXXXMXMXPPHHXWWWWWWWWWWWWWWWXHPPMPPPPPPHHWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWHPPPPPPXPXHPPHHXWWWWWWWWWWWWWWWWHPPPMPPXPPHWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWHPMPPXXPPXPPHHHXWWWWWWWWWWWWWWWXPPPMPPXPPHWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWHHPXXMPMMPPXPHHHWWWWWWWWWWWWWWWWWHPPXXPPPPWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWHHPPPPPPMXMXPHHHXWWWWWWWWWWWWWWWWWHPPPPPPWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWXHPPPHPPPPXXHHHHWWWWWWWWWWWWWWWWWWWHHPHHWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWHHHHHHPPPPHHHHXWWWWWWWWWWWWWWWWWWWWHHXWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWXXXXWXHXXHHXXHWWWWWWWWWWWWWWWWWWWWWHXWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
    ]
  };

  const MAIN_MAP_TERRAIN_GRID_CODE_INFO = {
    W: { gridTerrain: 'water', name: '水域', terrainTypes: ['海域'], climate: '海洋性', movementDifficulty: 3, resources: ['渔产'] },
    P: { gridTerrain: 'plain', name: '平原', terrainTypes: ['平原'], climate: '温和', movementDifficulty: 1, resources: ['耕地'] },
    H: { gridTerrain: 'hill', name: '丘陵', terrainTypes: ['缓丘', '丘陵'], climate: '温和', movementDifficulty: 2, resources: ['林木', '矿脉'] },
    M: { gridTerrain: 'mountain', name: '山地', terrainTypes: ['山地', '高地'], climate: '山地冷凉', movementDifficulty: 4, resources: ['矿脉', '岩材'] },
    X: { gridTerrain: 'mixed', name: '过渡地带', terrainTypes: ['过渡地带'], climate: '过渡带', movementDifficulty: 2, resources: [] }
  };

  function getMainMapTerrainGridData(mapId = 'map_douluo_world') {
    return toText(mapId, 'map_douluo_world') === MAIN_MAP_TERRAIN_GRID_V1.map_id ? MAIN_MAP_TERRAIN_GRID_V1 : null;
  }

  function resolveMainMapTerrainGridInfo(coord, mapId = 'map_douluo_world') {
    const safeMapId = toText(mapId, 'map_douluo_world');
    const gridData = getMainMapTerrainGridData(safeMapId);
    const x = toNumber(coord && coord.x, NaN);
    const y = toNumber(coord && coord.y, NaN);
    if (!gridData || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    let relX = NaN;
    let relY = NaN;
    if (safeMapId === 'map_douluo_world') {
      relX = x / Math.max(1, WORLD_IMAGE_WIDTH - 1);
      relY = y / Math.max(1, WORLD_IMAGE_HEIGHT - 1);
    } else {
      const bounds = gridData.bounds || { min_x: 0, min_y: 0, width: WORLD_IMAGE_WIDTH, height: WORLD_IMAGE_HEIGHT };
      relX = (x - toNumber(bounds.min_x, 0)) / Math.max(1, toNumber(bounds.width, 1));
      relY = (y - toNumber(bounds.min_y, 0)) / Math.max(1, toNumber(bounds.height, 1));
    }
    if (!Number.isFinite(relX) || !Number.isFinite(relY) || relX < -0.05 || relY < -0.05 || relX > 1.05 || relY > 1.05) return null;
    const clampedRelX = clamp(relX, 0, 0.999999);
    const clampedRelY = clamp(relY, 0, 0.999999);
    const gx = Math.min(gridData.gridWidth - 1, Math.max(0, Math.floor(clampedRelX * gridData.gridWidth)));
    const gy = Math.min(gridData.gridHeight - 1, Math.max(0, Math.floor(clampedRelY * gridData.gridHeight)));
    const row = Array.isArray(gridData.rows) ? toText(gridData.rows[gy], '') : '';
    const code = toText(row.charAt(gx), 'X') || 'X';
    const meta = MAIN_MAP_TERRAIN_GRID_CODE_INFO[code] || MAIN_MAP_TERRAIN_GRID_CODE_INFO.X;
    return {
      id: `grid_${meta.gridTerrain}_${gx}_${gy}`,
      name: toText(meta.name, '未知地形'),
      terrainTypes: Array.isArray(meta.terrainTypes) ? meta.terrainTypes.slice() : [],
      climate: toText(meta.climate, ''),
      movementDifficulty: toNumber(meta.movementDifficulty, NaN),
      resources: Array.isArray(meta.resources) ? meta.resources.slice() : [],
      overlapNames: [],
      mapId: safeMapId,
      gridX: gx,
      gridY: gy,
      gridCode: code,
      ratioLeft: clampedRelX,
      ratioTop: clampedRelY,
      gridTerrain: meta.gridTerrain,
      source: 'grid'
    };
  }

  const MAIN_MAP_TERRAIN_DATA = {
    map_id: 'map_douluo_world',
    version: 'terrain-remap-002',
    coordinate_system: 'sd.world.maps.map_douluo_world.bounds absolute x/y',
    source: '根据当前 MAP.jpeg 主地图底图重新人工提取的前端地形分区，采用海域底层 + 大陆底层 + 高优先级地貌覆盖。',
    bounds: { min_x: 0, min_y: 0, width: 3174, height: 2246 },
    note: '优先保证点击地形与底图视觉一致；通过 priority 控制重叠区命中顺序，高优先级区域覆盖低优先级底层。',
    regions: {
      north_frigid_sea: {
        name: '北境寒海',
        priority: 1,
        terrain_types: ['海域', '寒海'],
        climate: '寒冷海洋性',
        movement_difficulty: 3,
        resources: ['渔产', '寒流海盐'],
        hazards: ['寒流', '海雾', '风浪'],
        strategic_tags: ['北向海路', '寒潮带'],
        desc: '主大陆北侧外海，海温较低，风浪与寒流都较明显。',
        shape: {
          type: 'polygon',
          points: [
            { x: 0, y: 0 },
            { x: 1400, y: 0 },
            { x: 1400, y: 220 },
            { x: 0, y: 220 }
          ]
        }
      },
      western_outer_sea: {
        name: '西部外海',
        priority: 1,
        terrain_types: ['海域', '外海'],
        climate: '温凉海洋性',
        movement_difficulty: 3,
        resources: ['渔产', '海盐'],
        hazards: ['侧风', '洋流', '风暴'],
        strategic_tags: ['西岸航线', '外海缓冲'],
        desc: '主大陆西侧广阔海域，连接西岸与外海岛屿。',
        shape: {
          type: 'polygon',
          points: [
            { x: 0, y: 0 },
            { x: 220, y: 0 },
            { x: 260, y: 1320 },
            { x: 0, y: 1320 }
          ]
        }
      },
      eastern_outer_sea: {
        name: '东部外海',
        priority: 1,
        terrain_types: ['海域', '外海'],
        climate: '温暖海洋性',
        movement_difficulty: 3,
        resources: ['渔产', '盐', '海贸航线'],
        hazards: ['风暴', '海雾'],
        strategic_tags: ['东岸航线', '入海口航运'],
        desc: '主大陆东侧外海，与东北入海河道和东南海岸相接。',
        shape: {
          type: 'polygon',
          points: [
            { x: 1160, y: 0 },
            { x: 1400, y: 0 },
            { x: 1400, y: 1320 },
            { x: 1100, y: 1320 }
          ]
        }
      },
      southern_inner_sea: {
        name: '南部海峡',
        priority: 1,
        terrain_types: ['海域', '内海', '海峡'],
        climate: '温暖海洋性',
        movement_difficulty: 2,
        resources: ['渔产', '航运通道'],
        hazards: ['海流', '雾带'],
        strategic_tags: ['岛链航道', '南部通航'],
        desc: '主大陆与南部两座岛屿之间的海峡与内海带。',
        shape: {
          type: 'polygon',
          points: [
            { x: 240, y: 1030 },
            { x: 1120, y: 1030 },
            { x: 1120, y: 1580 },
            { x: 240, y: 1580 }
          ]
        }
      },
      southern_far_sea: {
        name: '南方外洋',
        priority: 1,
        terrain_types: ['海域', '外洋'],
        climate: '温暖海洋性',
        movement_difficulty: 3,
        resources: ['渔场', '深海航道'],
        hazards: ['深海风暴', '远航补给压力'],
        strategic_tags: ['远洋', '外海岛链'],
        desc: '地图南缘更深处的外洋区域。',
        shape: {
          type: 'polygon',
          points: [
            { x: 0, y: 1500 },
            { x: 1400, y: 1500 },
            { x: 1400, y: 2246 },
            { x: 0, y: 2246 }
          ]
        }
      },
      mainland_general_terrain: {
        name: '大陆腹地',
        priority: 10,
        terrain_types: ['平原', '缓丘'],
        climate: '温和',
        movement_difficulty: 2,
        resources: ['耕地', '牧地', '常规药草'],
        hazards: ['视野开阔，缺少掩护'],
        strategic_tags: ['通行基底', '默认陆域'],
        desc: '主大陆的基础陆域层，用于兜住未被更细地貌覆盖的普通平原和缓丘。',
        shape: {
          type: 'polygon',
          points: [
            { x: 70, y: 160 },
            { x: 200, y: 70 },
            { x: 1040, y: 70 },
            { x: 1260, y: 120 },
            { x: 1360, y: 260 },
            { x: 1360, y: 900 },
            { x: 1260, y: 1050 },
            { x: 980, y: 1140 },
            { x: 350, y: 1160 },
            { x: 120, y: 1030 },
            { x: 40, y: 760 },
            { x: 40, y: 380 }
          ]
        }
      },
      north_coastal_drybelt: {
        name: '北岸干凉带',
        priority: 18,
        terrain_types: ['干地', '缓丘', '海岸台地'],
        climate: '干凉',
        movement_difficulty: 2,
        resources: ['耐旱灌木', '浅层矿砂'],
        hazards: ['冷风', '缺少遮蔽'],
        strategic_tags: ['北岸通道', '台地边缘'],
        desc: '北岸大部分 tan 色地表带，介于雪山与内陆之间。',
        shape: {
          type: 'polygon',
          points: [
            { x: 190, y: 120 },
            { x: 660, y: 90 },
            { x: 1080, y: 110 },
            { x: 1220, y: 220 },
            { x: 1130, y: 350 },
            { x: 760, y: 360 },
            { x: 420, y: 320 },
            { x: 210, y: 250 }
          ]
        }
      },
      western_green_coast: {
        name: '西岸绿野带',
        priority: 30,
        terrain_types: ['草地', '缓丘', '沿海坡地'],
        climate: '温和偏湿',
        movement_difficulty: 2,
        resources: ['林木', '低阶药草', '近海渔产'],
        hazards: ['泥地', '海雾'],
        strategic_tags: ['沿海据点', '农业带'],
        desc: '主大陆西侧较为绿色的海岸与缓丘带。',
        shape: {
          type: 'polygon',
          points: [
            { x: 40, y: 340 },
            { x: 180, y: 300 },
            { x: 320, y: 380 },
            { x: 310, y: 720 },
            { x: 250, y: 1030 },
            { x: 120, y: 1100 },
            { x: 40, y: 900 }
          ]
        }
      },
      central_green_heartland: {
        name: '中部绿心平原',
        priority: 26,
        terrain_types: ['平原', '草地', '缓丘'],
        climate: '温和',
        movement_difficulty: 2,
        resources: ['耕地', '牧场'],
        hazards: ['地势开阔'],
        strategic_tags: ['腹地通行', '中部缓冲'],
        desc: '主大陆中部较大的绿色平原区，是少数视野开阔的低地。',
        shape: {
          type: 'polygon',
          points: [
            { x: 700, y: 230 },
            { x: 1080, y: 220 },
            { x: 1100, y: 540 },
            { x: 980, y: 760 },
            { x: 760, y: 680 },
            { x: 700, y: 420 }
          ]
        }
      },
      southern_littoral_plain: {
        name: '南部沿海平原带',
        priority: 28,
        terrain_types: ['沿海平原', '缓丘', '海湾'],
        climate: '温暖海洋性',
        movement_difficulty: 2,
        resources: ['粮食', '盐', '渔产', '港贸'],
        hazards: ['海潮', '风暴'],
        strategic_tags: ['人口承载', '商业核心', '港口带'],
        desc: '主大陆南缘连续分布的平原和海岸绿带。',
        shape: {
          type: 'polygon',
          points: [
            { x: 120, y: 940 },
            { x: 380, y: 900 },
            { x: 820, y: 910 },
            { x: 1180, y: 900 },
            { x: 1300, y: 980 },
            { x: 1240, y: 1180 },
            { x: 930, y: 1290 },
            { x: 380, y: 1280 },
            { x: 150, y: 1160 }
          ]
        }
      },
      southeast_green_promontory: {
        name: '东南岬角绿岸',
        priority: 32,
        terrain_types: ['草地', '沿海丘陵', '海角'],
        climate: '温暖海洋性',
        movement_difficulty: 2,
        resources: ['林地', '渔产'],
        hazards: ['海风', '礁岸'],
        strategic_tags: ['东南海角', '沿海据点'],
        desc: '主大陆东南部相对平缓、偏绿色的沿海岬角。',
        shape: {
          type: 'polygon',
          points: [
            { x: 1120, y: 760 },
            { x: 1330, y: 760 },
            { x: 1370, y: 940 },
            { x: 1290, y: 1080 },
            { x: 1120, y: 1010 }
          ]
        }
      },
      central_west_rock_highlands: {
        name: '中西褐岩高地',
        priority: 45,
        terrain_types: ['高地', '荒坡', '碎岩丘陵'],
        climate: '干燥少雨',
        movement_difficulty: 3,
        resources: ['裸露矿脉', '耐旱草本'],
        hazards: ['缺水', '碎石坡'],
        strategic_tags: ['中西过渡', '高地机动'],
        desc: '主大陆中西部大片 tan/褐色高地，是山链之间的过渡带。',
        shape: {
          type: 'polygon',
          points: [
            { x: 220, y: 210 },
            { x: 560, y: 190 },
            { x: 740, y: 310 },
            { x: 720, y: 640 },
            { x: 540, y: 780 },
            { x: 320, y: 760 },
            { x: 210, y: 520 }
          ]
        }
      },
      northwest_glacier_headland: {
        name: '西北冰封角',
        priority: 82,
        terrain_types: ['冰原', '雪山', '冰岸'],
        climate: '高寒',
        movement_difficulty: 5,
        resources: ['冰晶', '寒铁'],
        hazards: ['寒潮', '雪崩', '断崖'],
        strategic_tags: ['天然屏障', '极寒海岸'],
        desc: '主大陆西北角突出的大片冰雪海岬。',
        shape: {
          type: 'polygon',
          points: [
            { x: 50, y: 80 },
            { x: 200, y: 70 },
            { x: 270, y: 150 },
            { x: 240, y: 330 },
            { x: 150, y: 430 },
            { x: 40, y: 360 },
            { x: 20, y: 210 }
          ]
        }
      },
      northern_whitewall_range: {
        name: '北境雪墙山脉',
        priority: 96,
        terrain_types: ['雪山', '高山', '冰脊'],
        climate: '极寒',
        movement_difficulty: 5,
        resources: ['高山矿石', '雪峰灵材'],
        hazards: ['雪崩', '高坠', '缺氧'],
        strategic_tags: ['北境屏障', '雪线'],
        desc: '主大陆北缘连续展开的白色雪山墙，是最醒目的顶部山系。',
        shape: {
          type: 'polygon',
          points: [
            { x: 620, y: 35 },
            { x: 840, y: 25 },
            { x: 1090, y: 40 },
            { x: 1260, y: 100 },
            { x: 1190, y: 220 },
            { x: 980, y: 240 },
            { x: 760, y: 220 },
            { x: 640, y: 150 }
          ]
        }
      },
      northeast_frozen_coast: {
        name: '东北冰雪海岸',
        priority: 94,
        terrain_types: ['冰原', '雪山', '冻岸'],
        climate: '极寒',
        movement_difficulty: 5,
        resources: ['冰晶', '寒铁', '雪峰灵材'],
        hazards: ['寒潮', '雪崩', '冰裂', '断崖'],
        strategic_tags: ['东北雪线', '极寒海岸', '雪原边缘'],
        desc: '主大陆东北上沿的冰雪海岸与雪峰带，是北境雪山向东延展后的白色高寒地貌。',
        shape: {
          type: 'polygon',
          points: [
            { x: 1080, y: 0 },
            { x: 1285, y: 0 },
            { x: 1355, y: 90 },
            { x: 1335, y: 210 },
            { x: 1260, y: 260 },
            { x: 1160, y: 235 },
            { x: 1090, y: 140 },
            { x: 1060, y: 50 }
          ]
        }
      },
      northeast_delta_coast: {
        name: '东北河谷海岸',
        priority: 72,
        terrain_types: ['河谷', '海岸平地', '入海口'],
        climate: '寒温过渡',
        movement_difficulty: 3,
        resources: ['淡水', '渔产', '河谷林木'],
        hazards: ['山洪', '河岸塌陷'],
        strategic_tags: ['东岸通道', '港口潜力'],
        desc: '东北侧带有明显河道和沿岸平地的入海地区。',
        shape: {
          type: 'polygon',
          points: [
            { x: 1110, y: 80 },
            { x: 1270, y: 110 },
            { x: 1340, y: 240 },
            { x: 1320, y: 520 },
            { x: 1220, y: 700 },
            { x: 1120, y: 650 },
            { x: 1110, y: 420 },
            { x: 1070, y: 210 }
          ]
        }
      },
      central_spine_range: {
        name: '中央脊岭山系',
        priority: 90,
        terrain_types: ['山脉', '山岭', '峡谷'],
        climate: '山地冷凉',
        movement_difficulty: 4,
        resources: ['山矿', '高地灵草'],
        hazards: ['塌方', '山道狭窄'],
        strategic_tags: ['中轴山系', '内陆分隔'],
        desc: '由西北向南延伸的中央褐色山系，是主大陆内部最重要的山脉骨架。',
        shape: {
          type: 'polygon',
          points: [
            { x: 500, y: 240 },
            { x: 650, y: 210 },
            { x: 840, y: 320 },
            { x: 930, y: 690 },
            { x: 890, y: 1020 },
            { x: 720, y: 1090 },
            { x: 540, y: 980 },
            { x: 470, y: 720 }
          ]
        }
      },
      southwest_forest_basin: {
        name: '西南林谷盆地',
        priority: 76,
        terrain_types: ['森林', '盆地', '河谷'],
        climate: '温暖湿润',
        movement_difficulty: 4,
        resources: ['木材', '草药', '猎产'],
        hazards: ['兽群', '迷路', '伏击'],
        strategic_tags: ['林地势力', '猎场'],
        desc: '西南侧明显的绿色林地与山谷盆地复合区。',
        shape: {
          type: 'polygon',
          points: [
            { x: 170, y: 560 },
            { x: 330, y: 520 },
            { x: 470, y: 630 },
            { x: 430, y: 860 },
            { x: 260, y: 910 },
            { x: 150, y: 760 }
          ]
        }
      },
      eastern_broken_highlands: {
        name: '东部碎岭高地',
        priority: 86,
        terrain_types: ['山地', '高地', '碎岭'],
        climate: '温凉偏干',
        movement_difficulty: 4,
        resources: ['矿石', '林地'],
        hazards: ['视野受阻', '山道曲折'],
        strategic_tags: ['东部山地', '复杂通路'],
        desc: '主大陆东半部大量褐色山脊与高地聚集形成的复杂山地。',
        shape: {
          type: 'polygon',
          points: [
            { x: 930, y: 250 },
            { x: 1210, y: 250 },
            { x: 1300, y: 520 },
            { x: 1260, y: 920 },
            { x: 1090, y: 1010 },
            { x: 920, y: 860 },
            { x: 890, y: 520 }
          ]
        }
      },
      east_forest_mount_basin: {
        name: '东中林山区',
        priority: 71,
        terrain_types: ['森林', '山地', '盆谷'],
        climate: '温暖湿润',
        movement_difficulty: 4,
        resources: ['林产', '异兽材料'],
        hazards: ['高遭遇率', '复杂地形'],
        strategic_tags: ['林核', '秘境区'],
        desc: '主大陆东中部最明显的绿色林区之一，被山地包围。',
        shape: {
          type: 'polygon',
          points: [
            { x: 880, y: 480 },
            { x: 1080, y: 470 },
            { x: 1160, y: 640 },
            { x: 1100, y: 840 },
            { x: 930, y: 800 },
            { x: 850, y: 620 }
          ]
        }
      },
      south_ring_range: {
        name: '南缘环山带',
        priority: 92,
        terrain_types: ['山链', '山口', '雪脊'],
        climate: '山地冷凉',
        movement_difficulty: 4,
        resources: ['山矿', '高地灵草'],
        hazards: ['塌方', '堵路', '狭口伏击'],
        strategic_tags: ['南北分隔', '古道关隘'],
        desc: '主大陆南侧内缘那圈连续褐色山链，与南岸平原之间形成明显分界。',
        shape: {
          type: 'polygon',
          points: [
            { x: 230, y: 760 },
            { x: 520, y: 730 },
            { x: 820, y: 760 },
            { x: 1010, y: 920 },
            { x: 970, y: 1100 },
            { x: 720, y: 1160 },
            { x: 410, y: 1140 },
            { x: 220, y: 960 }
          ]
        }
      },
      southwest_outer_island: {
        name: '西南外岛',
        priority: 62,
        terrain_types: ['山地岛', '丘陵', '海岸'],
        climate: '温暖海岛型',
        movement_difficulty: 3,
        resources: ['木材', '海产', '岛山矿'],
        hazards: ['风暴', '断崖'],
        strategic_tags: ['海上跳板', '外海岛屿'],
        desc: '位于西南海域的大型岛屿，岛上以山地和缓丘为主。',
        shape: {
          type: 'polygon',
          points: [
            { x: 20, y: 1420 },
            { x: 180, y: 1400 },
            { x: 320, y: 1480 },
            { x: 300, y: 1770 },
            { x: 170, y: 1940 },
            { x: 20, y: 1840 },
            { x: 0, y: 1600 }
          ]
        }
      },
      southern_long_island: {
        name: '南部长岛',
        priority: 66,
        terrain_types: ['山地岛', '岛内河谷', '雪岭'],
        climate: '海洋性山地',
        movement_difficulty: 4,
        resources: ['山矿', '冰晶', '海贸转运'],
        hazards: ['崎岖山道', '海雾'],
        strategic_tags: ['海上关卡', '狭长岛链'],
        desc: '位于主大陆南方海峡另一侧的狭长岛屿，中央山脊明显。',
        shape: {
          type: 'polygon',
          points: [
            { x: 560, y: 1430 },
            { x: 770, y: 1400 },
            { x: 930, y: 1490 },
            { x: 980, y: 1680 },
            { x: 900, y: 1940 },
            { x: 700, y: 1990 },
            { x: 530, y: 1810 },
            { x: 510, y: 1600 }
          ]
        }
      }
    },
    lines: {
      northeast_main_river: {
        name: '东北河谷主河',
        line_type: 'river',
        width_hint: 18,
        desc: '由东北雪山区南下后折向海岸的主干河流，是东岸交通走廊的核心。',
        points: [
          { x: 1080, y: 120 },
          { x: 1120, y: 210 },
          { x: 1110, y: 320 },
          { x: 1080, y: 430 },
          { x: 1060, y: 560 },
          { x: 1020, y: 650 }
        ]
      },
      western_basin_river: {
        name: '西南盆地主河',
        line_type: 'river',
        width_hint: 16,
        desc: '西南山林盆地向海岸外流的河道，承担资源外运与盆地补水功能。',
        points: [
          { x: 520, y: 560 },
          { x: 470, y: 620 },
          { x: 380, y: 690 },
          { x: 290, y: 755 },
          { x: 210, y: 760 }
        ]
      },
      central_snowmelt_river: {
        name: '中央雪融河',
        line_type: 'river',
        width_hint: 12,
        desc: '北部山地雪融后形成的南向河流，为中部山谷提供稀缺水源。',
        points: [
          { x: 770, y: 305 },
          { x: 730, y: 385 },
          { x: 680, y: 465 },
          { x: 650, y: 560 }
        ]
      }
    },
    strategic_points: {
      northwest_hidden_basin: {
        name: '西北环谷',
        point_type: 'hidden_basin',
        x: 180,
        y: 215,
        tags: ['封闭谷地', '隐修地', '高寒避风带'],
        desc: '雪冠海岸内部相对封闭的高寒谷地，适合布置隐世据点或特殊试炼。'
      },
      northeast_mountain_gate: {
        name: '东北山口',
        point_type: 'pass',
        x: 975,
        y: 290,
        tags: ['山口', '河谷入口', '东岸通道'],
        desc: '东北河谷进入内陆的天然缺口，控制价值极高。'
      },
      southwest_basin_pass: {
        name: '西南盆地隘口',
        point_type: 'pass',
        x: 320,
        y: 615,
        tags: ['山口', '盆地入口', '伏击点'],
        desc: '通往西南山林盆地的主要山口，是盆地与外界联通的关键节点。'
      },
      southern_arc_pass: {
        name: '南岭古道',
        point_type: 'pass',
        x: 650,
        y: 1040,
        tags: ['关隘', '古道', '南北转换'],
        desc: '穿越中南山链的重要古道，决定南岸与内陆的联系效率。'
      },
      east_forest_core: {
        name: '东岭林核',
        point_type: 'forest_core',
        x: 910,
        y: 690,
        tags: ['森林核心', '高遭遇区', '秘境'],
        desc: '东中山林区的核心地带，适合安置高危森林生态或隐秘遗迹。'
      }
    }
  };

  function pointInPolygon(x, y, points) {
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Array.isArray(points) || points.length < 3) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = Number(points[i] && points[i].x);
      const yi = Number(points[i] && points[i].y);
      const xj = Number(points[j] && points[j].x);
      const yj = Number(points[j] && points[j].y);
      if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
      const intersects = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function getMainMapTerrainData(mapId = 'map_douluo_world') {
    return toText(mapId, 'map_douluo_world') === MAIN_MAP_TERRAIN_DATA.map_id ? MAIN_MAP_TERRAIN_DATA : null;
  }

  function convertCoordToMainMapTerrainDataSpace(x, y, terrainData = getMainMapTerrainData(), mapId = 'map_douluo_world') {
    const px = toNumber(x, NaN);
    const py = toNumber(y, NaN);
    if (!Number.isFinite(px) || !Number.isFinite(py) || !terrainData) return null;
    const bounds = terrainData.bounds || { min_x: 0, min_y: 0, width: WORLD_IMAGE_WIDTH, height: WORLD_IMAGE_HEIGHT };
    const minX = toNumber(bounds.min_x, 0);
    const minY = toNumber(bounds.min_y, 0);
    const width = Math.max(1, toNumber(bounds.width, WORLD_IMAGE_WIDTH));
    const height = Math.max(1, toNumber(bounds.height, WORLD_IMAGE_HEIGHT));
    if (toText(mapId, 'map_douluo_world') === 'map_douluo_world') {
      return {
        x: Number((minX + clamp(px / Math.max(1, WORLD_IMAGE_WIDTH - 1), 0, 1) * width).toFixed(2)),
        y: Number((minY + clamp(py / Math.max(1, WORLD_IMAGE_HEIGHT - 1), 0, 1) * height).toFixed(2))
      };
    }
    return { x: px, y: py };
  }

  function ensureWorldTerrainColorSampler() {
    if (worldTerrainColorSamplerState.ready || worldTerrainColorSamplerState.loading || worldTerrainColorSamplerState.failed) return;
    if (typeof Image !== 'function' || typeof document === 'undefined') {
      worldTerrainColorSamplerState.failed = true;
      return;
    }
    worldTerrainColorSamplerState.loading = true;
    try {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || WORLD_IMAGE_WIDTH;
          canvas.height = img.naturalHeight || WORLD_IMAGE_HEIGHT;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('2d context unavailable');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          worldTerrainColorSamplerState.image = img;
          worldTerrainColorSamplerState.canvas = canvas;
          worldTerrainColorSamplerState.ctx = ctx;
          worldTerrainColorSamplerState.ready = true;
          worldTerrainColorSamplerState.loading = false;
        } catch (_) {
          worldTerrainColorSamplerState.failed = true;
          worldTerrainColorSamplerState.loading = false;
        }
      };
      img.onerror = () => {
        worldTerrainColorSamplerState.failed = true;
        worldTerrainColorSamplerState.loading = false;
      };
      img.src = ASSETS.world;
    } catch (_) {
      worldTerrainColorSamplerState.failed = true;
      worldTerrainColorSamplerState.loading = false;
    }
  }

  function classifyWorldTerrainPixelColor(r, g, b) {
    const rr = toNumber(r, 0);
    const gg = toNumber(g, 0);
    const bb = toNumber(b, 0);
    const brightness = (rr + gg + bb) / 3;
    const maxChannel = Math.max(rr, gg, bb);
    const minChannel = Math.min(rr, gg, bb);
    const saturation = maxChannel - minChannel;
    if (brightness >= 178 && saturation <= 42) return 'white';
    if (bb >= gg + 18 && bb >= rr + 24 && brightness >= 60) return 'water';
    if (gg >= rr + 10 && gg >= bb + 8) {
      if (brightness <= 82) return 'dark_green';
      if (brightness <= 128) return 'green';
      return 'light_green';
    }
    if (rr >= gg && gg > bb && (rr - bb) >= 24) {
      if (brightness >= 120 && saturation <= 75) return 'tan';
      return 'brown';
    }
    if (brightness >= 145 && Math.abs(rr - gg) <= 26 && bb < gg - 8) return 'tan';
    return 'other';
  }

  function buildWorldTerrainInfoFromVisualKind(kind, gridInfo = null, mapId = 'map_douluo_world') {
    const defs = {
      glacier: { name: '冰川', terrainTypes: ['冰川'], movementDifficulty: 5, resources: ['冰晶'] },
      iceberg: { name: '冰山', terrainTypes: ['冰山'], movementDifficulty: 5, resources: ['冰晶', '寒铁'] },
      highmountain: { name: '高山', terrainTypes: ['高山', '山谷'], movementDifficulty: 5, resources: ['岩材'] },
      grassland: { name: '草原', terrainTypes: ['草原'], movementDifficulty: 1, resources: ['牧草'] },
      forest: { name: '森林', terrainTypes: ['森林'], movementDifficulty: 3, resources: ['林木'] },
      basin: { name: '盆地', terrainTypes: ['盆地'], movementDifficulty: 2, resources: ['水源', '沃土'] },
      mountain: { name: '山地', terrainTypes: ['山地', '山脉'], movementDifficulty: 4, resources: ['矿脉', '岩材'] },
      water: { name: '海域', terrainTypes: ['海域'], movementDifficulty: 3, resources: ['渔产'] },
      plain: { name: '平原', terrainTypes: ['平原'], movementDifficulty: 1, resources: ['耕地'] }
    };
    const meta = defs[kind] || defs.plain;
    return {
      id: `visual_${kind}${gridInfo ? `_${gridInfo.gridX}_${gridInfo.gridY}` : ''}`,
      name: meta.name,
      terrainTypes: Array.isArray(meta.terrainTypes) ? meta.terrainTypes.slice() : [],
      climate: '',
      movementDifficulty: meta.movementDifficulty,
      resources: Array.isArray(meta.resources) ? meta.resources.slice() : [],
      overlapNames: [],
      mapId: toText(mapId, 'map_douluo_world'),
      grid: gridInfo ? { x: gridInfo.gridX, y: gridInfo.gridY, code: gridInfo.gridCode, terrain: gridInfo.gridTerrain } : null,
      source: 'image-color'
    };
  }

  function resolveWorldTerrainHardOverride(coord, gridInfo = null, mapId = 'map_douluo_world') {
    if (toText(mapId, 'map_douluo_world') !== 'map_douluo_world') return null;
    const overrideKey = gridInfo ? `${gridInfo.gridX},${gridInfo.gridY}` : '';
    const override = overrideKey ? WORLD_TERRAIN_CELL_OVERRIDES[overrideKey] : null;
    if (!override) return null;
    const info = buildWorldTerrainInfoFromVisualKind(toText(override[0], 'plain') || 'plain', gridInfo, mapId);
    const overrideName = toText(override[1], '');
    if (overrideName) info.name = overrideName;
    info.source = 'paint-grid';
    return info;
  }

  function resolveWorldImageColorTerrainInfo(coord, gridInfo = null, mapId = 'map_douluo_world') {
    if (toText(mapId, 'map_douluo_world') !== 'map_douluo_world') return null;
    ensureWorldTerrainColorSampler();
    const sampler = worldTerrainColorSamplerState;
    if (!sampler.ready || !sampler.ctx) return null;
    const x = Math.round(clamp(toNumber(coord && coord.x, NaN), 0, Math.max(0, WORLD_IMAGE_WIDTH - 1)));
    const y = Math.round(clamp(toNumber(coord && coord.y, NaN), 0, Math.max(0, WORLD_IMAGE_HEIGHT - 1)));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const radius = 1;
    const left = Math.max(0, x - radius);
    const top = Math.max(0, y - radius);
    const width = Math.min(WORLD_IMAGE_WIDTH - left, radius * 2 + 1);
    const height = Math.min(WORLD_IMAGE_HEIGHT - top, radius * 2 + 1);
    let imageData = null;
    try {
      imageData = sampler.ctx.getImageData(left, top, width, height);
    } catch (_) {
      sampler.failed = true;
      sampler.ready = false;
      return null;
    }
    if (!imageData || !imageData.data) return null;
    let waterCount = 0;
    let sampleCount = 0;
    for (let sy = 0; sy < height; sy += 1) {
      for (let sx = 0; sx < width; sx += 1) {
        const idx = (sy * width + sx) * 4;
        if (classifyWorldTerrainPixelColor(imageData.data[idx], imageData.data[idx + 1], imageData.data[idx + 2]) === 'water') waterCount += 1;
        sampleCount += 1;
      }
    }
    if (waterCount / Math.max(1, sampleCount) >= 0.34) return buildWorldTerrainInfoFromVisualKind('water', gridInfo, mapId);
    return buildWorldTerrainInfoFromVisualKind('plain', gridInfo, mapId);
  }

  function getMainMapTerrainRegionsByCoord(x, y, mapId = 'map_douluo_world') {
    const terrainData = getMainMapTerrainData(mapId);
    if (!terrainData) return [];
    const terrainPoint = convertCoordToMainMapTerrainDataSpace(x, y, terrainData, mapId);
    if (!terrainPoint) return [];
    return Object.entries(terrainData.regions)
      .filter(([, region]) => pointInPolygon(terrainPoint.x, terrainPoint.y, region && region.shape && region.shape.points))
      .map(([id, region]) => ({ id, ...region }))
      .sort((a, b) => {
        const pa = toNumber(a && a.priority, 0);
        const pb = toNumber(b && b.priority, 0);
        return pa - pb;
      });
  }
  try {
    window.getMainMapTerrainData = getMainMapTerrainData;
    window.getMainMapTerrainRegionsByCoord = getMainMapTerrainRegionsByCoord;
  } catch (_) {}

  function getGlobalTerrainResolver() {
    try {
      if (typeof window.getMainMapTerrainRegionsByCoord === 'function') return window.getMainMapTerrainRegionsByCoord.bind(window);
    } catch (_) {}
    try {
      if (typeof getMainMapTerrainRegionsByCoord === 'function') return getMainMapTerrainRegionsByCoord;
    } catch (_) {}
    return null;
  }

  function resolveTerrainInfoByCoord(coord, mapId = mapState.currentMapId) {
    const x = toNumber(coord && coord.x, NaN);
    const y = toNumber(coord && coord.y, NaN);
    const safeMapId = toText(mapId, 'map_douluo_world');
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const cacheKey = `${safeMapId}:${roundCoord(x)}:${roundCoord(y)}`;
    if (mapDerivedCache.terrainInfo.has(cacheKey)) return mapDerivedCache.terrainInfo.get(cacheKey);
    const gridInfo = resolveMainMapTerrainGridInfo({ x, y }, safeMapId);
    const hardOverrideInfo = resolveWorldTerrainHardOverride({ x, y }, gridInfo, safeMapId);
    let result = null;
    if (hardOverrideInfo) {
      result = hardOverrideInfo;
    } else {
      const visualInfo = resolveWorldImageColorTerrainInfo({ x, y }, gridInfo, safeMapId);
      if (visualInfo) {
        result = visualInfo;
      } else if (safeMapId === 'map_douluo_world') {
        const terrainHints = Array.isArray(gridInfo && gridInfo.terrainTypes)
          ? gridInfo.terrainTypes.map(item => toText(item, '')).filter(Boolean)
          : [];
        result = terrainHints.some(item => /(海|洋|水域|海域|外海)/.test(item))
          ? buildWorldTerrainInfoFromVisualKind('water', gridInfo, safeMapId)
          : buildWorldTerrainInfoFromVisualKind('plain', gridInfo, safeMapId);
      } else {
        const resolver = getGlobalTerrainResolver();
        let regions = [];
        if (resolver) {
          try {
            regions = resolver(x, y, safeMapId) || [];
          } catch (_) {
            regions = [];
          }
        }
        if ((!Array.isArray(regions) || !regions.length) && gridInfo) {
          result = gridInfo;
        } else if (Array.isArray(regions) && regions.length) {
          const primary = regions[regions.length - 1] || regions[0] || {};
          const overlapNames = regions.map(region => toText(region && region.name, '')).filter(Boolean);
          const primaryTerrainTypes = Array.isArray(primary.terrain_types) ? primary.terrain_types.map(item => toText(item, '')).filter(Boolean) : [];
          const terrainTypes = gridInfo
            ? [...gridInfo.terrainTypes, ...primaryTerrainTypes.filter(item => item && !gridInfo.terrainTypes.includes(item))]
            : primaryTerrainTypes;
          const regionResources = Array.isArray(primary.resources) ? primary.resources.map(item => toText(item, '')).filter(Boolean) : [];
          const resources = gridInfo
            ? [...new Set([...(Array.isArray(gridInfo.resources) ? gridInfo.resources : []), ...regionResources])]
            : regionResources;
          const regionMovementDifficulty = toNumber(primary.movement_difficulty, NaN);
          const movementDifficultyCandidates = [
            Number.isFinite(regionMovementDifficulty) ? regionMovementDifficulty : NaN,
            gridInfo && Number.isFinite(gridInfo.movementDifficulty) ? gridInfo.movementDifficulty : NaN
          ].filter(Number.isFinite);
          const movementDifficulty = movementDifficultyCandidates.length ? Math.max(...movementDifficultyCandidates) : NaN;
          result = {
            id: toText(primary.id, gridInfo ? `grid_${gridInfo.gridTerrain}` : ''),
            name: toText(primary.name, gridInfo ? toText(gridInfo.name, terrainTypes.join('/')) : terrainTypes.join('/')),
            terrainTypes,
            climate: toText(primary.climate, gridInfo ? toText(gridInfo.climate, '') : ''),
            movementDifficulty: Number.isFinite(movementDifficulty) ? movementDifficulty : NaN,
            resources,
            overlapNames,
            mapId: safeMapId,
            grid: gridInfo ? { x: gridInfo.gridX, y: gridInfo.gridY, code: gridInfo.gridCode, terrain: gridInfo.gridTerrain } : null,
            source: gridInfo ? 'region+grid' : 'region'
          };
        }
      }
    }
    mapDerivedCache.terrainInfo.set(cacheKey, result);
    return result;
  }

  function formatTerrainText(info, mapId = mapState.currentMapId) {
    const safeMapId = toText(mapId, 'map_douluo_world');
    if (!info) return safeMapId === 'map_douluo_world' ? '未命中地形区' : '当前子图未标注';
    const name = toText(info.name, '未知地形');
    const terrainLabel = Array.isArray(info.terrainTypes) && info.terrainTypes.length
      ? info.terrainTypes.join('/')
      : '';
    const detailParts = [];
    if (terrainLabel && terrainLabel !== name) detailParts.push(terrainLabel);
    return [name, ...detailParts].filter(Boolean).join(' · ');
  }

  function formatTerrainNarrative(info, mapId = mapState.currentMapId, options = {}) {
    const safeMapId = toText(mapId, 'map_douluo_world');
    const { fallback = '', includeDifficulty = true } = options || {};
    if (!info) return fallback || (safeMapId === 'map_douluo_world' ? '未命中地形区' : '当前子图未标注');
    const name = toText(info.name, '未知地形');
    const terrainLabel = Array.isArray(info.terrainTypes) && info.terrainTypes.length
      ? info.terrainTypes.join('/')
      : '';
    const parts = [name];
    if (terrainLabel && terrainLabel !== name) parts.push(`地貌 ${terrainLabel}`);
    if (includeDifficulty && Number.isFinite(info.movementDifficulty)) parts.push(`通行难度 ${Math.round(info.movementDifficulty)}`);
    return parts.join(' · ');
  }

  function sameCoord(a, b) {
    return !!a && !!b && roundCoord(a.x) === roundCoord(b.x) && roundCoord(a.y) === roundCoord(b.y);
  }

  function getVisibleMapNodeCount() {
    return getRenderableItems().length;
  }

  function getNearestVisibleMapNode(coord, layer = mapState.layer, options = {}) {
    const { maxRatioDistance = Infinity, useRenderedRatio = false } = options || {};
    const safeLayer = toText(layer, mapState.layer || 'continent');
    const coordX = toNumber(coord && coord.x, NaN);
    const coordY = toNumber(coord && coord.y, NaN);
    const coordKeyX = Number.isFinite(coordX) ? coordX.toFixed(useRenderedRatio ? 2 : 0) : 'NaN';
    const coordKeyY = Number.isFinite(coordY) ? coordY.toFixed(useRenderedRatio ? 2 : 0) : 'NaN';
    const distanceKey = Number.isFinite(maxRatioDistance) ? maxRatioDistance.toFixed(4) : 'inf';
    const cacheKey = `${safeLayer}:${useRenderedRatio ? 'ratio' : 'world'}:${distanceKey}:${coordKeyX}:${coordKeyY}`;
    if (mapDerivedCache.nearestVisibleNode.has(cacheKey)) return mapDerivedCache.nearestVisibleNode.get(cacheKey);
    const items = getRenderableItems(safeLayer);
    if (!items.length) return mapState.currentNode || mapState.selectedNode || '';
    const targetRatio = useRenderedRatio && coord ? projectCoord(coord) : null;
    const best = items.reduce((acc, item) => {
      let dist = Infinity;
      if (useRenderedRatio && targetRatio) {
        const ratio = projectCoord({ x: item.x, y: item.y });
        dist = Math.hypot(ratio.left - targetRatio.left, ratio.top - targetRatio.top);
      } else {
        dist = Math.hypot(item.x - coordX, item.y - coordY);
      }
      return !acc || dist < acc.dist ? { name: item.name, dist } : acc;
    }, null);
    let result = items[0].name;
    if (best) {
      result = Number.isFinite(maxRatioDistance) && best.dist > maxRatioDistance ? '' : best.name;
    }
    mapDerivedCache.nearestVisibleNode.set(cacheKey, result);
    return result;
  }

  function 取坐标相对节点方位(目标坐标 = null, 基准坐标 = null) {
    const dx = toNumber(目标坐标 && 目标坐标.x, NaN) - toNumber(基准坐标 && 基准坐标.x, NaN);
    const dy = toNumber(目标坐标 && 目标坐标.y, NaN) - toNumber(基准坐标 && 基准坐标.y, NaN);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return '附近';
    const 距离 = Math.hypot(dx, dy);
    if (距离 < 4) return '附近';
    const 阈值 = 距离 * 0.22;
    const 横向 = Math.abs(dx) < 阈值 ? '' : (dx > 0 ? '东' : '西');
    const 纵向 = Math.abs(dy) < 阈值 ? '' : (dy > 0 ? '南' : '北');
    return `${横向}${纵向}` || '附近';
  }

  function 构建自由坐标地点名(坐标 = null, layer = mapState.layer) {
    const 目标坐标 = 坐标 && Number.isFinite(toNumber(坐标.x, NaN)) && Number.isFinite(toNumber(坐标.y, NaN))
      ? { x: toNumber(坐标.x, 0), y: toNumber(坐标.y, 0) }
      : null;
    if (!目标坐标) return '未知区域';
    const 最近节点名 = getNearestVisibleMapNode(目标坐标, layer);
    const 最近节点 = 最近节点名 ? getItemByName(最近节点名) : null;
    if (!最近节点 || !最近节点.validCoord) {
      const 当前节点名 = resolveActionableCurrentNodeName(mapState.snapshot || mapState.baseSnapshot || null) || getVisibleCurrentNode();
      return 当前节点名 ? `${当前节点名}附近` : '未知区域';
    }
    const 方位 = 取坐标相对节点方位(目标坐标, { x: 最近节点.x, y: 最近节点.y });
    return 方位 === '附近' ? `${最近节点.name}附近` : `${最近节点.name}${方位}侧`;
  }

  function getVisibleCurrentNode() {
    if (hasActivePreview()) return '';
    if (mapState.currentFreePoint) return getNearestVisibleMapNode(mapState.currentFreePoint, mapState.layer);
    const names = getRenderableItems(mapState.layer).map(item => item.name);
    if (mapState.currentNode && names.includes(mapState.currentNode)) return mapState.currentNode;
    return getNearestVisibleMapNode(getCurrentCoord(), mapState.layer);
  }

  function resolveActionableCurrentNodeName(snapshot = null) {
    const visibleCurrentName = getVisibleCurrentNode();
    if (visibleCurrentName) return visibleCurrentName;
    if (!(hasActivePreview() && isPreviewCurrentBranch())) return '';
    const currentLoc = toText(getRawActualCurrentLoc() || getActualCurrentLoc() || deepGet(snapshot, 'currentLoc', ''), '');
    const currentSegments = currentLoc
      .replace(/^斗罗大陆-/, '')
      .replace(/^斗灵大陆-/, '')
      .split('-')
      .map(seg => toText(seg, '').trim())
      .filter(Boolean);
    const 完整地点名 = currentSegments.join('-');
    if (完整地点名 && getItemByName(完整地点名)) return 完整地点名;
    for (let index = currentSegments.length - 1; index >= 0; index -= 1) {
      const segment = currentSegments[index];
      const 后缀地点名 = currentSegments.slice(index).join('-');
      if (后缀地点名 && getItemByName(后缀地点名)) return 后缀地点名;
      if (segment && getItemByName(segment)) return segment;
    }
    return '';
  }

  function 收集当前位置节点候选(snapshot = null) {
    const 候选 = new Set();
    const 加入名称 = (名称, 拆路径 = false) => {
      const 原名 = toText(名称, '').trim();
      const 归一名 = 归一地点名(原名);
      [原名, 归一名].forEach(候选名 => {
        if (候选名) 候选.add(候选名);
      });
      if (!拆路径) return;
      const 路径片段 = 拆分地点路径(原名);
      if (!路径片段.length) return;
      候选.add(路径片段.join('-'));
      候选.add(路径片段[路径片段.length - 1]);
    };
    const 当前快照 = snapshot || mapState.snapshot || buildFallbackSnapshot();
    加入名称(resolveActionableCurrentNodeName(当前快照));
    加入名称(getVisibleCurrentNode());
    加入名称(mapState.currentNode);
    加入名称(deepGet(当前快照, 'currentFocusName', ''));
    加入名称(deepGet(当前快照, 'currentLocFull', ''), true);
    加入名称(deepGet(当前快照, 'currentLoc', ''), true);
    加入名称(getActualCurrentLoc(), true);
    加入名称(getRawActualCurrentLoc(), true);
    return 候选;
  }

  function 判断地图节点为当前位置(节点名 = '', snapshot = null) {
    const 目标名 = 归一地点名(节点名);
    if (!目标名) return false;
    return 收集当前位置节点候选(snapshot).has(目标名);
  }

  function 判断地图节点为精确当前位置(节点名 = '', snapshot = null) {
    const 目标片段 = 拆分地点路径(节点名);
    if (!目标片段.length) return false;
    const 当前快照 = snapshot || mapState.snapshot || buildFallbackSnapshot();
    const 当前候选列表 = [
      getRawActualCurrentLoc(),
      getActualCurrentLoc(),
      deepGet(当前快照, 'currentLocFull', ''),
      deepGet(当前快照, 'currentLoc', ''),
      mapState.currentNode,
      getVisibleCurrentNode(),
    ];
    return 当前候选列表.some(名称 => {
      const 当前片段 = 拆分地点路径(名称);
      if (!当前片段.length) return false;
      return 当前片段.join('-') === 目标片段.join('-') || 当前片段[当前片段.length - 1] === 目标片段[目标片段.length - 1];
    });
  }

  function resolveSelectedNodeForLayer(layer) {
    if (mapState.selectedFreePoint) return getNearestVisibleMapNode(mapState.selectedFreePoint, layer, { maxRatioDistance: MAP_NODE_SNAP_RATIO_THRESHOLD, useRenderedRatio: true }) || '';
    const items = getRenderableItems(layer);
    const names = items.map(item => item.name);
    if (mapState.selectedNode && names.includes(mapState.selectedNode)) return mapState.selectedNode;
    if (mapState.currentNode && names.includes(mapState.currentNode)) return mapState.currentNode;
    return items[0] ? items[0].name : '';
  }

  function resolveMapLayerByZoom(zoom) {
    if (zoom <= 1.18) return 'continent';
    if (zoom >= 2.2) return 'facility';
    return 'city';
  }

  function clampMapPan(canvasEl = getPrimaryMapCanvas()) {
    if (!canvasEl || !canvasEl.clientWidth || !canvasEl.clientHeight) return;
    const renderZoom = getMapRenderZoom();
    const rangeX = Math.max(0, (renderZoom - 1) * canvasEl.clientWidth * 0.5);
    const rangeY = Math.max(0, (renderZoom - 1) * canvasEl.clientHeight * 0.5);
    mapState.panX = clamp(mapState.panX, -rangeX, rangeX);
    mapState.panY = clamp(mapState.panY, -rangeY, rangeY);
  }

  function normalizeMapSelection() {
    if (mapState.layerFollowsZoom) {
      mapState.layer = resolveMapLayerByZoom(mapState.zoom);
    }
    mapState.selectedNode = resolveSelectedNodeForLayer(mapState.layer) || mapState.selectedNode;
    clampMapPan();
  }

  function convertMapRatioToImageCoord(left, top) {
    const 坐标 = getCoordFromMapRatio(left, top);
    return {
      x: Math.round(clamp(toNumber(坐标 && 坐标.x, 0), 0, Math.max(0, WORLD_IMAGE_WIDTH - 1))),
      y: Math.round(clamp(toNumber(坐标 && 坐标.y, 0), 0, Math.max(0, WORLD_IMAGE_HEIGHT - 1)))
    };
  }

  function convertMapCoordToImageCoord(coord) {
    if (!coord || !Number.isFinite(coord.x) || !Number.isFinite(coord.y)) return { x: 0, y: 0 };
    return {
      x: Math.round(clamp(toNumber(coord.x, 0), 0, Math.max(0, WORLD_IMAGE_WIDTH - 1))),
      y: Math.round(clamp(toNumber(coord.y, 0), 0, Math.max(0, WORLD_IMAGE_HEIGHT - 1)))
    };
  }

  function formatMapImageCoord(point, prefix = '') {
    if (!point) return prefix ? `${prefix} --,--` : '--,--';
    const imageCoord = convertMapCoordToImageCoord(point);
    const coordText = `${imageCoord.x},${imageCoord.y}`;
    return prefix ? `${prefix} ${coordText}` : coordText;
  }

  function formatFreePoint(point, prefix = '坐标点') {
    if (!point) return prefix ? `${prefix} --,--` : '--,--';
    return formatMapImageCoord(point, `${prefix} 图`);
  }

  function centerMapOnCoord(coord, canvasEl = getPrimaryMapCanvas()) {
    const pos = convertMapCoordToLocalPoint(coord, canvasEl);
    if (!canvasEl || !pos) return;
    const renderZoom = getMapRenderZoom();
    const cx = canvasEl.clientWidth / 2;
    const cy = canvasEl.clientHeight / 2;
    mapState.panX = Number((-(pos.x - cx) * renderZoom).toFixed(2));
    mapState.panY = Number((-(pos.y - cy) * renderZoom).toFixed(2));
    clampMapPan();
  }

  function centerMapOnNode(nodeName) {
    centerMapOnCoord(getMapNodeCoord(nodeName), getPrimaryMapCanvas());
  }

  function centerMapOnRatio(left, top, canvasEl = getPrimaryMapCanvas()) {
    const coord = getCoordFromMapRatio(left, top);
    centerMapOnCoord(coord, canvasEl);
  }

  function getMapElementWidth(element) {
    return Math.round(element?.getBoundingClientRect().width || element?.clientWidth || element?.offsetWidth || 0);
  }

  function syncMapLayoutShell(force = false) {
    const canvasEls = getMapUiElements('.map-canvas.map-canvas-large');
    const heroCards = getMapUiElements('.map-hero-card');
    const canvasWidths = canvasEls.map(canvasEl => {
      const width = getMapElementWidth(canvasEl);
      canvasEl.__mapMeasuredWidth = width;
      return width;
    });
    const layoutSignature = canvasWidths.join('|');
    if (!force && mapState.lastLayoutSignature === layoutSignature) return;

    mapState.lastLayoutSignature = layoutSignature;
    const canvasRatio = WORLD_IMAGE_HEIGHT / WORLD_IMAGE_WIDTH;
    canvasEls.forEach((canvasEl, index) => {
      const width = canvasWidths[index] || 0;
      if (!width) return;
      const 统一面板画布 = !!canvasEl.closest('.mvu-unified-map-stage');
      if (统一面板画布) {
        canvasEl.style.setProperty('height', '100%', 'important');
        canvasEl.style.setProperty('min-height', '0px', 'important');
        canvasEl.style.setProperty('max-height', 'none', 'important');
        canvasEl.style.setProperty('align-self', 'stretch', 'important');
        canvasEl.style.setProperty('flex', 'initial', 'important');
        canvasEl.style.setProperty('aspect-ratio', 'auto', 'important');
        return;
      }
      const height = Math.max(160, Math.round(width * canvasRatio));
      const nextHeight = `${height}px`;
      const nextAspectRatio = `${WORLD_IMAGE_WIDTH} / ${WORLD_IMAGE_HEIGHT}`;
      if (canvasEl.style.height !== nextHeight) canvasEl.style.setProperty('height', nextHeight, 'important');
      if (canvasEl.style.minHeight !== '0px') canvasEl.style.setProperty('min-height', '0px', 'important');
      if (canvasEl.style.flex !== '0 0 auto') canvasEl.style.setProperty('flex', '0 0 auto', 'important');
      if (canvasEl.style.aspectRatio !== nextAspectRatio) canvasEl.style.setProperty('aspect-ratio', nextAspectRatio, 'important');
    });

    heroCards.forEach(card => {
      const canvasEl = card.querySelector('.map-canvas.map-canvas-large');
      const width = canvasEl ? (Number.isFinite(canvasEl.__mapMeasuredWidth) ? canvasEl.__mapMeasuredWidth : getMapElementWidth(canvasEl)) : 0;
      const compact = width > 0 && width < 560;
      const ultraCompact = width > 0 && width < 430;
      card.classList.toggle('is-compact', compact);
      card.classList.toggle('is-ultra-compact', ultraCompact);
      if (canvasEl) {
        canvasEl.classList.toggle('is-compact', compact);
        canvasEl.classList.toggle('is-ultra-compact', ultraCompact);
      }
    });
  }


  function getMapCanvasMetrics(canvasEl) {
    const rect = canvasEl && typeof canvasEl.getBoundingClientRect === 'function' ? canvasEl.getBoundingClientRect() : null;
    const borderLeft = toNumber(canvasEl && canvasEl.clientLeft, 0);
    const borderTop = toNumber(canvasEl && canvasEl.clientTop, 0);
    const renderWidth = toNumber(canvasEl && canvasEl.clientWidth, 0) || rect?.width || 0;
    const renderHeight = toNumber(canvasEl && canvasEl.clientHeight, 0) || rect?.height || 0;
    const contentLeft = rect ? rect.left + borderLeft : 0;
    const contentTop = rect ? rect.top + borderTop : 0;
    return { rect, renderWidth, renderHeight, contentLeft, contentTop };
  }

  function resolveMapClientPoint(canvasEl, clientX, clientY) {
    if (!canvasEl || clientX === null || clientY === null || clientX === undefined || clientY === undefined) return null;
    const metrics = getMapCanvasMetrics(canvasEl);
    if (!metrics.rect) return null;
    const renderX = clientX - metrics.contentLeft;
    const renderY = clientY - metrics.contentTop;
    return {
      ...metrics,
      renderX,
      renderY,
      localX: renderX,
      localY: renderY,
      inside: renderX >= 0 && renderY >= 0 && renderX <= metrics.renderWidth && renderY <= metrics.renderHeight
    };
  }

  function getActiveMapCanvases() {
    const canvases = getMapUiElements('.map-canvas.interactive-map');
    const active = canvases.filter(canvasEl => canvasEl.getClientRects().length > 0 && canvasEl.offsetParent !== null);
    return active.length ? active : canvases;
  }

  function getPrimaryMapCanvas() {
    return mapDragState.sourceCanvas || mapState.hoverCanvas || getActiveMapCanvases()[0] || getMapUiElements('.map-canvas.interactive-map')[0] || null;
  }

  function invalidateMapUiRefCache() {
    if (!(mapState.uiRefCache instanceof Map)) {
      mapState.uiRefCache = new Map();
      mapState.scopedUiRefCache = new WeakMap();
      mapState.lastLayoutSignature = null;
      return;
    }
    mapState.uiRefCache.clear();
    mapState.scopedUiRefCache = new WeakMap();
    mapState.lastLayoutSignature = null;
  }

  function getMapUiElements(selector) {
    if (!(mapState.uiRefCache instanceof Map)) mapState.uiRefCache = new Map();
    const cached = mapState.uiRefCache.get(selector);
    if (Array.isArray(cached) && cached.length && cached.every(el => el && el.isConnected)) {
      return cached;
    }
    const elements = [...document.querySelectorAll(selector)];
    if (elements.length) mapState.uiRefCache.set(selector, elements);
    else mapState.uiRefCache.delete(selector);
    return elements;
  }

  function getScopedMapUiElements(root, selector) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    if (!(mapState.scopedUiRefCache instanceof WeakMap)) mapState.scopedUiRefCache = new WeakMap();
    let rootCache = mapState.scopedUiRefCache.get(root);
    if (!(rootCache instanceof Map)) {
      rootCache = new Map();
      mapState.scopedUiRefCache.set(root, rootCache);
    }
    const cached = rootCache.get(selector);
    if (Array.isArray(cached) && cached.length && cached.every(el => el && el.isConnected && root.contains(el))) {
      return cached;
    }
    const elements = Array.from(root.querySelectorAll(selector));
    if (elements.length) rootCache.set(selector, elements);
    else rootCache.delete(selector);
    return elements;
  }

  function setMapText(selector, value) {
    getMapUiElements(selector).forEach(el => {
      const nextValue = value == null ? '' : String(value);
      if (el.textContent === nextValue) return;
      el.textContent = nextValue;
    });
  }

  function setMapHtml(selector, value) {
    let mutated = false;
    getMapUiElements(selector).forEach(el => {
      const nextValue = value == null ? '' : String(value);
      if (el.innerHTML === nextValue) return;
      el.innerHTML = nextValue;
      mutated = true;
    });
    if (mutated) invalidateMapUiRefCache();
  }

  function dispatchMapAiRequest(playerInput, systemPrompt, meta = {}) {
    const detail = {
      playerInput: toText(playerInput, ''),
      systemPrompt: toText(systemPrompt, ''),
      meta: meta && typeof meta === 'object' ? { ...meta } : {}
    };
    try {
      window.dispatchEvent(new CustomEvent('map-ai-request', { detail }));
      return detail.handled === true;
    } catch (error) {
      console.error('Dispatch map AI request failed:', error);
      return false;
    }
  }

  function setMapNodeText(node, value) {
    if (!node) return;
    const nextValue = value == null ? '' : String(value);
    if (node.textContent === nextValue) return;
    node.textContent = nextValue;
  }

  function setMapNodeClass(node, className, enabled) {
    if (!node || !className) return;
    const shouldHave = !!enabled;
    const hasClass = node.classList.contains(className);
    if (hasClass === shouldHave) return;
    node.classList.toggle(className, shouldHave);
  }

  function setMapNodeStyle(node, prop, value, priority = '') {
    if (!node || !node.style || !prop) return;
    const nextValue = value == null ? '' : String(value);
    const currentValue = node.style.getPropertyValue(prop);
    if (currentValue === nextValue) return;
    node.style.setProperty(prop, nextValue, priority);
  }

  function 获取地图快速变换样式表() {
    let 样式 = document.getElementById('sheep-map-fast-transform-style');
    if (!样式) {
      样式 = document.createElement('style');
      样式.id = 'sheep-map-fast-transform-style';
      document.head.appendChild(样式);
    }
    return 样式.sheet || null;
  }

  function 获取地图画布快速变换规则(画布) {
    if (!画布 || !画布.dataset) return null;
    if (!画布.dataset.mapFastTransformId) {
      获取地图画布快速变换规则.序号 = (获取地图画布快速变换规则.序号 || 0) + 1;
      画布.dataset.mapFastTransformId = String(获取地图画布快速变换规则.序号);
    }
    const 标识 = 画布.dataset.mapFastTransformId;
    const 规则表 = 获取地图画布快速变换规则.规则表 || (获取地图画布快速变换规则.规则表 = new Map());
    if (规则表.has(标识)) return 规则表.get(标识);
    const 样式表 = 获取地图快速变换样式表();
    if (!样式表) return null;
    const 选择器 = `.map-canvas[data-map-fast-transform-id="${标识}"] [data-map-world]`;
    try {
      const 位置 = 样式表.cssRules.length;
      样式表.insertRule(`${选择器}{transform:none !important;}`, 位置);
      const 规则 = 样式表.cssRules[位置] || null;
      if (规则) 规则表.set(标识, 规则);
      return 规则;
    } catch (错误) {
      return null;
    }
  }

  function 设置地图画布快速变换(画布, panX, panY, renderZoom) {
    const 规则 = 获取地图画布快速变换规则(画布);
    const 变换 = `translate3d(${panX}px, ${panY}px, 0) scale(${Number(renderZoom.toFixed(3))})`;
    if (!规则 || !规则.style) return false;
    if (规则.style.getPropertyValue('transform') === 变换) return true;
    规则.style.setProperty('transform', 变换, 'important');
    return true;
  }

  function escapeMapHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getNpcActionCandidates(item, npcCount = 0) {
    if (!item) return [];
    const candidates = new Set();
    const nodeName = toText(item && item.name, '');
    const isOfficialCommissionNode = ['锻造师协会', '制造师协会', '设计师协会', '修理师协会']
      .some(name => nodeName && (nodeName.includes(name) || name.includes(nodeName)));
    const sourceActions = Array.isArray(item.actionSlots) && item.actionSlots.length
      ? item.actionSlots
      : (Array.isArray(item.interactions) ? item.interactions : []);
    if (npcCount > 0) {
      ['talk', 'trade', 'craft', 'intel', 'battle'].forEach(action => candidates.add(action));
    }
    sourceActions.forEach(action => {
      const normalized = toText(action, '');
      if (['talk', 'battle', 'trade', 'bid', 'brief', 'intel'].includes(normalized)) candidates.add(normalized);
      if (normalized === 'craft' && (npcCount > 0 || isOfficialCommissionNode)) candidates.add('craft');
    });
    const services = Array.isArray(item.services) ? item.services : [];
    services.forEach(service => {
      const normalized = toText(service, '');
      if (normalized === 'shop' || normalized === 'black_market') candidates.add('trade');
      else if (normalized === 'auction') candidates.add('bid');
      else if (normalized === 'craft' && (npcCount > 0 || isOfficialCommissionNode)) candidates.add('craft');
      else if (normalized === 'battle') candidates.add('battle');
      else if (normalized === 'intel') candidates.add('intel');
      else if (normalized === 'briefing') candidates.add('brief');
    });
    if (toText(item.nodeKind, '') === 'intel') candidates.add('intel');
    if (toText(item.nodeKind, '') === 'administration') candidates.add('brief');
    if (npcCount > 0 && toText(item.nodeKind, '') === 'training') candidates.add('battle');
    return ['talk', 'trade', 'bid', 'craft', 'brief', 'intel', 'battle'].filter(action => candidates.has(action));
  }

  function resolveMapNpcCraftExecutorType(item, npcTarget = '') {
    const nodeName = toText(item && item.name, '');
    const officialCommissionLocations = ['锻造师协会', '制造师协会', '设计师协会', '修理师协会'];
    if (officialCommissionLocations.some(name => nodeName && (nodeName.includes(name) || name.includes(nodeName)))) return 'official';
    if (npcTarget) return 'private';
    return 'self';
  }

  function 构建星图人物动作按钮(动作, 人物条目, 节点项, 选项 = {}) {
    const 输出模式 = toText(选项.输出模式, 'select');
    const 当前地点 = toText(选项.当前地点, '');
    const 当前动作 = toText(选项.当前动作, '');
    const 已选人物 = toText(选项.已选人物, '');
    const 人物名 = toText(人物条目 && 人物条目.name, '');
    const 动作标签 = 输出模式 === 'dispatch'
      ? ({ craft: '委托', intel: '请教', battle: '切磋' }[动作] || getNodeInteractionLabel(动作))
      : getNodeInteractionLabel(动作);
    const 当前类 = 人物名 && 人物名 === 已选人物 && 当前动作 === 动作 ? ' current' : '';
    if (输出模式 === 'dispatch') {
      const 派发动作为委托 = 动作 === 'craft';
      const 派发动作 = 派发动作为委托 ? 'commission' : 动作;
      const 执行者类型 = 派发动作为委托 ? resolveMapNpcCraftExecutorType(节点项, 人物名) : '';
      const 服务文本 = Array.isArray(节点项 && 节点项.services) ? 节点项.services.join('|') : '';
      return `<button type="button" class="map-npc-action-btn map-dispatch-action-btn${当前类}" data-action="${escapeMapHtml(派发动作)}" data-target="${escapeMapHtml(当前地点)}" data-current-loc="${escapeMapHtml(当前地点)}" data-npc-target="${escapeMapHtml(人物名)}" data-executor-type="${escapeMapHtml(执行者类型)}" data-services="${escapeMapHtml(服务文本)}" title="发起${escapeMapHtml(动作标签)}">${escapeMapHtml(动作标签)}</button>`;
    }
    return `<button type="button" class="map-npc-action-btn${当前类}" data-map-npc-select="${escapeMapHtml(人物名)}" data-map-npc-action="${escapeMapHtml(动作)}" title="切换到${escapeMapHtml(动作标签)}">${escapeMapHtml(动作标签)}</button>`;
  }

  function 构建星图在场人物列表HTML(选项 = {}) {
    const snapshot = 选项.snapshot || mapState.snapshot || buildFallbackSnapshot();
    const focusItem = 选项.focusItem || null;
    const detailPanelItem = 选项.detailPanelItem || focusItem;
    const panelMode = toText(选项.panelMode, 'selection') === 'follow' ? 'follow' : 'selection';
    const 输出模式 = toText(选项.输出模式, 'select') === 'dispatch' ? 'dispatch' : 'select';
    const isFreeSelection = !!选项.isFreeSelection;
    const inPreview = !!选项.inPreview;
    const previewCurrentBranch = !!选项.previewCurrentBranch;
    const previewTrailNames = Array.isArray(选项.previewTrailNames) ? 选项.previewTrailNames : [];
    const previewAnchorName = toText(选项.previewAnchorName, '');
    const focusName = toText(选项.focusName, focusItem ? focusItem.name : '未知地点');
    const currentName = toText(选项.currentName, getActualCurrentLoc() || snapshot.currentLoc || '未知地点');
    const rawCurrentName = toText(选项.rawCurrentName, snapshot.currentLocFull || snapshot.currentLoc || currentName);
    const 人物条目列表 = panelMode === 'selection'
      ? (isFreeSelection ? [] : 解析索引人物条目(snapshot, focusName))
      : 解析索引人物条目(snapshot, currentName, rawCurrentName);
    const 可交互人物名列表 = 人物条目列表.filter(条目 => 条目 && 条目.可交互 === true).map(条目 => 条目.name);
    let 已选人物 = toText(mapState.selectedNpc, '');
    if (已选人物 && !可交互人物名列表.includes(已选人物)) 已选人物 = '';
    if (!已选人物 && 可交互人物名列表.length === 1) 已选人物 = 可交互人物名列表[0];
    mapState.selectedNpc = 已选人物;
    const 人物名称列表 = 人物条目列表.map(条目 => 条目.name).filter(Boolean);
    const 当前动作 = toText(mapState.selectedAction, '');
    const 动作节点项 = panelMode === 'selection' ? focusItem : detailPanelItem;
    const 浏览动作列表 = getNpcActionCandidates(动作节点项, 可交互人物名列表.length);
    const 人物节点文本 = panelMode === 'selection' ? (isFreeSelection ? '自由坐标' : focusName) : (currentName || '未知地点');
    const 构建标题HTML = (数量 = 人物条目列表.length, 选中人物 = 已选人物) => {
      const 徽章文本 = 选中人物 ? `已选 ${选中人物}` : `${Math.max(0, toNumber(数量, 0))} 人`;
      const 标题文本 = `在场人物 · ${人物节点文本}`;
      return `<div class="map-npc-roster-head"><span class="map-npc-roster-title"><span class="map-npc-roster-title-text" title="${escapeMapHtml(标题文本)}">${escapeMapHtml(标题文本)}</span></span><span class="map-npc-roster-badge">${escapeMapHtml(徽章文本)}</span></div>`;
    };
    const 空状态HTML = (内容, 数量 = 0, 选中人物 = '') => `${构建标题HTML(数量, 选中人物)}<div class="map-npc-empty">${escapeMapHtml(内容)}</div>`;
    if (isFreeSelection) {
      return { html: 空状态HTML('自由坐标 · 无固定人物'), count: 0, nodeText: 人物节点文本, charactersText: '无', selectedNpc: '', entries: [] };
    }
    if (panelMode === 'follow' && inPreview && !previewCurrentBranch) {
      return { html: 空状态HTML(`远端子图预览 · 人物来自【${currentName || '未知地点'}】`, 人物条目列表.length, 已选人物), count: 人物条目列表.length, nodeText: 人物节点文本, charactersText: 人物名称列表.join('、') || '无', selectedNpc: 已选人物, entries: 人物条目列表 };
    }
    if (inPreview && !previewCurrentBranch) {
      return { html: 空状态HTML(`远端预览 · 先回到 ${previewTrailNames[0] || previewAnchorName}`, 人物条目列表.length, 已选人物), count: 人物条目列表.length, nodeText: 人物节点文本, charactersText: 人物名称列表.join('、') || '无', selectedNpc: 已选人物, entries: 人物条目列表 };
    }
    if (!focusItem || !人物条目列表.length) {
      return { html: 空状态HTML(`${focusName} · 0 人`), count: 0, nodeText: 人物节点文本, charactersText: '无', selectedNpc: '', entries: [] };
    }

    const 列表HTML = 人物条目列表.map(人物条目 => {
      const 人物名 = toText(人物条目 && 人物条目.name, '');
      const 选中类 = 人物名 && 人物名 === 已选人物 ? ' current' : '';
      const 可交互人物 = 人物条目 && 人物条目.可交互 === true;
      const 人物信息 = 格式化人物卡信息(人物条目);
      const 信息HTML = 人物信息 ? `<div class="map-npc-meta${可交互人物 ? '' : ' is-location'}">${escapeMapHtml(人物信息)}</div>` : '';
      const 名称HTML = 输出模式 === 'dispatch'
        ? `<button type="button" class="map-npc-name clickable${选中类}" data-preview="角色档案：${escapeMapHtml(人物名)}" title="角色档案：${escapeMapHtml(人物名)}">${escapeMapHtml(人物名)}</button>`
        : (可交互人物
          ? `<button type="button" class="map-npc-name${选中类}" data-map-npc-select="${escapeMapHtml(人物名)}" title="选中 ${escapeMapHtml(人物名)}">${escapeMapHtml(人物名)}</button>`
          : `<span class="map-npc-name">${escapeMapHtml(人物名)}</span>`);
      const 档案按钮 = 输出模式 === 'dispatch'
        ? `<button type="button" class="map-npc-action-btn clickable" data-preview="角色档案：${escapeMapHtml(人物名)}">档案</button>`
        : '';
      const 动作HTML = 可交互人物 && 浏览动作列表.length
        ? `<div class="map-npc-actions">${档案按钮}${浏览动作列表.map(动作 => 构建星图人物动作按钮(动作, 人物条目, 动作节点项, {
            输出模式,
            当前地点: 人物节点文本,
            当前动作,
            已选人物
          })).join('')}</div>`
        : (可交互人物 ? `<div class="map-npc-meta">当前无可互动人物。</div>` : '');
      return `<div class="map-npc-card${选中类}"><div class="map-npc-card-head">${名称HTML}<span class="map-event-chip${选中类 ? ' live' : ''}">${选中类 ? '已选' : (可交互人物 ? '在场' : '子节点')}</span></div>${信息HTML}${动作HTML}</div>`;
    }).join('');
    return {
      html: `${构建标题HTML(人物条目列表.length, 已选人物)}${列表HTML}`,
      count: 人物条目列表.length,
      nodeText: 人物节点文本,
      charactersText: 人物名称列表.join('、') || '无',
      selectedNpc: 已选人物,
      entries: 人物条目列表
    };
  }

  function 构建星图外壳焦点HTML(snapshot, focusItem, 选项 = {}) {
    const focusName = toText(选项.焦点名称, focusItem ? focusItem.name : '未知地点');
    const 地图名称 = getMapDisplayName(snapshot.currentMapId, snapshot.mapMeta);
    const 当前地点 = getActualCurrentLoc();
    const 焦点规范名 = 归一地点名(focusName);
    const 当前规范名 = 归一地点名(当前地点);
    const 是否当前位置 = !!焦点规范名 && (焦点规范名 === 当前规范名 || 当前规范名.endsWith(`-${焦点规范名}`));
    const 类型文本 = focusItem ? toText(focusItem.type, '节点') : (选项.自由坐标 ? '自由坐标点' : '节点');
    const 运营信息 = 构建星图焦点运营信息(snapshot, focusItem, focusName);
    const 地貌摘要 = [类型文本, toText(选项.地形, '')].filter(Boolean).join(' · ') || 类型文本;
    const 元信息HTML = [
      ['掌控', 运营信息.掌控],
      ['防务', 运营信息.防务],
      ['经济', 运营信息.经济],
      ['供给', 运营信息.供给],
      ['价格', 运营信息.价格],
      ['成交', 运营信息.成交]
    ].map(([标签, 值]) => `<span class="mvu-map-focus-meta-item"><b>${escapeMapHtml(标签)}</b><em title="${escapeMapHtml(值)}">${escapeMapHtml(toText(值, '无'))}</em></span>`).join('');
    return `
        <div class="mvu-map-focus-card">
          <div class="mvu-map-focus-head">
            <div>
              <span>${escapeMapHtml(是否当前位置 ? '当前位置' : '地图焦点')}</span>
              <strong title="${escapeMapHtml(focusName)}">${escapeMapHtml(focusName)}</strong>
            </div>
            <b class="${是否当前位置 ? 'is-live' : 'is-gold'}">${escapeMapHtml(是否当前位置 ? '当前' : 选项.自由坐标 ? '坐标' : '选中')}</b>
          </div>
          <div class="mvu-map-focus-summary">
            <div class="mvu-map-focus-line is-primary">
              <b title="${escapeMapHtml(地图名称)}">${escapeMapHtml(地图名称)}</b>
              <span title="${escapeMapHtml(地貌摘要)}">${escapeMapHtml(地貌摘要)}</span>
            </div>
          </div>
          <div class="mvu-map-focus-meta">${元信息HTML}</div>
        </div>
      `;
  }

  function renderMapTerrain() {
    function escapeSvgText(value = '') {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function svgToCssDataUri(svg) {
      return `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}")`;
    }

    function getDebugMapBackdropPalette(mapId = mapState.currentMapId) {
      return { base: '#ccb089', grid: '#a88a61', line: '#674729', soft: '#ead8bc', major: '#c98d52', minor: '#a5b78f', accent: '#4d89a5', ink: '#1f2d37' };
    }

    function hexToRgb(hex = '#000000') {
      const normalized = String(hex || '').trim();
      const short = normalized.match(/^#([0-9a-fA-F]{3})$/);
      if (short) {
        return {
          r: parseInt(short[1][0] + short[1][0], 16),
          g: parseInt(short[1][1] + short[1][1], 16),
          b: parseInt(short[1][2] + short[1][2], 16)
        };
      }
      const full = normalized.match(/^#([0-9a-fA-F]{6})$/);
      if (full) {
        return {
          r: parseInt(full[1].slice(0, 2), 16),
          g: parseInt(full[1].slice(2, 4), 16),
          b: parseInt(full[1].slice(4, 6), 16)
        };
      }
      return { r: 0, g: 0, b: 0 };
    }

    function mixHexColor(sourceHex, targetHex, ratio = 0.5) {
      const source = hexToRgb(sourceHex);
      const target = hexToRgb(targetHex);
      const amount = clamp(toNumber(ratio, 0.5), 0, 1);
      const mix = channel => Math.round(source[channel] + (target[channel] - source[channel]) * amount);
      return `rgb(${mix('r')},${mix('g')},${mix('b')})`;
    }

    function buildDebugMapBackdropSvg(mapId = mapState.currentMapId, snapshot = mapState.snapshot) {
      const activeSnapshot = snapshot || mapState.snapshot || buildFallbackSnapshot();
      const bounds = activeSnapshot && activeSnapshot.bounds ? activeSnapshot.bounds : (mapState.bounds || DEFAULT_IMAGE_BOUNDS);
      const safeBounds = {
        minX: toNumber(bounds.minX, 0),
        minY: toNumber(bounds.minY, 0),
        width: Math.max(1, toNumber(bounds.width, WORLD_IMAGE_WIDTH)),
        height: Math.max(1, toNumber(bounds.height, WORLD_IMAGE_HEIGHT))
      };
      const palette = getDebugMapBackdropPalette(mapId);
      const bgTop = mixHexColor('#050a11', palette.ink, 0.12);
      const bgBottom = mixHexColor('#08131d', palette.accent, 0.10);
      const minorGrid = mixHexColor(palette.accent, '#c9f4ff', 0.26);
      const majorGrid = mixHexColor(palette.accent, '#f2fdff', 0.40);
      const frameLine = mixHexColor(palette.accent, '#ffffff', 0.28);
      const minorPatternW = Math.max(24, safeBounds.width / 16).toFixed(2);
      const minorPatternH = Math.max(24, safeBounds.height / 10).toFixed(2);
      const majorPatternW = Math.max(48, safeBounds.width / 8).toFixed(2);
      const majorPatternH = Math.max(48, safeBounds.height / 5).toFixed(2);
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="${safeBounds.minX} ${safeBounds.minY} ${safeBounds.width} ${safeBounds.height}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="bg-${escapeSvgText(mapId)}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${bgTop}" />
              <stop offset="100%" stop-color="${bgBottom}" />
            </linearGradient>
            <pattern id="minor-${escapeSvgText(mapId)}" width="${minorPatternW}" height="${minorPatternH}" patternUnits="userSpaceOnUse">
              <path d="M ${minorPatternW} 0 L 0 0 0 ${minorPatternH}" fill="none" stroke="${minorGrid}" stroke-opacity="0.12" stroke-width="1.1" />
            </pattern>
            <pattern id="major-${escapeSvgText(mapId)}" width="${majorPatternW}" height="${majorPatternH}" patternUnits="userSpaceOnUse">
              <path d="M ${majorPatternW} 0 L 0 0 0 ${majorPatternH}" fill="none" stroke="${majorGrid}" stroke-opacity="0.20" stroke-width="1.6" />
            </pattern>
          </defs>
          <rect x="${safeBounds.minX}" y="${safeBounds.minY}" width="${safeBounds.width}" height="${safeBounds.height}" fill="url(#bg-${escapeSvgText(mapId)})" />
          <rect x="${safeBounds.minX}" y="${safeBounds.minY}" width="${safeBounds.width}" height="${safeBounds.height}" fill="url(#minor-${escapeSvgText(mapId)})" opacity="1" />
          <rect x="${safeBounds.minX}" y="${safeBounds.minY}" width="${safeBounds.width}" height="${safeBounds.height}" fill="url(#major-${escapeSvgText(mapId)})" opacity="1" />
          <rect x="${(safeBounds.minX + 6).toFixed(2)}" y="${(safeBounds.minY + 6).toFixed(2)}" width="${(safeBounds.width - 12).toFixed(2)}" height="${(safeBounds.height - 12).toFixed(2)}" fill="none" stroke="${frameLine}" stroke-opacity="0.22" stroke-width="2.4" vector-effect="non-scaling-stroke" />
        </svg>
      `.trim();
    }

    function getMapBackdropCssImage(mapId = mapState.currentMapId, snapshot = mapState.snapshot) {
      if (mapId && mapId !== 'map_douluo_world' && (mapId.includes('preview') || mapId.includes('city') || mapId.includes('district') || mapId.includes('region'))) return svgToCssDataUri(buildDebugMapBackdropSvg(mapId, snapshot));
      return `url('${ASSETS.world}')`;
    }

    const terrainHtml = `
      <div class='map-terrain-art'></div>
      <div class='map-terrain-mask'></div>
    `;
    const svgHtml = `<div class='map-terrain-svg'></div><div class='map-terrain-mask'></div>`;

    const activeSnapshot = mapState.snapshot || buildFallbackSnapshot();
    const bgToken = `${mapState.currentMapId}|${toText(deepGet(activeSnapshot, 'mapMeta.name', ''), '')}|${Array.isArray(activeSnapshot.items) ? activeSnapshot.items.length : 0}`;
    const terrainCache = renderMapTerrain.__cache || (renderMapTerrain.__cache = { token: '', bgImage: '' });
    if (terrainCache.token !== bgToken) {
      terrainCache.bgImage = getMapBackdropCssImage(mapState.currentMapId, activeSnapshot);
      terrainCache.token = bgToken;
    }
    const bgImage = terrainCache.bgImage;
    getMapUiElements('[data-map-terrain]').forEach(el => {
      const isSvgMode = bgImage.includes('data:image/svg+xml');
      const expectedToken = isSvgMode ? 'terrain:svg' : 'terrain:v2';

      if (el.dataset.renderToken !== expectedToken) {
        el.innerHTML = isSvgMode ? svgHtml : terrainHtml;
        el.dataset.renderToken = expectedToken;
      }

      const art = el.querySelector(isSvgMode ? '.map-terrain-svg' : '.map-terrain-art');
      if (art && art.dataset.bgToken !== bgToken) {
        art.style.backgroundImage = bgImage;
        art.dataset.bgToken = bgToken;
      }
    });
    getMapUiElements('.map-mini-art').forEach(el => {
      if (el.dataset.bgToken !== bgToken) {
        el.style.backgroundImage = bgImage;
        el.dataset.bgToken = bgToken;
      }
    });
  }

  function getMapNodeLabelOffset(name) {
    const key = toText(name, '');
    if (key === '史莱克新城') return { x: 20, y: -14 };
    if (key === '史莱克城遗址') return { x: -20, y: 12 };
    if (key === '史莱克城') return { x: 0, y: 0 };
    return { x: 0, y: 0 };
  }

  function 获取地图标签边缘测量签名(画布, 结构签名 = '') {
    if (!画布) return '';
    return [
      结构签名 || 画布.querySelector('[data-map-node-layer]')?.dataset.structureKey || '',
      mapState.currentMapId || '',
      mapState.layer || '',
      Math.round(toNumber(画布.clientWidth, 0)),
      Math.round(toNumber(画布.clientHeight, 0)),
    ].join('|');
  }

  function 更新地图节点标签边缘状态(指定画布 = null, 选项 = {}) {
    const 强制刷新 = !!(选项 && 选项.force);
    const 画布列表 = 指定画布 ? [指定画布] : getMapUiElements('.map-canvas.interactive-map');
    画布列表.forEach(画布 => {
      if (!画布 || !画布.getBoundingClientRect) return;
      const 测量签名 = 获取地图标签边缘测量签名(画布, 选项 && 选项.structureKey);
      if (!强制刷新 && 画布.dataset.mapEdgeMeasureKey === 测量签名) return;
      const 画布矩形 = 画布.getBoundingClientRect();
      const 边缘余量 = 8;
      getScopedMapUiElements(画布, '.map-node').forEach(节点 => {
        const 标签 = 节点.querySelector('.map-node-label');
        if (!标签 || !标签.getBoundingClientRect) {
          setMapNodeClass(节点, 'edge-left', false);
          setMapNodeClass(节点, 'edge-right', false);
          setMapNodeClass(节点, 'edge-top', false);
          setMapNodeClass(节点, 'edge-bottom', false);
          return;
        }
        const 标签矩形 = 标签.getBoundingClientRect();
        setMapNodeClass(节点, 'edge-left', 标签矩形.left < 画布矩形.left + 边缘余量);
        setMapNodeClass(节点, 'edge-right', 标签矩形.right > 画布矩形.right - 边缘余量);
        setMapNodeClass(节点, 'edge-top', 标签矩形.top < 画布矩形.top + 边缘余量);
        setMapNodeClass(节点, 'edge-bottom', 标签矩形.bottom > 画布矩形.bottom - 边缘余量);
      });
      画布.dataset.mapEdgeMeasureKey = 测量签名;
    });
  }

  function updateNodeHtmlClasses(el, item, isCurrent, isOrigin) {
    const isEnterable = !!(item && item.canEnter);
    setMapNodeClass(el, 'current', isCurrent);
    setMapNodeClass(el, 'origin', isOrigin);
    setMapNodeClass(el, 'enterable', isEnterable);
  }

  function renderMapNodeLayer() {
    const visibleItems = getRenderableItems();
    const visibleCurrentNode = getVisibleCurrentNode();
    const structureKey = [
      mapState.currentMapId,
      mapState.layer,
      visibleItems.map(item => [
        toText(item && item.name, ''),
        item && item.canEnter ? '1' : '0',
        item && item.major ? '1' : '0',
        toText(item && item.state, '')
      ].join(':')).join('|')
    ].join('|');
    getMapUiElements('[data-map-node-layer]').forEach(el => {
      const 节点结构已变化 = el.dataset.structureKey !== structureKey;
      if (节点结构已变化) {
        el.innerHTML = visibleItems.map(item => {
          const pos = projectCoord({ x: item.x, y: item.y });
          const left = (pos.left * 100).toFixed(2);
          const top = (pos.top * 100).toFixed(2);
          const rawState = toText(item && item.state, '');
          const stateToken = /^(intact|ruins|rebuild|rebuilt)$/i.test(rawState) ? rawState.toLowerCase() : '';
          const stateText = stateToken ? { intact: '完整', ruins: '遗址', rebuild: '重建中', rebuilt: '已重建' }[stateToken] : rawState;
          const pointKindClass = `point-kind-${toText(item.pointKind, 'node').replace(/[^a-z0-9_-]/gi, '') || 'node'}`;
          const classes = ['map-node', 'point', pointKindClass];
          if (stateToken) classes.push(`state-${stateToken}`);
          const labelOffset = getMapNodeLabelOffset(item && item.name);
          const isEnterable = !!(item && item.canEnter);
          const stateTag = stateToken && stateToken !== 'intact' ? `<span class='map-node-state-tag is-${stateToken}'>${htmlEscape(stateText)}</span>` : '';
          const label = `<span class='map-node-label'>${htmlEscape(item.name)}${isEnterable ? `<span class='map-node-enter-tag'>↘</span>` : ''}${stateTag}</span>`;
          return `<button type='button' class='${classes.join(' ')}' data-node='${htmlEscape(item.name)}' style='left:${left}%;top:${top}%;--label-offset-x:${toNumber(labelOffset && labelOffset.x, 0)}px;--label-offset-y:${toNumber(labelOffset && labelOffset.y, 0)}px;'><span class='map-dot${item.major ? ' major' : ''}'></span>${label}</button>`;
        }).join('');
        el.dataset.structureKey = structureKey;
      }
      
      // Efficiently update dynamic classes without touching innerHTML
      const nodeEls = getScopedMapUiElements(el, '.map-node');
      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const nodeEl = nodeEls[i];
        if (nodeEl) {
          updateNodeHtmlClasses(nodeEl, item, !mapState.selectedFreePoint && item.name === mapState.selectedNode, !mapState.currentFreePoint && item.name === visibleCurrentNode);
        }
      }
      const 关联画布 = el.closest('.map-canvas.interactive-map');
      if (关联画布) {
        if (节点结构已变化) delete 关联画布.dataset.mapEdgeMeasureKey;
      }
    });
  }

  function renderMiniMapState(canvasEl = getPrimaryMapCanvas()) {
    const activeCanvas = canvasEl || getPrimaryMapCanvas();
    if (!activeCanvas || !activeCanvas.clientWidth || !activeCanvas.clientHeight) return;

    const topLeft = convertMapLocalPointToCanvasRatio(0, 0, activeCanvas);
    const bottomRight = convertMapLocalPointToCanvasRatio(activeCanvas.clientWidth, activeCanvas.clientHeight, activeCanvas);
    const viewportLeft = clamp(Math.min(topLeft.left, bottomRight.left), 0, 1);
    const viewportTop = clamp(Math.min(topLeft.top, bottomRight.top), 0, 1);
    const viewportRight = clamp(Math.max(topLeft.left, bottomRight.left), 0, 1);
    const viewportBottom = clamp(Math.max(topLeft.top, bottomRight.top), 0, 1);
    const viewportLeftCss = `${viewportLeft * 100}%`;
    const viewportTopCss = `${viewportTop * 100}%`;
    const viewportWidthCss = `${Math.max(2, (viewportRight - viewportLeft) * 100)}%`;
    const viewportHeightCss = `${Math.max(2, (viewportBottom - viewportTop) * 100)}%`;

    getMapUiElements('[data-map-mini-viewport]').forEach(el => {
      setMapNodeStyle(el, 'left', viewportLeftCss);
      setMapNodeStyle(el, 'top', viewportTopCss);
      setMapNodeStyle(el, 'width', viewportWidthCss);
      setMapNodeStyle(el, 'height', viewportHeightCss);
    });

    const setMarker = (selector, coord) => {
      const ratio = coord ? projectCoord(coord) : null;
      getMapUiElements(selector).forEach(marker => {
        if (!ratio || !Number.isFinite(ratio.left) || !Number.isFinite(ratio.top)) {
          setMapNodeClass(marker, 'is-hidden', true);
          return;
        }
        setMapNodeClass(marker, 'is-hidden', false);
        setMapNodeStyle(marker, 'left', `${ratio.left * 100}%`);
        setMapNodeStyle(marker, 'top', `${ratio.top * 100}%`);
      });
    };

    setMarker('[data-map-mini-current]', hasActivePreview() ? null : getCurrentCoord());
    const targetCoord = mapState.selectedFreePoint
      ? mapState.selectedFreePoint
      : (mapState.selectedNode && mapState.selectedNode !== getVisibleCurrentNode() ? getMapNodeCoord(mapState.selectedNode) : null);
    setMarker('[data-map-mini-target]', targetCoord);
  }

  function updateMapFromMiniMapClientPoint(miniWorldEl, clientX, clientY) {
    if (!miniWorldEl || clientX === null || clientY === null || clientX === undefined || clientY === undefined) return;
    const rect = typeof miniWorldEl.getBoundingClientRect === 'function' ? miniWorldEl.getBoundingClientRect() : null;
    if (!rect || !rect.width || !rect.height) return;
    const centerClientX = clientX - toNumber(miniMapDragState.offsetX, 0);
    const centerClientY = clientY - toNumber(miniMapDragState.offsetY, 0);
    const left = clamp((centerClientX - rect.left) / rect.width, 0, 1);
    const top = clamp((centerClientY - rect.top) / rect.height, 0, 1);
    centerMapOnRatio(left, top, getPrimaryMapCanvas());
    applyMapWorldTransform({ updateReadout: !miniMapDragState.active, updateMiniMap: true });
  }

  function renderMapCrosshair(activeCanvas = null) {
    const currentCanvas = activeCanvas || mapDragState.sourceCanvas || mapState.hoverCanvas || null;
    getActiveMapCanvases().forEach(canvasEl => {
      const crosshairEls = getScopedMapUiElements(canvasEl, '[data-map-crosshair]');
      if (!crosshairEls.length) return;
      const width = toNumber(canvasEl.clientWidth, 0);
      const height = toNumber(canvasEl.clientHeight, 0);
      crosshairEls.forEach(crosshair => {
        if (!currentCanvas || currentCanvas !== canvasEl || mapState.cursorClientX === null || mapState.cursorClientY === null) {
          setMapNodeClass(crosshair, 'is-hidden', true);
          return;
        }
        let localX = null;
        let localY = null;
        if (currentCanvas === mapState.hoverCanvas && Number.isFinite(mapState.hoverLocalX) && Number.isFinite(mapState.hoverLocalY)) {
          localX = mapState.hoverLocalX;
          localY = mapState.hoverLocalY;
        } else {
          const rect = canvasEl.getBoundingClientRect();
          localX = mapState.cursorClientX - rect.left;
          localY = mapState.cursorClientY - rect.top;
        }
        if (localX < 0 || localY < 0 || localX > width || localY > height) {
          setMapNodeClass(crosshair, 'is-hidden', true);
          return;
        }
        setMapNodeClass(crosshair, 'is-hidden', false);
        setMapNodeStyle(crosshair, '--cross-x', `${(localX / Math.max(width, 1)) * 100}%`);
        setMapNodeStyle(crosshair, '--cross-y', `${(localY / Math.max(height, 1)) * 100}%`);
      });
    });
  }

  function updateMapCoordinateReadout(canvasEl = null) {
    const activeCanvas = canvasEl || mapDragState.sourceCanvas || mapState.hoverCanvas || getPrimaryMapCanvas();
    renderMapCrosshair(activeCanvas);
    const tooltipEl = activeCanvas ? getScopedMapUiElements(activeCanvas, '[data-map-hover-tooltip]')[0] : null;
    const tooltipCoordEl = tooltipEl ? getScopedMapUiElements(tooltipEl, '[data-map-hover-coord]')[0] : null;
    const tooltipTerrainEl = tooltipEl ? getScopedMapUiElements(tooltipEl, '[data-map-hover-terrain]')[0] : null;
    const hideTooltip = () => { if (tooltipEl) setMapNodeClass(tooltipEl, 'is-hidden', true); };
    if (!activeCanvas || !activeCanvas.clientWidth || !activeCanvas.clientHeight) return;
    const focusCoord = getSelectedCoord();
    const focusImageCoord = convertMapCoordToImageCoord(focusCoord);
    const centerRatio = convertMapLocalPointToCanvasRatio(activeCanvas.clientWidth / 2, activeCanvas.clientHeight / 2, activeCanvas);
    const centerImageCoord = convertMapRatioToImageCoord(centerRatio.left, centerRatio.top);
    setMapText('[data-map-focus-coord]', `焦点 图 ${focusImageCoord.x},${focusImageCoord.y}`);
    setMapText('[data-map-center-coord]', `视口 图 ${centerImageCoord.x},${centerImageCoord.y}`);
    if (mapState.cursorClientX === null || mapState.cursorClientY === null) {
      hideTooltip();
      setMapText('[data-map-cursor-coord]', '游标 --,--');
      return;
    }
    if (activeCanvas === mapState.hoverCanvas && mapState.hoverCoord) {
      const hoverRatio = Number.isFinite(mapState.hoverLocalX) && Number.isFinite(mapState.hoverLocalY)
        ? convertMapLocalPointToCanvasRatio(mapState.hoverLocalX, mapState.hoverLocalY, activeCanvas)
        : projectCoord(mapState.hoverCoord);
      const hoverImageCoord = convertMapRatioToImageCoord(hoverRatio.left, hoverRatio.top);
      const terrainMapId = toText(deepGet(mapState.snapshot, 'currentMapId', mapState.currentMapId), mapState.currentMapId);
      const hoverTerrainInfo = resolveTerrainInfoByCoord(mapState.hoverCoord, terrainMapId);
      const hoverTerrainText = formatTerrainText(hoverTerrainInfo, terrainMapId);
      setMapText('[data-map-cursor-coord]', `游标 图 ${hoverImageCoord.x},${hoverImageCoord.y}`);
      if (tooltipEl) {
        setMapNodeClass(tooltipEl, 'is-hidden', false);
        setMapNodeStyle(tooltipEl, 'left', `${Math.max(8, Math.min(activeCanvas.clientWidth - 24, toNumber(mapState.hoverLocalX, 0)))}px`);
        setMapNodeStyle(tooltipEl, 'top', `${Math.max(8, Math.min(activeCanvas.clientHeight - 24, toNumber(mapState.hoverLocalY, 0)))}px`);
      }
      setMapNodeText(tooltipCoordEl, `${hoverImageCoord.x},${hoverImageCoord.y}`);
      setMapNodeText(tooltipTerrainEl, `地形：${hoverTerrainText || '无'}`);
      return;
    }
    const point = resolveMapClientPoint(activeCanvas, mapState.cursorClientX, mapState.cursorClientY);
    if (!point || !point.inside) {
      hideTooltip();
      setMapText('[data-map-cursor-coord]', '游标 --,--');
      return;
    }
    const cursorRatio = convertMapLocalPointToCanvasRatio(point.localX, point.localY, activeCanvas);
    const cursorImageCoord = convertMapRatioToImageCoord(cursorRatio.left, cursorRatio.top);
    hideTooltip();
    setMapText('[data-map-cursor-coord]', `游标 图 ${cursorImageCoord.x},${cursorImageCoord.y}`);
  }

  function renderMapFreeMarkers() {
    getActiveMapCanvases().forEach(canvasEl => {
      const placeMarker = (selector, point) => {
        getScopedMapUiElements(canvasEl, selector).forEach(marker => {
          if (!point) {
            setMapNodeClass(marker, 'is-hidden', true);
            return;
          }
          const pos = convertMapCoordToLocalPoint(point, canvasEl);
          if (!pos) {
            setMapNodeClass(marker, 'is-hidden', true);
            return;
          }
          setMapNodeClass(marker, 'is-hidden', false);
          setMapNodeStyle(marker, 'left', `${pos.left * 100}%`);
          setMapNodeStyle(marker, 'top', `${pos.top * 100}%`);
        });
      };
      placeMarker('[data-map-free-current]', mapState.currentFreePoint);
      placeMarker('[data-map-free-target]', mapState.selectedFreePoint);
    });
  }

  function renderMapVisualState() {
    renderMapNodeLayer();
    renderMapFreeMarkers();
    getMapUiElements('[data-map-layer-pill]').forEach(pill => {
      setMapNodeClass(pill, 'current', pill.dataset.mapLayerPill === mapState.layer);
    });
    setMapText('[data-map-layer-label]', mapLayerLabels[mapState.layer]);
    setMapText('[data-map-visible-nodes]', String(getVisibleMapNodeCount()));
  }

  const worldTravelGridCellProfileCache = new Map();

  function getWorldTravelGridCellProfile(gx, gy) {
    const safeGx = Math.floor(toNumber(gx, NaN));
    const safeGy = Math.floor(toNumber(gy, NaN));
    if (!Number.isFinite(safeGx) || !Number.isFinite(safeGy)) return null;
    const cacheKey = `${safeGx},${safeGy}`;
    if (worldTravelGridCellProfileCache.has(cacheKey)) return worldTravelGridCellProfileCache.get(cacheKey);
    const gridData = getMainMapTerrainGridData('map_douluo_world');
    if (!gridData || safeGx < 0 || safeGy < 0 || safeGx >= gridData.gridWidth || safeGy >= gridData.gridHeight) return null;
    const center = {
      x: Math.round(((safeGx + 0.5) / Math.max(1, gridData.gridWidth)) * Math.max(1, WORLD_IMAGE_WIDTH - 1)),
      y: Math.round(((safeGy + 0.5) / Math.max(1, gridData.gridHeight)) * Math.max(1, WORLD_IMAGE_HEIGHT - 1))
    };
    const info = resolveTerrainInfoByCoord(center, 'map_douluo_world');
    const terrainName = toText(info && info.name, '');
    const terrainTypes = Array.isArray(info && info.terrainTypes) ? info.terrainTypes.map(item => toText(item, '')).filter(Boolean) : [];
    const gridTerrain = toText(deepGet(info, 'grid.terrain', deepGet(info, 'gridTerrain', '')), '');
    const terrainText = [terrainName, ...terrainTypes].join('/');
    const isWater = gridTerrain === 'water' || /(海|洋|湾|港|河|江|湖|水域|海域|外海|内海|海峡)/.test(terrainText);
    const profile = {
      gx: safeGx,
      gy: safeGy,
      center,
      info,
      terrainName,
      terrainTypes,
      gridTerrain,
      isWater
    };
    worldTravelGridCellProfileCache.set(cacheKey, profile);
    return profile;
  }

  function buildWorldTravelGridNodeKey(gx, gy) {
    return `${gx},${gy}`;
  }

  function buildWorldTravelPathSegmentSummary(segments) {
    const labels = Array.isArray(segments)
      ? segments
        .map(segment => segment && segment.type === 'water' ? '海路渡运' : '陆路接驳')
        .filter(Boolean)
      : [];
    const compact = [];
    labels.forEach(label => {
      if (compact[compact.length - 1] !== label) compact.push(label);
    });
    if (!compact.length) return '';
    if (compact.length === 1) return compact[0] === '海路渡运' ? '自动规划：全程海路' : '自动规划：全程陆路';
    return `自动规划：${compact.join(' → ')}`;
  }

  const worldTravelPathCache = new Map();

  function findWorldTravelGridPath(startNode, endNode, options = {}) {
    const gridData = getMainMapTerrainGridData('map_douluo_world');
    if (!gridData || !startNode || !endNode) return null;
    const allowWater = options.allowWater !== false;
    const cacheKey = `${startNode.gx},${startNode.gy}-${endNode.gx},${endNode.gy}-${allowWater}`;
    if (worldTravelPathCache.has(cacheKey)) {
      return worldTravelPathCache.get(cacheKey);
    }
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];
    const startKey = buildWorldTravelGridNodeKey(startNode.gx, startNode.gy);
    const goalKey = buildWorldTravelGridNodeKey(endNode.gx, endNode.gy);
    const open = [startKey];
    const cameFrom = new Map();
    const gScore = new Map([[startKey, 0]]);
    const fScore = new Map([[startKey, Math.hypot(endNode.gx - startNode.gx, endNode.gy - startNode.gy)]]);

    while (open.length) {
      let bestIndex = 0;
      for (let i = 1; i < open.length; i += 1) {
        if ((fScore.get(open[i]) ?? Infinity) < (fScore.get(open[bestIndex]) ?? Infinity)) bestIndex = i;
      }
      const currentKey = open.splice(bestIndex, 1)[0];
      const [cxText, cyText] = currentKey.split(',');
      const currentNode = { gx: Number(cxText), gy: Number(cyText) };
      if (currentKey === goalKey) {
        const path = [currentNode];
        let traceKey = currentKey;
        while (cameFrom.has(traceKey)) {
          traceKey = cameFrom.get(traceKey);
          const [txText, tyText] = traceKey.split(',');
          path.push({ gx: Number(txText), gy: Number(tyText) });
        }
        const finalRes = path.reverse();
        worldTravelPathCache.set(cacheKey, finalRes);
        return finalRes;
      }
      for (const [dx, dy] of dirs) {
        const ngx = currentNode.gx + dx;
        const ngy = currentNode.gy + dy;
        if (ngx < 0 || ngy < 0 || ngx >= gridData.gridWidth || ngy >= gridData.gridHeight) continue;
        const nextCell = getWorldTravelGridCellProfile(ngx, ngy);
        if (!nextCell) continue;
        if (!allowWater && nextCell.isWater) continue;
        const nextKey = buildWorldTravelGridNodeKey(ngx, ngy);
        const moveDifficulty = Math.max(1, toNumber(nextCell.info && nextCell.info.movementDifficulty, 1));
        const terrainFactor = nextCell.isWater ? 3.2 : (1 + Math.max(0, moveDifficulty - 1) * 0.05);
        const stepCost = (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1) * terrainFactor;
        const tentativeScore = (gScore.get(currentKey) ?? Infinity) + stepCost;
        if (tentativeScore >= (gScore.get(nextKey) ?? Infinity)) continue;
        cameFrom.set(nextKey, currentKey);
        gScore.set(nextKey, tentativeScore);
        fScore.set(nextKey, tentativeScore + Math.hypot(endNode.gx - ngx, endNode.gy - ngy));
        if (!open.includes(nextKey)) open.push(nextKey);
      }
    }
    return null;
  }

  function buildWorldTravelRouteProfile(startCoord, endCoord, mapId = 'map_douluo_world') {
    if (toText(mapId, 'map_douluo_world') !== 'map_douluo_world') return null;
    const startGrid = resolveMainMapTerrainGridInfo(startCoord, mapId);
    const endGrid = resolveMainMapTerrainGridInfo(endCoord, mapId);
    if (!startGrid || !endGrid) return null;
    const startNode = { gx: startGrid.gridX, gy: startGrid.gridY };
    const endNode = { gx: endGrid.gridX, gy: endGrid.gridY };
    const landOnlyPath = findWorldTravelGridPath(startNode, endNode, { allowWater: false });
    const finalPath = landOnlyPath || findWorldTravelGridPath(startNode, endNode, { allowWater: true });
    if (!finalPath || !finalPath.length) return null;
    const segments = [];
    finalPath.forEach(node => {
      const cell = getWorldTravelGridCellProfile(node.gx, node.gy);
      const type = cell && cell.isWater ? 'water' : 'land';
      const last = segments[segments.length - 1];
      if (last && last.type === type) {
        last.cells += 1;
      } else {
        segments.push({ type, cells: 1 });
      }
    });
    const waterCells = segments.filter(segment => segment.type === 'water').reduce((sum, segment) => sum + segment.cells, 0);
    const landCells = Math.max(0, finalPath.length - waterCells);
    return {
      startGrid: startNode,
      endGrid: endNode,
      path: finalPath,
      segments,
      requiresSea: waterCells > 0,
      waterCells,
      landCells,
      summary: buildWorldTravelPathSegmentSummary(segments)
    };
  }

  function chooseMapTravelMethod(distance, travelContext = null) {
    const ctx = travelContext || buildMapTravelContext(null, mapState.currentMapId);
    if (ctx && ctx.shipEligible) return '远洋巨轮';
    if (distance <= 35) return '步行';
    if (distance <= 120) return '魂导汽车';
    if (distance <= 450) return '魂导列车';
    if (distance <= 1000) return '飞行(机甲/斗铠)';
    return '空间传送(极限斗罗)';
  }

  function formatMapTravelDuration(ticks) {
    const totalMinutes = ticks * 10;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
  }

  function isSelectionCurrentBranch() {
    if (mapState.selectedFreePoint) return sameCoord(getCurrentCoord(), mapState.selectedFreePoint);
    if (mapState.currentFreePoint) {
      return false;
    }
    if (判断地图节点为精确当前位置(mapState.selectedNode)) return true;
    if (!mapState.selectedNode || !mapState.currentNode) return true;
    return mapState.selectedNode === getVisibleCurrentNode();
  }

  function getTravelMethodVariantInfo(snapshot) {
    const activeChar = snapshot && snapshot.activeChar && typeof snapshot.activeChar === 'object' ? snapshot.activeChar : {};
    const stat = activeChar.属性 || {};
    const equip = activeChar.装备 || {};
    const armorLv = Number(toNumber(deepGet(equip, '斗铠.等级', 0), 0));
    const armorName = toText(deepGet(equip, '斗铠.名称', '无'), '无');
    const armorFullSet = deepGet(equip, '斗铠.完整套装', undefined);
    const mechLv = toText(deepGet(equip, '机甲.等级', '无'), '无');
    const mechStatus = toText(deepGet(equip, '机甲.状态', '完好'), '完好');
    return {
      lv: Number(toNumber(stat.等级, 0)),
      hasDoukai: armorLv > 0
        && armorName !== '无'
        && (armorFullSet === undefined || armorFullSet === null ? true : !!armorFullSet),
      hasMecha: mechLv !== '无'
        && !/损毁|报废|不可用|故障/.test(mechStatus)
    };
  }

  function resolveTravelMethodVariant(method, snapshot) {
    if (method !== '飞行(机甲/斗铠)') return method;
    const { lv, hasDoukai, hasMecha } = getTravelMethodVariantInfo(snapshot);
    if (hasDoukai) return '斗铠飞行';
    if (hasMecha) return '机甲飞行';
    return lv >= 70 ? '肉身飞行' : method;
  }

  function 获取局部地图城市规模系数(snapshot = mapState.snapshot) {
    const 预览锚点 = toText(snapshot && snapshot.previewMeta && snapshot.previewMeta.anchor_name, '');
    const 地图名 = toText(snapshot && snapshot.mapMeta && snapshot.mapMeta.name, '');
    const 地点文本 = `${预览锚点} ${地图名} ${Array.isArray(mapState.previewTrail) ? mapState.previewTrail.join(' ') : ''}`;
    const 命中 = 名称集合 => Array.from(名称集合 || []).some(名称 => 名称 && 地点文本.includes(名称));
    if (命中(SUPER_CITY_NAMES)) return 0.12;
    if (命中(MAJOR_CITY_NAMES)) return 0.075;
    if (命中(CAPITAL_NAMES)) return 0.05;
    if (命中(CITY_NAMES) || /主城|城市|城区/.test(地点文本)) return 0.03;
    if (命中(SMALL_SETTLEMENT_NAMES) || /镇|村|港|营地|集市|街/.test(地点文本)) return 0.006;
    return 0.018;
  }

  function getMapTravelPreview() {
    if (hasActivePreview() && !isPreviewCurrentBranch()) return null;
    if (!mapState.selectedFreePoint && 判断地图节点为精确当前位置(mapState.selectedNode)) return null;
    const start = getCurrentCoord();
    const end = getSelectedCoord();
    if (!start || !end) return null;
    if (isSelectionCurrentBranch() && !hasActivePreview()) return null;
    const distance = 计算地图视觉距离(start, end);
    if (distance < 1) return null;
    const snapshot = mapState.snapshot || buildFallbackSnapshot();
    const travelContext = buildMapTravelContext(snapshot, mapState.currentMapId, start, end);
    const defaultMethod = resolveTravelMethodVariant(chooseMapTravelMethod(distance, travelContext), snapshot);
    const method = resolveTravelMethodVariant(mapState.travelMethodOverride || defaultMethod, snapshot);
    const availableMethods = getAvailableTravelMethods(distance, mapState.currentMapId, snapshot, travelContext);
    const actualMethod = availableMethods.includes(method) ? method : availableMethods[0];
    // 原著比例尺纠正 (1 Tick = 10分钟)：东海到天海(178px)大巴4h=24ticks；明斗到明都(1100px)飞行2h=12 ticks
    let coefficient = {
      '步行': 1.5,             // 跨城约两天(44小时)
      '校园短驳车': 0.25,      
      '魂导汽车': 0.135,       // 原著4小时
      '魂导列车': 0.06,        // 极速列车，跨城一个多小时
      '远洋巨轮': 0.25,        // 跨海数天
      '斗铠飞行': 0.03,        // 比肉身稍快
      '机甲飞行': 0.034,       
      '肉身飞行': 0.034,       // 原著：明斗山脉(1420,649)到明都(1103,496)距离约352px，2小时(12 ticks)
      '空间传送(极限斗罗)': 0.005 // 瞬息即至(半小时内)
    }[actualMethod] ?? 1;
    if (travelContext && travelContext.routeProfile && travelContext.routeProfile.requiresSea && actualMethod === '远洋巨轮') {
      const totalCells = Math.max(1, travelContext.routeProfile.landCells + travelContext.routeProfile.waterCells);
      const landRatio = travelContext.routeProfile.landCells / totalCells;
      const waterRatio = travelContext.routeProfile.waterCells / totalCells;
      coefficient = (landRatio * 0.135) + (waterRatio * 0.25);
    }

    const depth = Array.isArray(mapState.previewTrail) ? mapState.previewTrail.length : 0;
    const 当前地图 = toText(mapState.currentMapId, '');
    const 局部地图 = 当前地图 && 当前地图 !== 'map_douluo_world';
    let localScale = 1.0;
    if (局部地图) {
      const 城市规模系数 = 获取局部地图城市规模系数(snapshot);
      localScale = travelContext.isFacility ? Math.max(0.003, 城市规模系数 * 0.5) : 城市规模系数;
      if (depth >= 2) localScale = Math.max(0.003, localScale * 0.75);
    }

    const costs = calculateTravelCost(actualMethod, distance, snapshot, { distanceScale: localScale });
    const ticks = Math.max(1, Math.floor(distance * coefficient * localScale));
    const coordText = formatMapImageCoord(end, '');
    return { method: actualMethod, ticks, distance, duration: formatMapTravelDuration(ticks), coordText, costs, routePlanText: toText(travelContext && travelContext.routePlanText, ''), routeProfile: travelContext && travelContext.routeProfile ? travelContext.routeProfile : null };
  }

  function calculateTravelCost(method, distance, snapshot, options = {}) {
    const activeChar = snapshot && snapshot.activeChar && typeof snapshot.activeChar === 'object' ? snapshot.activeChar : {};
    const stat = activeChar.属性 || {};
    const wealth = activeChar.财富 || {};
    const { lv, hasDoukai, hasMecha } = getTravelMethodVariantInfo(snapshot);
    const resolvedMethod = resolveTravelMethodVariant(method, snapshot);
    const distanceScale = Math.max(0.01, Number(toNumber(options && options.distanceScale, 1), 1));
    const scaledDistance = Math.max(0, Number(distance || 0) * distanceScale);

    let fedCoin = 0;
    let sp = 0;
    let vit = 0;
    let canAfford = true;
    let reason = '';
    let note = '';

    if (resolvedMethod === '步行') {
      vit = Math.max(1, Math.round(scaledDistance * 3.75));
    } else if (resolvedMethod === '校园短驳车') {
      fedCoin = Math.max(1, Math.floor(scaledDistance * 2));
      note = '校内通勤';
    } else if (['魂导列车', '魂导汽车', '远洋巨轮'].includes(resolvedMethod)) {
      fedCoin = Math.floor(scaledDistance * 10);
      if (resolvedMethod === '魂导汽车' && 背包有可用魂导汽车(activeChar)) {
        fedCoin = Math.max(1, Math.floor(fedCoin / 3));
        note = '自备车辆';
      }
    } else if (resolvedMethod === '斗铠飞行') {
      if (!hasDoukai) {
        canAfford = false;
        reason = '需拥有可用斗铠';
      } else {
        sp = Math.floor(scaledDistance * 12);
        vit = Math.max(1, Math.floor(scaledDistance * 2));
        note = '斗铠飞行';
      }
    } else if (resolvedMethod === '机甲飞行') {
      if (!hasMecha) {
        canAfford = false;
        reason = '需拥有可用机甲';
      } else {
        sp = Math.floor(scaledDistance * 10);
        vit = Math.max(1, Math.floor(scaledDistance));
        fedCoin = Math.max(1, Math.floor(scaledDistance * 3));
        note = '机甲飞行';
      }
    } else if (resolvedMethod === '肉身飞行') {
      if (lv < 70) {
        canAfford = false;
        reason = '需70级以上';
      } else {
        sp = Math.floor(scaledDistance * 20);
        vit = Math.max(1, Math.floor(scaledDistance * 5));
        note = '肉身飞行';
      }
    } else if (resolvedMethod === '空间传送(极限斗罗)') {
      if (lv >= 98) note = '极限传送';
      else {
        canAfford = false;
        reason = '需极限斗罗或特殊权限';
      }
    }

    const curCoin = Number(toNumber(wealth.联邦币, 0));
    const curSp = Number(toNumber(stat.魂力, 0));
    const curVit = Number(toNumber(stat.体力, 0));
    if (canAfford && fedCoin > curCoin) { canAfford = false; reason = '联邦币不足'; }
    if (canAfford && sp > curSp) { canAfford = false; reason = '魂力不足'; }
    if (canAfford && vit > curVit) { canAfford = false; reason = '体力不足'; }

    const parts = [];
    if (fedCoin > 0) parts.push(`${fedCoin.toLocaleString()}联邦币`);
    if (sp > 0) parts.push(`${sp}魂力`);
    if (vit > 0) parts.push(`${vit}体力`);
    const text = parts.length ? `${parts.join(' · ')}${note ? ` · ${note}` : ''}` : (note || '无消耗');
    return { fedCoin, sp, vit, canAfford, reason, text, note };
  }

  function 背包有可用魂导汽车(角色 = {}) {
    const 背包 = 角色 && 角色.背包 && typeof 角色.背包 === 'object' ? 角色.背包 : {};
    return Object.entries(背包).some(([物品名, 物品]) => {
      const 数量 = toNumber(物品 && 物品.数量, 0);
      if (数量 <= 0) return false;
      const 文本 = `${toText(物品名, '')} ${toText(物品 && 物品.名称, '')} ${toText(物品 && 物品.类型, '')}`;
      return /魂导汽车|魂导车|汽车|载具/.test(文本) && !/车票|票据|残骸|报废|损毁/.test(文本);
    });
  }

  function buildMapTravelContext(snapshot = null, mapId = mapState.currentMapId, startCoord = getCurrentCoord(), endCoord = getSelectedCoord()) {
    const activeSnapshot = snapshot || mapState.snapshot || buildFallbackSnapshot();
    const safeMapId = toText(mapId || (activeSnapshot && activeSnapshot.currentMapId), 'map_douluo_world');
    const level = toText(activeSnapshot && activeSnapshot.mapLevel, inferMapLevelFromId(safeMapId));
    const isWorld = safeMapId === 'map_douluo_world' || level === 'world' || level === 'continent';
    const isFacility = level === 'facility' || level === 'district' || level === 'city';
    const routeProfile = isWorld ? buildWorldTravelRouteProfile(startCoord, endCoord, safeMapId) : null;
    const requiresSea = !!(routeProfile && routeProfile.requiresSea);
    return {
      mapId: safeMapId,
      level,
      isWorld,
      isFacility,
      routeProfile,
      routePlanText: routeProfile ? routeProfile.summary : '',
      shipEligible: isWorld && requiresSea,
      railEligible: isWorld && !mapState.selectedFreePoint && !requiresSea
    };
  }


  function getAvailableTravelMethods(distance, mapId, snapshot = null, precomputedContext = null) {
    const ctx = precomputedContext || buildMapTravelContext(snapshot, mapId);
    const methods = [];
    const { lv, hasDoukai, hasMecha } = getTravelMethodVariantInfo(snapshot);
    const pushMethod = method => {
      if (method && !methods.includes(method)) methods.push(method);
    };
    const pushFlightMethods = () => {
      if (hasDoukai) pushMethod('斗铠飞行');
      if (hasMecha) pushMethod('机甲飞行');
      if (lv >= 70) pushMethod('肉身飞行');
    };
    
    if (ctx.isFacility) {
      pushMethod('步行');
      if (distance > 18) pushMethod('校园短驳车');
      if (distance > 25) pushFlightMethods();
      if (distance > 180) pushMethod('魂导汽车');
      return methods.length ? methods : ['步行'];
    }

    if (!ctx.isWorld) {
      pushMethod('步行');
      if (distance > 28) pushMethod('魂导汽车');
      if (distance > 25) pushFlightMethods();
      if (distance > 1200) pushMethod('空间传送(极限斗罗)');
      return methods.length ? methods : ['步行'];
    }

    if (distance <= 50) {
      pushMethod('步行');
      pushMethod('魂导汽车');
      if (distance > 25) pushFlightMethods();
    } else if (distance <= 180) {
      pushMethod('魂导汽车');
      if (ctx.shipEligible && distance > 160) pushMethod('远洋巨轮');
      if (ctx.railEligible && distance > 140) pushMethod('魂导列车');
      pushFlightMethods();
    } else {
      if (ctx.shipEligible) pushMethod('远洋巨轮');
      if (ctx.railEligible) pushMethod('魂导列车');
      pushMethod('魂导汽车');
      pushFlightMethods();
      if (distance > 950) pushMethod('空间传送(极限斗罗)');
    }
    
    return methods.length ? methods : ['步行'];
  }

  function buildMapTravelRequest() {
    const preview = getMapTravelPreview();
    if (!preview) return null;
    const targetCoord = getSelectedCoord();
    const coordSystem = MAP_COORD_SYSTEM_IMAGE;
    if (mapState.selectedFreePoint) {
      return { target_loc: '无', target_x: roundCoord(mapState.selectedFreePoint.x), target_y: roundCoord(mapState.selectedFreePoint.y), coord_system: coordSystem, method: preview.method, est_ticks: preview.ticks, est_duration: preview.duration, coord_text: preview.coordText, costs: preview.costs, route_plan: toText(preview.routePlanText, '') };
    }
    return { target_loc: mapState.selectedNode, target_x: targetCoord ? roundCoord(targetCoord.x) : -1, target_y: targetCoord ? roundCoord(targetCoord.y) : -1, coord_system: coordSystem, method: preview.method, est_ticks: preview.ticks, est_duration: preview.duration, coord_text: preview.coordText, costs: preview.costs, route_plan: toText(preview.routePlanText, '') };
  }

  function hasPendingTravelRequestForTarget() {
    if (!mapState.pendingTravelRequest) return false;
    if (mapState.pendingTravelRequest.target_loc !== '无' && 判断地图节点为精确当前位置(mapState.pendingTravelRequest.target_loc)) return false;
    const currentRequest = buildMapTravelRequest();
    if (!currentRequest) return false;
    return mapState.pendingTravelRequest.target_loc === currentRequest.target_loc
      && Number(mapState.pendingTravelRequest.target_x) === Number(currentRequest.target_x)
      && Number(mapState.pendingTravelRequest.target_y) === Number(currentRequest.target_y)
      && toText(mapState.pendingTravelRequest.method, '') === toText(currentRequest.method, '');
  }

  function queueMapTravelRequest() {
    const request = buildMapTravelRequest();
    if (!request) return null;
    if (request.target_loc !== '无' && 判断地图节点为精确当前位置(request.target_loc)) {
      mapState.pendingTravelRequest = null;
      return null;
    }
    mapState.pendingTravelRequest = request;
    const 规划目标名 = request.target_loc === '无'
      ? 构建自由坐标地点名({ x: request.target_x, y: request.target_y }, mapState.layer)
      : request.target_loc;
    mapState.lastTravelNote = `已规划前往 ${规划目标名} · ${request.method}${request.route_plan ? ` · ${request.route_plan}` : ''} · 预计 ${request.est_duration}`;
    return request;
  }

  function 设置移动后待执行动作(actionType = '', item = null) {
    const 动作 = toText(actionType, '');
    if (!动作 || 动作 === 'travel' || 动作 === 'inspect') {
      mapState.待移动后动作 = null;
      return null;
    }
    const 节点名 = toText(item && item.name, mapState.selectedNode);
    const 商店上下文 = item ? 获取节点商店上下文(item, mapState.baseSnapshot || mapState.snapshot) : { 商店名: '' };
    mapState.待移动后动作 = {
      action: 动作,
      target: 节点名,
      label: getNodeInteractionLabel(动作),
      preferredStore: 商店上下文.商店名,
      at: Date.now()
    };
    return mapState.待移动后动作;
  }

  async function 提交地图移动结算(请求, 上下文 = {}) {
    if (typeof window.__LWCS_SETTLE_MAP_TRAVEL__ === 'function') {
      return await window.__LWCS_SETTLE_MAP_TRAVEL__({ request: cloneJsonValue(请求, {}), ...上下文 });
    }
    const detail = { request: cloneJsonValue(请求, {}), ...上下文 };
    window.dispatchEvent(new CustomEvent('map-travel-settle-request', { detail }));
    if (detail && detail.result) return detail.result;
    return { ok: false, reason: '地图移动结算桥未就绪。' };
  }

  async function commitMapTravel(options = {}) {
    const request = hasPendingTravelRequestForTarget() ? mapState.pendingTravelRequest : queueMapTravelRequest();
    if (!request) return;
    if (request.target_loc !== '无' && 判断地图节点为精确当前位置(request.target_loc)) {
      mapState.pendingTravelRequest = null;
      mapState.待移动后动作 = null;
      mapState.selectedNode = request.target_loc;
      mapState.selectedFreePoint = null;
      mapState.infoPanelMode = 'selection';
      mapState.lastTravelNote = `已位于 ${request.target_loc}`;
      syncInteractiveMapUI({ center: false, updateInfo: true });
      return;
    }
    const isFreeTravel = request.target_loc === '无';
    const resolvedNamedCoord = !isFreeTravel ? getMapNodeCoord(request.target_loc) : null;
    const previewCurrentBranch = hasActivePreview() && isPreviewCurrentBranch();
    // 根据【绝对路径铁律】，补齐斗罗大陆前缀（如果AI没传的话）
    const finalLocName = previewCurrentBranch
      ? resolvePreviewTravelTargetLoc(request.target_loc, { isFree: isFreeTravel })
      : (isFreeTravel
        ? `斗罗大陆-未知荒野`
        : (request.target_loc.startsWith('斗罗大陆-') || request.target_loc.startsWith('斗灵大陆-') ? request.target_loc : `斗罗大陆-${request.target_loc}`));
      
    const targetCoord = {
      x: Number.isFinite(Number(request.target_x)) && Number(request.target_x) >= 0 ? Number(request.target_x) : (resolvedNamedCoord ? roundCoord(resolvedNamedCoord.x) : -1),
      y: Number.isFinite(Number(request.target_y)) && Number(request.target_y) >= 0 ? Number(request.target_y) : (resolvedNamedCoord ? roundCoord(resolvedNamedCoord.y) : -1)
    };
    const 移动显示目标 = isFreeTravel ? 构建自由坐标地点名(targetCoord, mapState.layer) : finalLocName;
    const 自由坐标父级路径 = (() => {
      if (!isFreeTravel) return finalLocName;
      const segments = finalLocName.split('-').map(seg => toText(seg, '').trim()).filter(Boolean);
      if (!segments.length) return '斗罗大陆';
      if (segments[segments.length - 1] === '未知荒野') segments.pop();
      const leaf = segments[segments.length - 1];
      if (leaf && !getItemByName(leaf) && segments.length > 1) segments.pop();
      return segments.join('-') || '斗罗大陆';
    })();
    const 结算最终位置 = isFreeTravel ? `${自由坐标父级路径}-${移动显示目标}` : finalLocName;

    if (request.costs && request.costs.canAfford === false) {
      mapState.lastTravelNote = `[地图移动失败] ${request.method} → ${移动显示目标} · ${toText(request.costs.reason, '资源不足')}`;
      mapState.pendingTravelRequest = null;
      mapState.待移动后动作 = null;
      syncInteractiveMapUI({ center: false });
      return;
    }

    const targetTerrainInfo = resolveTerrainInfoByCoord(targetCoord, mapState.currentMapId);
    const targetTerrainBrief = targetTerrainInfo
      ? formatTerrainNarrative(targetTerrainInfo, mapState.currentMapId, { fallback: '', includeDifficulty: false })
      : '';
    const targetTerrainShort = targetTerrainInfo ? ` · ${toText(targetTerrainInfo.name, '未知地形')}` : '';
    if (isFreeTravel) {
      mapState.currentNode = '';
      mapState.currentFreePoint = { x: request.target_x, y: request.target_y };
      mapState.selectedFreePoint = { x: request.target_x, y: request.target_y };
      mapState.selectedNode = '';
      mapState.lastTravelNote = `[地图移动] ${request.method} → ${移动显示目标}${targetTerrainShort}${request.route_plan ? ` · ${request.route_plan}` : ''} · ${request.est_duration}`;
    } else {
      mapState.currentNode = mapState.selectedNode;
      mapState.selectedFreePoint = null;
      mapState.currentFreePoint = null;
      mapState.lastTravelNote = `[地图移动] ${request.method} → ${request.target_loc}${targetTerrainShort}${request.route_plan ? ` · ${request.route_plan}` : ''} · ${request.est_duration} · 坐标 ${request.coord_text}`;
    }

    if (mapState.baseSnapshot && mapState.baseSnapshot.activeChar && mapState.baseSnapshot.activeChar.状态) {
      mapState.baseSnapshot.activeChar.状态.位置 = 结算最终位置;
      const isWorldMove = !hasActivePreview() || mapState.coordSystem === MAP_COORD_SYSTEM_IMAGE;
      if (isWorldMove) {
        mapState.baseSnapshot.activeChar.状态.坐标系 = MAP_COORD_SYSTEM_IMAGE;
        mapState.baseSnapshot.currentFocusCoord = { x: targetCoord.x, y: targetCoord.y };
        const currentAnchorMeta = resolveVisibleLocationAnchor(mapState.baseSnapshot, 结算最终位置);
        mapState.baseSnapshot.currentLoc = currentAnchorMeta.leafName;
        mapState.baseSnapshot.currentLocFull = 结算最终位置;
        mapState.baseSnapshot.currentFocus = {
          loc: currentAnchorMeta.anchorName || currentAnchorMeta.leafName,
          x: targetCoord.x,
          y: targetCoord.y,
          coord_system: MAP_COORD_SYSTEM_IMAGE
        };
        mapState.baseSnapshot.currentFocusName = currentAnchorMeta.anchorName;
        mapState.baseSnapshot.currentWithinView = currentAnchorMeta.currentWithinView;
      }
    }

    if (mapState.baseSnapshot && mapState.baseSnapshot.activeChar) {
      try {
        const activeName = toText(mapState.baseSnapshot.activeName, '主角');
        const 出行方式 = toText(request.method, '步行');
        const 抵达地点名 = isFreeTravel ? 移动显示目标 : finalLocName.replace(/^斗罗大陆-/, '').replace(/^斗灵大陆-/, '');
        const 移动动作 = 出行方式 === '步行' ? '步行' : `乘坐${出行方式}`;
        const settleResult = await 提交地图移动结算(request, {
          角色: activeName,
          finalLocName: 结算最终位置,
          移动显示目标,
          terrainName: targetTerrainInfo ? toText(targetTerrainInfo.name, '') : '',
          targetTerrainBrief
        });
        if (!settleResult || settleResult.ok === false) {
          mapState.lastTravelNote = `[地图移动失败] ${toText(settleResult && settleResult.reason, '移动结算失败')}`;
          syncInteractiveMapUI({ center: false, updateInfo: true });
          return;
        }
        同步地图结算补丁到本地快照(settleResult.patchOps);
        const followUpAction = toText(options && options.followUpAction, '');
        const 自动执行后续动作 = !!(followUpAction && options && options.自动执行后续动作 === true);
        if (自动执行后续动作) {
          const 后续动作记录 = mapState.待移动后动作 && typeof mapState.待移动后动作 === 'object'
            ? mapState.待移动后动作
            : null;
          const 后续节点名 = toText(后续动作记录 && 后续动作记录.target, toText(request.target_loc, mapState.selectedNode));
          const 后续节点 = getItemByName(后续节点名) || getItemByName(mapState.selectedNode);
          mapState.lastTravelNote = `[地图移动] 已抵达【${移动显示目标}】，继续执行【${getNodeInteractionLabel(followUpAction)}】。`;
          mapState.pendingTravelRequest = null;
          mapState.待移动后动作 = null;
          syncInteractiveMapUI({ center: true, updateInfo: true });
          if (后续节点) {
            window.setTimeout(() => {
              triggerPreviewNodeInteraction(后续节点, followUpAction);
              syncInteractiveMapUI({ center: false, updateInfo: true });
            }, 0);
          }
          return;
        }
        const followUpLabel = followUpAction ? getNodeInteractionLabel(followUpAction) : '';
        const followUpLine = followUpLabel
          ? `\n[抵达后意图]\n玩家刚才点击的是【${followUpLabel}】。本轮只完成移动与到达描写；不要直接结算交易、工坊、商店购买或战斗胜负，抵达后由玩家再次发起对应模块。若抵达时已超过商店营业时间，剧情中只写到店铺关门。`
          : '';
        const targetTerrainLine = targetTerrainBrief ? `目标地形：${targetTerrainBrief}` : '';
        const logMsg = `[系统仲裁] 地图移动已由前端直接结算并写回 MVU。玩家${移动动作}，经过 ${request.est_duration} 的跋涉，现已抵达新地点：【${移动显示目标}】。${targetTerrainLine ? `\n${targetTerrainLine}` : ''}`;
        const sysPrompt = `[前端仲裁器说明]\n以下内容为系统后台已完成结算的仲裁结果，系统已自动扣除了相应的金钱、体力与时间。\n请仅将以下仲裁结论转写成自然剧情，描写路途见闻、到达环境与角色反应即可。不要输出 UpdateVariable，不要再次改写位置、坐标、时间或资源消耗。\n\n${logMsg}${followUpLine}`;
        dispatchMapAiRequest(`[启程前往] ${移动动作}前往【${移动显示目标}】${targetTerrainBrief ? ` · 地形：${targetTerrainBrief}` : ''}`, sysPrompt, { requestKind: 'map_travel_settled' });
      } catch (e) {
        console.error('Settle map travel failed:', e);
        mapState.lastTravelNote = `[地图移动失败] ${e && e.message ? e.message : '移动结算失败'}`;
        syncInteractiveMapUI({ center: false, updateInfo: true });
        return;
      }
    }
    mapState.pendingTravelRequest = null;
    mapState.待移动后动作 = null;
    syncInteractiveMapUI({ center: true });
  }

  function triggerPreviewNodeInteraction(item, explicitAction = '') {
    if (!item) return null;
    if (地图节点已损毁(item)) {
      mapState.lastTravelNote = `【${item.name}】已损毁，节点动作暂停。`;
      if (window.MVU_Toast && typeof window.MVU_Toast.show === 'function') window.MVU_Toast.show('地点已损毁，节点动作暂停。', 'warning');
      return null;
    }
    const 原始动作 = toText(explicitAction, '') || getPrimaryNodeInteraction(item);
    const action = 原始动作 === 'train' ? 获取地图训练执行动作() : 原始动作;
    const actionLabel = action === 'train_body' ? 获取地图训练项目标题() : getNodeInteractionLabel(action);
    const snapshot = mapState.snapshot || buildFallbackSnapshot();
    const itemServices = Array.isArray(item.services) ? item.services : [];
    const 商店上下文 = 获取节点商店上下文(item, snapshot);
    const serviceText = formatBehaviorLabels(itemServices, getNodeServiceLabel);
    const eventText = toText(item.eventId, '无');
    const talkTargets = [];
    if (snapshot.charactersByLoc instanceof Map) {
      const 人物条目列表 = snapshot.charactersByLoc.get(item.name) || [];
      人物条目列表.forEach(人物条目 => {
        if (!人物条目 || 人物条目.可交互 !== true) return;
        const 人物名 = toText(人物条目.name, '');
        if (人物名 && !talkTargets.includes(人物名)) talkTargets.push(人物名);
      });
    }
    const selectedNpc = toText(mapState.selectedNpc, '');
    const 初始对象 = selectedNpc && talkTargets.includes(selectedNpc) ? selectedNpc : (talkTargets.length === 1 ? talkTargets[0] : '');
    const executorType = action === 'craft' ? resolveMapNpcCraftExecutorType(item, 初始对象) : '';
    const npcTarget = action === 'craft' && executorType === 'official' ? '' : 初始对象;
    const talkSuffix = action === 'talk'
      ? (npcTarget ? ` · 对象 ${npcTarget}` : (talkTargets.length ? ` · 对象 ${talkTargets.join('、')}` : ''))
      : (npcTarget ? ` · 对象 ${npcTarget}` : '');
    const note = `[触发前端分发] ${item.name} · 执行 ${actionLabel} 交互${talkSuffix}`;
    mapState.lastNodeAction = { target: item.name, npcTarget, action, note, at: Date.now() };
    mapState.lastTravelNote = note;

    // ====== MVU 前端结果结算与指令注入 (轻量交互) ======
    // 对于需要走统一桥接的动作（交易、工坊、战斗与社交互动等），直接抛出事件交给 MVU 逻辑桥处理
    if ((['trade', 'shop', 'black_market'].includes(action) || itemServices.some(s => ['shop', 'black_market'].includes(s)) || 商店上下文.商店名) && !判断商店营业中(mapState.baseSnapshot || snapshot)) {
      mapState.lastTravelNote = `【${item.name}】商店已关门，营业时间 09:00-22:00。`;
      if (window.MVU_Toast && typeof window.MVU_Toast.show === 'function') window.MVU_Toast.show('商店已关门，营业时间 09:00-22:00。', 'warning');
      return mapState.lastNodeAction;
    }

    if (['trade', 'bid', 'craft', 'black_market', 'auction', 'shop', 'battle', 'talk', 'brief', 'intel'].includes(action) || itemServices.some(s => ['shop', 'auction', 'black_market', 'craft', 'battle', 'talk', 'brief', 'intel'].includes(s)) || 商店上下文.商店名) {
      try {
        window.dispatchEvent(new CustomEvent('map-action-dispatch', {
          detail: { target: item.name, action: action === 'shop' ? 'trade' : action, services: itemServices, actionSlots: item.actionSlots || [], eventId: item.eventId, nodeKind: item.nodeKind, mapId: mapState.currentMapId, currentLoc: toText(snapshot.currentLocFull, snapshot.currentLoc), npcTargets: talkTargets, npcTarget, executorType, preferredStore: 商店上下文.商店名, storeSource: 商店上下文.来源地点 }
        }));
      } catch (e) {}
      return mapState.lastNodeAction;
    }

    // 对于普通的轻量文字动作（查看、研读、训练等），前端直接做基础结算并扔给后端润色
    if (mapState.baseSnapshot) {
      try {
        const HIDDEN_RULES = `[前端代发说明]\n以下内容属于地图页代发的节点动作请求，请直接承接剧情推进，正文不要输出 JSON 块或系统术语。`;

        const actorName = toText((mapState.baseSnapshot && mapState.baseSnapshot.activeName) || snapshot.activeName, '');
        let logMsg = `[系统仲裁] 玩家在【${item.name}】进行了【${actionLabel}】操作。${action === 'talk' ? (npcTarget ? ` 当前对话对象：${npcTarget}。` : (talkTargets.length ? ` 当前可对话对象：${talkTargets.join('、')}。` : '')) : (npcTarget ? ` 当前交互对象：${npcTarget}。` : '')}`;
        let baseTicks = 1;
        let playerInput = `[节点交互] 我在【${item.name}】准备进行【${actionLabel}】。`;
        const 日常动作tick = 是否地图可变时长动作(action) ? 获取地图日常动作tick() : 6;
        const 日常时长文本 = 格式化地图日常时长(日常动作tick);
        const actionPreview = buildRoutineActionPreview(mapState.baseSnapshot || snapshot, action, item, 日常动作tick);
        const 拟态提示文本 = toText(actionPreview && actionPreview.mimicHint, '');
        if (拟态提示文本) logMsg += ` ${拟态提示文本}`;

        if (action === 'study' || action === '研读') {
          baseTicks = 日常动作tick;
          logMsg += ` ${actionPreview.logText}`;
          playerInput = `[节点交互] 我想在【${item.name}】研读 ${日常时长文本}。`;
        } else if (action === 'meditate') {
          baseTicks = 日常动作tick;
          logMsg += ` ${actionPreview.logText}`;
          playerInput = `[节点交互] 我想在【${item.name}】冥想 ${日常时长文本}`;
        } else if (action === 'train_body' || action === 'train' || action === '训练') {
          baseTicks = 日常动作tick;
          logMsg += ` ${actionPreview.logText}`;
          playerInput = `[节点交互] 我想在【${item.name}】进行 ${日常时长文本}${获取地图训练项目标题()}。`;
        } else if (action === 'train_mind') {
          baseTicks = 日常动作tick;
          logMsg += ` ${actionPreview.logText}`;
          playerInput = `[节点交互] 我想在【${item.name}】进行 ${日常时长文本}精神训练。`;
        } else if (action === 'rest') {
          baseTicks = 日常动作tick;
          logMsg += ` ${actionPreview.logText}`;
          playerInput = `[节点交互] 我想在【${item.name}】休整 ${日常时长文本}。`;
        } else if (action === 'sleep') {
          baseTicks = 日常动作tick;
          logMsg += ` ${actionPreview.logText}`;
          playerInput = `[节点交互] 我想在【${item.name}】睡眠休整 ${日常时长文本}。`;
        } else if (action === 'talk') {
          baseTicks = 2;
          playerInput = npcTarget
            ? `我想在【${item.name}】和【${npcTarget}】对话。`
            : `我想在【${item.name}】与在场人物交谈。`;
        } else if (action === 'brief') {
          baseTicks = 2;
          playerInput = npcTarget
            ? `我想在【${item.name}】向【${npcTarget}】汇报情况并请示安排。`
            : `我想在【${item.name}】向在场人员汇报情况并请示安排。`;
        } else if (action === 'intel') {
          baseTicks = 2;
          playerInput = npcTarget
            ? `我想在【${item.name}】向【${npcTarget}】请教情报。`
            : `我想在【${item.name}】向在场人员收集情报。`;
        }
        const 行动模式映射 = {
          meditate: '冥想',
          train_body: 获取地图训练项目标题(),
          train: 获取地图训练项目标题(),
          train_mind: '精神训练',
          rest: '睡眠',
          sleep: '睡眠',
          study: '日常'
        };
        const 角色名 = toText(actorName, toText(snapshot.activeName, '主角'));
        const 角色路径 = escapeJsonPointer(角色名);
        const 当前tick = Math.max(0, toNumber(deepGet(mapState.baseSnapshot || snapshot, 'rootData.world.时间.tick', 0), 0));
        const patchOps = [
          { op: 'replace', path: `/char/${角色路径}/状态/行动`, value: 行动模式映射[action] || getNodeInteractionLabel(action) || '日常' },
          { op: 'replace', path: `/world/时间/tick`, value: 当前tick + Math.max(1, baseTicks) },
          { op: 'replace', path: `/sys/系统播报`, value: `[地图节点动作] ${角色名} 在【${item.name}】执行【${actionLabel}】，耗时约 ${Math.max(1, baseTicks) * 10} 分钟。` }
        ];

        const sysPrompt = `${HIDDEN_RULES}

[节点动作]
角色：${actorName || '玩家'}
地点：${item.name}
动作：${actionLabel}
预计耗时：约 ${Math.max(1, baseTicks) * 10} 分钟
节点服务：${serviceText || '无'}
关联事件：${eventText}
当前对象：${npcTarget || '无'}

${logMsg}

本次行动、时间推进与系统播报已由前端结算写回。请结合当前设施、在场角色与地点功能，自然写出这次行动的过程、收获与后续推进；若当前节点并不适合该动作，也请在剧情里明确说明阻碍原因。正文不要输出变量维护指令或系统术语。`;

        dispatchMapAiRequest(playerInput, sysPrompt, { requestKind: `map_action_${action}`, patchOps });
      } catch (e) {
        console.error('Send map action to AI failed:', e);
      }
    }

    return mapState.lastNodeAction;
  }

  function performMapAction(actionType) {
    const 原始动作 = toText(actionType, '');
    const 执行动作 = 原始动作 === 'train' ? 获取地图训练执行动作() : 原始动作;
    const snapshot = mapState.snapshot || buildFallbackSnapshot();
    const focusItem = getItemByName(mapState.selectedNode) || getItemByName(resolveSelectedNodeForLayer(mapState.layer)) || snapshot.items[0] || null;
    const canPreviewEnter = !mapState.selectedFreePoint && !!(focusItem && canEnterPreviewNode(focusItem.name, snapshot));
    const previewCurrentBranch = isPreviewCurrentBranch();
    const isFocusCurrentNode = !!(focusItem && 判断地图节点为当前位置(focusItem.name, snapshot));
    if (原始动作 === 'enter') {
      if (!focusItem || mapState.selectedFreePoint || !canPreviewEnter) return false;
      if (enterPreviewMode(focusItem.name)) syncInteractiveMapUI({ center: true, updateInfo: true });
      return true;
    }
    if (原始动作 === 'travel_anchor') {
      return 执行预览入口移动();
    }
    if (hasActivePreview() && !previewCurrentBranch) return false;
    if (原始动作 === 'travel') {
      if (!getMapTravelPreview()) return false;
      commitMapTravel();
      return true;
    }
    if (isFocusCurrentNode) mapState.pendingTravelRequest = null;
    if (!focusItem || mapState.selectedFreePoint) return false;
    if (原始动作 !== 'inspect' && !isFocusCurrentNode) {
      if (getMapTravelPreview()) {
        设置移动后待执行动作(原始动作, focusItem);
        return 打开移动动作确认层(原始动作, focusItem);
      }
      return false;
    }
    triggerPreviewNodeInteraction(focusItem, 执行动作);
    syncInteractiveMapUI({ center: false });
    return true;
  }

  function withSelectedNodeSnapshot(nodeName, runner) {
    const targetName = toText(nodeName, '');
    if (!targetName || typeof runner !== 'function') return null;
    const targetItem = getItemByName(targetName);
    if (!targetItem) return null;
    const previous = {
      selectedNode: mapState.selectedNode,
      selectedFreePoint: mapState.selectedFreePoint ? { ...mapState.selectedFreePoint } : null,
      infoPanelMode: mapState.infoPanelMode,
      travelMethodOverride: mapState.travelMethodOverride,
      pendingTravelRequest: mapState.pendingTravelRequest ? cloneJsonValue(mapState.pendingTravelRequest) : null,
    };
    try {
      mapState.selectedNode = targetName;
      mapState.selectedFreePoint = null;
      mapState.infoPanelMode = 'selection';
      return runner(targetItem);
    } finally {
      mapState.selectedNode = previous.selectedNode;
      mapState.selectedFreePoint = previous.selectedFreePoint;
      mapState.infoPanelMode = previous.infoPanelMode;
      mapState.travelMethodOverride = previous.travelMethodOverride;
      mapState.pendingTravelRequest = previous.pendingTravelRequest;
    }
  }

  function describeTravelToNode(nodeName) {
    return withSelectedNodeSnapshot(nodeName, targetItem => {
      if (判断地图节点为精确当前位置(targetItem.name)) {
        return { ok: true, alreadyThere: true, nodeName: targetItem.name, reason: `已在【${targetItem.name}】。` };
      }
      const preview = getMapTravelPreview();
      const request = preview ? buildMapTravelRequest() : null;
      if (!preview || !request) {
        return { ok: false, reason: `当前无法规划前往【${targetItem.name}】的移动。` };
      }
      return {
        ok: true,
        nodeName: targetItem.name,
        method: request.method,
        duration: request.est_duration,
        coordText: request.coord_text,
        routePlan: toText(request.route_plan, ''),
        costText: deepGet(request, 'costs.text', '无消耗'),
        canAfford: deepGet(request, 'costs.canAfford', true) !== false,
        reason: toText(deepGet(request, 'costs.reason', ''), ''),
        request: cloneJsonValue(request),
      };
    }) || { ok: false, reason: '目标节点当前不可达。' };
  }

  async function travelToNode(nodeName, options = {}) {
    const targetName = toText(nodeName, '');
    if (!targetName) return { ok: false, reason: '缺少目标节点。' };
    const targetItem = getItemByName(targetName);
    if (!targetItem) return { ok: false, reason: `当前地图中找不到【${targetName}】。` };
    if (判断地图节点为精确当前位置(targetName)) {
      mapState.selectedNode = targetName;
      mapState.selectedFreePoint = null;
      mapState.infoPanelMode = 'selection';
      mapState.pendingTravelRequest = null;
      mapState.待移动后动作 = null;
      syncInteractiveMapUI({ center: false, updateInfo: true });
      return { ok: true, alreadyThere: true, nodeName: targetName };
    }
    mapState.selectedNode = targetName;
    mapState.selectedFreePoint = null;
    mapState.infoPanelMode = 'selection';
    const preview = getMapTravelPreview();
    if (!preview) return { ok: false, reason: `当前无法规划前往【${targetName}】的移动。` };
    if (!hasPendingTravelRequestForTarget()) {
      queueMapTravelRequest();
    }
    const request = mapState.pendingTravelRequest ? cloneJsonValue(mapState.pendingTravelRequest) : buildMapTravelRequest();
    if (!request) return { ok: false, reason: `当前无法生成前往【${targetName}】的移动请求。` };
    if (options && options.queueOnly) {
      syncInteractiveMapUI({ center: false, updateInfo: true });
      return { ok: true, queued: true, request };
    }
    if (request.costs && request.costs.canAfford === false) {
      syncInteractiveMapUI({ center: false, updateInfo: true });
      return { ok: false, reason: request.costs.reason || '资源不足，无法前往该节点。', request };
    }
    await commitMapTravel();
    return { ok: true, committed: true, request };
  }

  function 执行预览入口移动() {
    const 预览路径列表 = Array.isArray(mapState.previewTrail) ? mapState.previewTrail.map(item => toText(item, '')).filter(Boolean) : [];
    const 入口候选列表 = [
      预览路径列表[0] || '',
      ...预览路径列表.flatMap(item => String(item || '').split('-').map(seg => toText(seg, '')).filter(Boolean)),
    ].filter(Boolean);
    const 源快照 = mapState.baseSnapshot || mapState.snapshot || buildFallbackSnapshot();
    if (!源快照 || !Array.isArray(源快照.items) || !入口候选列表.length) return false;
    const 源节点表 = new Map(源快照.items.map(item => [toText(item && item.name, ''), item]).filter(([名称]) => !!名称));
    const 入口节点名 = 入口候选列表.find(名称 => 源节点表.has(名称)) || 入口候选列表[0];
    mapState.previewViewStack = [];
    mapState.previewTrail = [];
    syncPreviewKeyFromTrail();
    syncMapStateFromSnapshot(源快照, { preserveSelection: false, forceLayer: inferInitialLayer(源快照), initializeLayer: false });
    mapState.selectedNode = 入口节点名;
    mapState.selectedFreePoint = null;
    mapState.infoPanelMode = 'selection';
    mapState.travelMethodOverride = null;
    if (!getMapTravelPreview()) {
      mapState.lastTravelNote = `当前无法规划前往【${入口节点名}】的移动。`;
      syncInteractiveMapUI({ center: true, updateInfo: true });
      return false;
    }
    commitMapTravel();
    return true;
  }

  function focusCurrentLocation(options = {}) {
    const { exitPreview = true } = options || {};
    const baseSnapshot = mapState.baseSnapshot || mapState.snapshot || buildFallbackSnapshot();
    if (!baseSnapshot) return false;
    mapState.infoPanelMode = 'follow';
    if (exitPreview && hasActivePreview() && mapState.baseSnapshot) {
      mapState.previewViewStack = [];
      mapState.previewTrail = [];
      syncPreviewKeyFromTrail();
      syncMapStateFromSnapshot(mapState.baseSnapshot, {
        preserveSelection: false,
        forceLayer: inferInitialLayer(mapState.baseSnapshot),
        initializeLayer: false
      });
    } else if (baseSnapshot !== mapState.snapshot) {
      syncMapStateFromSnapshot(baseSnapshot, {
        preserveSelection: false,
        forceLayer: inferInitialLayer(baseSnapshot),
        initializeLayer: false
      });
    }
    const activeSnapshot = mapState.snapshot || baseSnapshot;
    const focusName = toText(activeSnapshot.currentFocusName, '');
    const focusCoord = activeSnapshot.currentFocusCoord || {};
    const focusCoordValid = activeSnapshot.currentWithinView !== false
      && Number.isFinite(focusCoord.x)
      && Number.isFinite(focusCoord.y);
    if (focusName && mapState.itemMap.has(focusName)) {
      mapState.selectedFreePoint = null;
      mapState.selectedNode = focusName;
    } else if (focusCoordValid) {
      mapState.selectedFreePoint = { x: focusCoord.x, y: focusCoord.y };
      mapState.selectedNode = getNearestVisibleMapNode(mapState.selectedFreePoint, mapState.layer);
    } else if (mapState.currentNode && mapState.itemMap.has(mapState.currentNode)) {
      mapState.selectedFreePoint = null;
      mapState.selectedNode = mapState.currentNode;
    } else if (activeSnapshot.items[0]) {
      mapState.selectedFreePoint = null;
      mapState.selectedNode = activeSnapshot.items[0].name;
    }
    syncInteractiveMapUI({ center: true, updateInfo: true });
    return true;
  }

  function renderMapInfoState() {
    const snapshot = mapState.snapshot || buildFallbackSnapshot();
    const isFreeSelection = !!mapState.selectedFreePoint;
    const panelMode = getMapInfoPanelMode();
    const focusItem = isFreeSelection ? null : (getItemByName(mapState.selectedNode) || getItemByName(resolveSelectedNodeForLayer(mapState.layer)) || snapshot.items[0] || null);
    const previewMeta = snapshot.previewMeta || null;
    const inPreview = hasActivePreview();
    const isSubMapView = inPreview
      || !!previewMeta
      || (toText(snapshot.currentMapId || mapState.currentMapId, '') && toText(snapshot.currentMapId || mapState.currentMapId, '') !== 'map_douluo_world');
    const previewCurrentBranch = isPreviewCurrentBranch();
    const currentVisibleName = getVisibleCurrentNode();
    const currentActionNodeName = resolveActionableCurrentNodeName(snapshot);
    const currentItem = getItemByName(currentVisibleName) || getItemByName(mapState.currentNode) || focusItem;
    const isFocusCurrentNode = !!(!isFreeSelection && focusItem && 判断地图节点为当前位置(focusItem.name, snapshot));
    if (mapState.pendingTravelRequest && mapState.pendingTravelRequest.target_loc !== '无' && 判断地图节点为精确当前位置(mapState.pendingTravelRequest.target_loc, snapshot)) {
      mapState.pendingTravelRequest = null;
    }
    const rawTravelPreview = getMapTravelPreview();
    const travelPreview = isFocusCurrentNode ? null : rawTravelPreview;
    const previewRequest = travelPreview ? buildMapTravelRequest() : null;
    const canPreviewEnter = !isFreeSelection && !!(focusItem && canEnterPreviewNode(focusItem.name, snapshot));
    const pendingForSelection = hasPendingTravelRequestForTarget();
    const pending = mapState.pendingTravelRequest;
    const previewAnchorName = toText(previewMeta && previewMeta.anchor_name, snapshot.currentFocusName || snapshot.currentLoc);
    const previewTrailNames = Array.isArray(mapState.previewTrail) ? mapState.previewTrail.filter(Boolean) : [];
    const previewTrailText = previewTrailNames.length ? `世界图 → ${previewTrailNames.join(' → ')}` : '未进入预览';
    const previewDepthText = previewTrailNames.length ? `第 ${previewTrailNames.length} 层预览` : '未进入预览';
    const previewPathLabel = previewTrailNames.length ? `${previewDepthText} · ${previewTrailText}` : previewDepthText;
    const focusName = isFreeSelection ? formatFreePoint(mapState.selectedFreePoint, '坐标') : toText(focusItem && focusItem.name, '未知地点');
    const focusNodeKindText = focusItem ? getNodeKindLabel(focusItem.nodeKind) : (isFreeSelection ? '自由坐标' : '无');
    const focusInteractionText = focusItem ? formatBehaviorLabels(focusItem.interactions, getNodeInteractionLabel) : (isFreeSelection ? '查看坐标/开始移动' : '无');
    const focusServiceText = focusItem ? formatBehaviorLabels(focusItem.services, getNodeServiceLabel) : (isFreeSelection ? '无固定设施' : '无');
    const focusEventText = focusItem && toText(focusItem.eventId, '') ? '已挂接事件' : '无';
    const primaryInteractionLabel = focusItem ? getNodeInteractionLabel(getPrimaryNodeInteraction(focusItem)) : (isFreeSelection ? '查看坐标' : '查看');
    const activeNodeAction = inPreview && focusItem && mapState.lastNodeAction && mapState.lastNodeAction.target === focusItem.name ? mapState.lastNodeAction : null;
    const enterBriefText = inPreview
      ? (canPreviewEnter ? '双击节点继续进入子图 · 仅预览，不改变实际位置' : (previewCurrentBranch ? '当前为你所在区域的子图，可在左侧执行动作' : '当前为远端区域预览，未实际抵达，不能直接执行动作'))
      : (isFreeSelection ? '已选中自由坐标，可直接前往该位置' : (canPreviewEnter ? '可移动；双击可下钻节点进入子图' : '可查看节点或规划移动'));
    const currentName = getActualCurrentLoc();
    const rawCurrentName = getRawActualCurrentLoc();
    const currentCoord = getCurrentCoord();
    const focusCoord = getSelectedCoord();
    const hoverCoord = mapState.hoverCoord && Number.isFinite(mapState.hoverCoord.x) && Number.isFinite(mapState.hoverCoord.y)
      ? { x: mapState.hoverCoord.x, y: mapState.hoverCoord.y }
      : null;
    const terrainMapId = snapshot.currentMapId || mapState.currentMapId;
    const currentTerrainInfo = resolveTerrainInfoByCoord(currentCoord, terrainMapId);
    const focusTerrainInfo = resolveTerrainInfoByCoord(focusCoord, terrainMapId);
    const hoverNodeName = hoverCoord ? getNearestVisibleMapNode(hoverCoord, mapState.layer, { maxRatioDistance: MAP_NODE_SNAP_RATIO_THRESHOLD, useRenderedRatio: true }) : '';
    const hoverItem = hoverNodeName ? getItemByName(hoverNodeName) : null;
    const panelCoord = hoverCoord || focusCoord;
    const panelItem = hoverCoord ? hoverItem : focusItem;
    const panelTerrainInfo = resolveTerrainInfoByCoord(panelCoord, terrainMapId);
    const panelTerrainText = formatTerrainText(panelTerrainInfo, terrainMapId);
    const panelTerrainNarrative = formatTerrainNarrative(panelTerrainInfo, terrainMapId, { fallback: '' });
    const hoverImageRatio = hoverCoord
      ? ((mapState.hoverCanvas && Number.isFinite(mapState.hoverLocalX) && Number.isFinite(mapState.hoverLocalY))
          ? convertMapLocalPointToCanvasRatio(mapState.hoverLocalX, mapState.hoverLocalY, mapState.hoverCanvas)
          : projectCoord(hoverCoord))
      : null;
    const hoverImageCoord = hoverImageRatio ? convertMapRatioToImageCoord(hoverImageRatio.left, hoverImageRatio.top) : null;
    const pendingCoord = pending ? { x: toNumber(pending.target_x, NaN), y: toNumber(pending.target_y, NaN) } : null;
    const previewCoord = previewRequest ? { x: toNumber(previewRequest.target_x, NaN), y: toNumber(previewRequest.target_y, NaN) } : null;
    const pendingTerrainInfo = resolveTerrainInfoByCoord(pendingCoord, terrainMapId);
    const previewTerrainInfo = resolveTerrainInfoByCoord(previewCoord, terrainMapId) || focusTerrainInfo;
    const focusTerrainText = formatTerrainText(focusTerrainInfo, terrainMapId);
    const focusTerrainNarrative = formatTerrainNarrative(focusTerrainInfo, terrainMapId, { fallback: '' });
    const previewTargetName = previewRequest
      ? (previewRequest.target_loc === '无'
        ? 构建自由坐标地点名(previewCoord, mapState.layer)
        : previewRequest.target_loc)
      : '';
    const pendingTargetName = pending
      ? (pending.target_loc === '无'
        ? 构建自由坐标地点名(pendingCoord, mapState.layer)
        : pending.target_loc)
      : '';
    const actionLabel = !travelPreview ? '当前位置' : isFreeSelection ? '开始移动' : pendingForSelection ? '启程前进' : '规划路线';
    const pendingTerrainShort = pendingTerrainInfo ? ` · ${toText(pendingTerrainInfo.name, '未知地形')}` : '';
    const previewTerrainShort = previewTerrainInfo ? ` · ${toText(previewTerrainInfo.name, '未知地形')}` : '';
    const pendingTarget = pendingTargetName;
    const previewTarget = previewTargetName;
    const travelStatus = pending ? '已规划，待动身' : previewRequest ? (isFreeSelection ? '坐标可移动' : '目标已选定') : '暂无外出安排';
    const travelMethod = pending ? pending.method : previewRequest ? previewRequest.method : '留驻 / 自由活动';
    const travelTarget = pending ? pendingTarget : previewTarget || currentName;
    const travelDuration = pending ? pending.est_duration : previewRequest ? previewRequest.est_duration : '无';
    const stateLabelMap = { intact: '完整', ruins: '遗址', rebuild: '重建中', rebuilt: '已重建' };
    const rawFocusState = focusItem ? toText(focusItem.state, '暂无') : (isFreeSelection ? '已选中' : '暂无');
    const focusTypeText = focusItem ? toText(focusItem.type, '无') : (isFreeSelection ? '自由坐标点' : '无');
    const focusTypeDisplay = isFreeSelection ? (focusTerrainInfo ? '自由坐标点' : '未标注区域') : focusTypeText;
    const focusActionDisplay = isFreeSelection ? (travelPreview ? `${previewRequest ? previewRequest.method : travelPreview.method} / 坐标移动` : '查看坐标 / 开始移动') : focusInteractionText;
    const focusStateText = isFreeSelection ? (travelPreview ? '可移动' : '已选中') : (stateLabelMap[rawFocusState] || rawFocusState);
    const focusImportance = focusItem ? toNumber(focusItem.importance, NaN) : NaN;
    const focusImportanceText = isFreeSelection ? '坐标点' : (Number.isFinite(focusImportance) && focusImportance > 0 ? `${Math.round(focusImportance)}` : '未标定');
    const focusDescBaseText = isFreeSelection ? '已选中该坐标，可在左侧选择方式后直接移动。' : (focusItem ? toText(focusItem.desc, '暂无节点说明。') : '视野内无节点');
    const focusAvailableText = isFreeSelection ? '无固定设施' : (canPreviewEnter ? '可进入子图' : (focusServiceText !== '无' ? focusServiceText : '无'));
    const actionModeText = travelPreview ? (isFreeSelection ? '坐标移动' : pendingForSelection ? '移动待确认' : '移动规划') : '驻留 / 查看';
    const actionOperationText = travelPreview ? (isFreeSelection ? '开始移动' : pendingForSelection ? '确认前往' : '规划路线') : (isFreeSelection ? '查看坐标' : primaryInteractionLabel);
    const actionTargetText = pending ? `${pendingTarget}${pendingTerrainShort}` : (previewRequest ? `${previewTarget}${previewTerrainShort}` : focusName);
    const travelMethodText = pending ? pending.method : previewRequest ? previewRequest.method : (travelPreview ? travelPreview.method : '无');
    const actionMoveBaseText = pending ? `${pending.est_duration}` : previewRequest ? `${previewRequest.est_duration}` : (travelPreview ? travelPreview.duration : '无');
    const actionMoveText = pending
      ? `${actionMoveBaseText}${pending.route_plan ? ` · ${pending.route_plan}` : ''}`
      : previewRequest
        ? `${actionMoveBaseText}${previewRequest.route_plan ? ` · ${previewRequest.route_plan}` : ''}`
        : (travelPreview
          ? `${actionMoveBaseText}${travelPreview.routePlanText ? ` · ${travelPreview.routePlanText}` : ''}`
          : actionMoveBaseText);
    const actionCostText = pending
      ? (pending.costs?.text || '无')
      : previewRequest
        ? (previewRequest.costs?.canAfford
          ? (previewRequest.costs?.text || '无')
          : ['不可用', previewRequest.costs?.reason || '', previewRequest.costs?.text && previewRequest.costs.text !== '无消耗' ? previewRequest.costs.text : ''].filter(Boolean).join(' · '))
        : '无';
    const focusDescText = [
      focusDescBaseText,
      activeNodeAction && activeNodeAction.note ? activeNodeAction.note : ''
    ].filter(Boolean).join('\n\n');
    const dynamicRecommendText = inPreview
      ? (previewCurrentBranch
          ? (focusItem ? `${focusNodeKindText} · ${canPreviewEnter ? '可继续进入子图' : `可执行 ${focusInteractionText}`}${focusServiceText !== '无' ? ` · 提供 ${focusServiceText}` : ''}` : `当前为 ${previewAnchorName} 子图预览，不影响角色实际位置`)
          : `当前为远端区域预览 · 真实位置仍在 ${currentName}`)
      : (isFreeSelection ? (focusTerrainNarrative ? `自由坐标 · ${focusTerrainNarrative}` : '自由坐标 · 可规划前往') : '暂无动态建议');
    const panelName = hoverCoord
      ? (panelItem ? toText(panelItem.name, formatFreePoint(panelCoord, '坐标')) : formatFreePoint(panelCoord, '坐标'))
      : focusName;
    const panelTypeText = hoverCoord
      ? (panelItem
        ? toText(panelItem.type, '节点')
        : ((panelTerrainInfo && Array.isArray(panelTerrainInfo.terrainTypes) && panelTerrainInfo.terrainTypes.some(type => /海/.test(toText(type, '')))) ? '海域坐标点' : '野外坐标点'))
      : focusTypeDisplay;
    const currentSummaryBase = getActualCurrentLoc();
    // 取消在右侧面板的“当前位置”处硬拼坐标数字的逻辑
    const currentSummaryText = currentSummaryBase;
    const followItemName = currentVisibleName || (toText(rawCurrentName, '').split('-').filter(Boolean).pop() || toText(currentName, '').split('-').filter(Boolean).pop() || '');
    const followDetailItem = getItemByName(followItemName) || null;
    const detailPanelItem = panelMode === 'selection' ? focusItem : followDetailItem;
    const detailPrimaryLabel = panelMode === 'selection' ? '查看目标' : '当前位置';
    const detailBadgeText = panelMode === 'selection' ? '选中' : '跟随';
    const detailDisplayText = panelMode === 'selection' ? focusName : currentSummaryText;
    const detailTypeText = panelMode === 'selection'
      ? focusTypeDisplay
      : (detailPanelItem ? toText(detailPanelItem.type, '节点') : (inPreview && !previewCurrentBranch ? '真实位置' : '当前位置'));
    const detailActionText = panelMode === 'selection'
      ? focusActionDisplay
      : (detailPanelItem ? formatBehaviorLabels(detailPanelItem.interactions, getNodeInteractionLabel) : (inPreview && !previewCurrentBranch ? '预览中，真实位置未切换' : '跟随角色实时位置'));
    const detailAvailableText = panelMode === 'selection'
      ? focusAvailableText
      : (detailPanelItem ? (canEnterPreviewNode(detailPanelItem.name, snapshot) ? '可进入子图' : (Array.isArray(detailPanelItem.services) && detailPanelItem.services.length ? formatBehaviorLabels(detailPanelItem.services, getNodeServiceLabel) : '无')) : (inPreview && !previewCurrentBranch ? '退出预览后查看' : '无'));
    const panelActionText = hoverCoord
      ? (panelItem ? formatBehaviorLabels(panelItem.interactions, getNodeInteractionLabel) : '查看地形 / 点击后规划移动')
      : focusActionDisplay;
    const panelAvailableText = hoverCoord
      ? (panelItem
        ? (canEnterPreviewNode(panelItem.name, snapshot) ? '可进入子图' : (Array.isArray(panelItem.services) && panelItem.services.length ? formatBehaviorLabels(panelItem.services, getNodeServiceLabel) : '无'))
        : '无固定设施') 
      : focusAvailableText;
    const panelDescText = hoverCoord
      ? (panelItem
        ? toText(panelItem.desc, '暂无节点说明。')
        : '点击地图可将该坐标设为移动目标。')
      : focusDescText;
    const recommendText = previewRequest
      ? `前往 ${previewTarget}${previewTerrainShort} · ${previewRequest.method}${previewRequest.route_plan ? ` · ${previewRequest.route_plan}` : ''} · ${previewRequest.est_duration}`
      : isFreeSelection
        ? `已选中 ${focusName}${focusTerrainNarrative ? ` · ${focusTerrainNarrative}` : ''} · 可规划移动`
      : inPreview && !previewCurrentBranch
        ? (canPreviewEnter ? `${focusDescBaseText} · 可继续预览子图` : `远端区域预览 · 需先移动到 ${previewTrailNames[0] || previewAnchorName} 后再执行动作`)
      : inPreview && focusItem && !canPreviewEnter
        ? `当前节点可执行：${focusInteractionText}${focusServiceText !== '无' ? ` · 提供 ${focusServiceText}` : ''}${focusEventText !== '无' ? ' · 已挂接事件' : ''}`
      : canPreviewEnter
        ? `${focusDescBaseText} · 可进入子图预览`
      : focusItem && focusItem.canEnter
        ? `${focusDescBaseText} · 可下钻至子图`
        : (focusItem ? focusDescBaseText : '视野内无节点');
    const travelNote = inPreview
      ? `【子图预览】${focusName}${focusTerrainNarrative ? ` · ${focusTerrainNarrative}` : ''} · 当前位置保持为【${currentName}】`
      : pending ? `已安排前往 ${pendingTarget}${pendingTerrainShort}${pending.route_plan ? ` · ${pending.route_plan}` : ''}，预计 ${pending.est_duration}。` : previewRequest ? `准备前往 ${previewTarget}${previewTerrainShort}${previewRequest.route_plan ? ` · ${previewRequest.route_plan}` : ''}，推荐 ${previewRequest.method}，预计 ${previewRequest.est_duration}。` : `当前地图 ${getMapDisplayName(snapshot.currentMapId, null)}，可视节点 ${snapshot.visibleNodes.length} 个。`;
    const inspectButtonLabel = inPreview && focusItem && !canPreviewEnter ? primaryInteractionLabel : '查看';

    const 在场人物面板 = 构建星图在场人物列表HTML({
      snapshot,
      focusItem,
      detailPanelItem,
      panelMode,
      isFreeSelection,
      inPreview,
      previewCurrentBranch,
      previewTrailNames,
      previewAnchorName,
      focusName,
      currentName,
      rawCurrentName,
      输出模式: 'select'
    });
    const characterEntries = 在场人物面板.entries || [];
    const selectedNpc = toText(在场人物面板.selectedNpc, '');
    const focusCharactersText = toText(在场人物面板.charactersText, '无');
    const panelCharactersText = focusCharactersText;
    const 在场人物节点文本 = toText(在场人物面板.nodeText, panelMode === 'selection' ? (isFreeSelection ? '自由坐标' : focusName) : (currentName || '未知地点'));
    const npcListHtml = 在场人物面板.html;

    const currentMapDisplayName = getMapDisplayName(snapshot.currentMapId, snapshot.mapMeta);
    setMapText('[data-map-focus]', inPreview ? `${toText(deepGet(snapshot, 'mapMeta.name', '地图预览'), '地图预览')} · ${previewAnchorName} [预览]` : `${toText(deepGet(snapshot, 'mapMeta.name', '全息星图'), '全息星图')} · ${focusName}`);
    setMapText('[data-map-chain]', inPreview ? `${previewTrailText} · ${currentMapDisplayName}` : `${currentMapDisplayName} → ${focusName}`);
    setMapText('[data-map-recommend]', recommendText);
    setMapText('[data-map-recommend-side]', dynamicRecommendText);
    setMapText('[data-map-anchor]', focusName);
    setMapText('[data-map-panel-primary-label]', detailPrimaryLabel);
    setMapText('[data-map-panel-mode-badge]', detailBadgeText);
    setMapText('[data-map-current-name]', detailDisplayText);
    const syncStateText = toText(mapState.syncStatus, '待同步');
    const syncDisplayText = mapState.lastSyncAt ? `${syncStateText} · ${formatMapSyncTime(mapState.lastSyncAt)}` : syncStateText;
    setMapText('[data-map-sync-status]', syncDisplayText);
    getMapUiElements('[data-map-panel-mode]').forEach(btn => {
      btn.classList.toggle('current', toText(btn.dataset.mapPanelMode, 'follow') === panelMode);
    });
    getMapUiElements('[data-map-sync-chip]').forEach(chip => {
      chip.classList.toggle('is-error', /失败|异常/.test(syncStateText));
      chip.classList.toggle('gold', /无变化/.test(syncStateText));
      chip.classList.toggle('live', !/失败|异常|无变化/.test(syncStateText));
    });
    const hoverCoordDisplayText = hoverCoord && hoverImageCoord
      ? `图 ${hoverImageCoord.x},${hoverImageCoord.y}` : '--,--';
    setMapText('[data-map-current-coord]', hoverCoordDisplayText);
    setMapText('[data-map-current-terrain]', panelTerrainText);
    setMapText('[data-map-target-terrain]', panelTerrainText);
    setMapText('[data-map-target-name]', panelName);
    setMapText('[data-map-focus-type]', detailTypeText);
    setMapText('[data-map-focus-faction]', detailActionText);
    setMapText('[data-map-focus-state]', focusStateText);
    setMapText('[data-map-focus-importance]', focusImportanceText);
    setMapText('[data-map-focus-childmap]', detailAvailableText);
    setMapText('[data-map-preview-path]', previewPathLabel);
    setMapText('[data-map-enter-brief]', enterBriefText);
    setMapText('[data-map-layer-brief]', `${getMapLevelText(snapshot.mapLevel)} / ${currentMapDisplayName}`);
    setMapText('[data-map-focus-characters]', panelCharactersText);
    setMapText('[data-map-npc-node]', 在场人物节点文本);
    setMapText('[data-map-npc-count]', String(characterEntries.length));
    setMapHtml('[data-map-npc-list]', npcListHtml);
    setMapText('[data-map-request-mode]', actionModeText);
    let rowActionMethod = actionOperationText;
    if (inPreview && focusItem && !canPreviewEnter) {
      const actions = Array.isArray(focusItem.interactions) ? focusItem.interactions : [];
      if (actions.length > 0) rowActionMethod = actions.map(getNodeInteractionLabel).join(' / ');
    }
    const travelMethodDisplay = travelMethodText === '无' ? '无' : travelMethodText;
    setMapText('[data-map-request-method]', travelMethodDisplay);
    setMapText('[data-map-request-targetloc]', actionTargetText);
    setMapText('[data-map-request-coord]', actionMoveText);
    setMapText('[data-map-request-cost]', actionCostText);
    setMapText('[data-map-request-panel-hint]', isFreeSelection && previewRequest ? '开始移动' : pendingForSelection ? '确认前往' : (previewRequest ? '开始移动' : '选择目标'));
    setMapText('[data-map-request-json]', travelNote);
    setMapText('[data-map-request-state]', pending ? `待前往 ${pendingTarget} / ${pending.method}${pending.route_plan ? ` / ${pending.route_plan}` : ''} / ${pending.est_duration}` : previewRequest ? `${isFreeSelection ? '可移动' : '可前往'} ${previewTarget} / ${previewRequest.method}${previewRequest.route_plan ? ` / ${previewRequest.route_plan}` : ''} / ${previewRequest.est_duration}` : '留驻当前地点');
    setMapText('[data-map-request-chip]', pending ? '已规划' : previewRequest ? (isFreeSelection ? '可移动' : '待确认') : '停留中');
    setMapText('[data-map-foot-hint]', inPreview
      ? (previewCurrentBranch
          ? (canPreviewEnter ? '当前区域子图 · 双击节点继续进入，当前位置不会改变' : '当前区域子图 · 使用下方操作台行动')
          : (canPreviewEnter ? '远端子图预览 · 双击节点继续查看结构，当前位置不会改变' : '远端子图预览 · 仅供查看，需先移动到该城市后再执行动作'))
      : (travelPreview ? (isFreeSelection ? `点击开始移动 · ${travelPreview.method} · 预计 ${travelPreview.duration}${travelPreview.routePlanText ? ` · ${travelPreview.routePlanText}` : ''}` : pendingForSelection ? `再次点击即可动身 · ${travelPreview.method} · ${travelPreview.duration}${travelPreview.routePlanText ? ` · ${travelPreview.routePlanText}` : ''}` : `已选定目标 · ${travelPreview.method} · 预计 ${travelPreview.duration}${travelPreview.routePlanText ? ` · ${travelPreview.routePlanText}` : ''}`) : `${mapState.lastTravelNote || `display_map 已接入 · 当前地图 ${snapshot.currentMapId} · 可视 ${getVisibleMapNodeCount()} 个节点`}`));
    setMapText('[data-map-action-label]', actionLabel);

    try {
      const 星图焦点详情 = {
        焦点名称: focusName,
        地图名称: currentMapDisplayName,
        类型: focusTypeDisplay,
        功能: focusActionDisplay,
        可用: focusAvailableText,
        状态: focusStateText,
        地形: focusTerrainText || panelTerrainText,
        说明: focusDescBaseText,
        自由坐标: isFreeSelection,
        是否当前位置: isFocusCurrentNode,
      };
      const 星图焦点签名 = [
        星图焦点详情.焦点名称,
        星图焦点详情.地图名称,
        星图焦点详情.类型,
        星图焦点详情.功能,
        星图焦点详情.可用,
        星图焦点详情.状态,
        星图焦点详情.地形,
        星图焦点详情.自由坐标 ? '1' : '0',
        星图焦点详情.是否当前位置 ? '1' : '0',
      ].join('|');
      if (renderMapInfoState.上一焦点签名 !== 星图焦点签名) {
        renderMapInfoState.上一焦点签名 = 星图焦点签名;
        window.dispatchEvent(new CustomEvent('sheep-map-focus-change', { detail: 星图焦点详情 }));
      }
    } catch (错误) {}

    const actionSlotCandidates = [];
    const pushActionSlot = (action, text, options = {}) => {
      const normalized = toText(action, '');
      if (!normalized || actionSlotCandidates.some(slot => slot.action === normalized)) return;
      actionSlotCandidates.push({
        action: normalized,
        text: toText(text, getNodeInteractionLabel(normalized)),
        disabled: !!options.disabled,
        reason: toText(options.reason, ''),
        需要移动: !!options.需要移动
      });
    };

    const timedHint = description => toText(description, '');
    const 合并动作说明文本 = (...文本列表) => 文本列表
      .map(text => toText(text, '').trim())
      .filter(Boolean)
      .join(' · ');
    const 构建动作摘要文本 = (动作预览, 默认说明) => 合并动作说明文本(
      动作预览?.slotReason || timedHint(默认说明),
      动作预览?.mimicHint || ''
    );
    const pushMappedActionSlot = (action, options = {}) => {
      const normalized = toText(action, '');
      if (!normalized || ['inspect', 'enter'].includes(normalized)) return;
      const 需要移动 = !!options.需要移动;
      const 包装动作说明 = 文本 => 需要移动 ? 合并动作说明文本('抵达后执行', 文本) : 文本;
      if (['train', 'train_body', 'train_mind'].includes(normalized)) {
        const actionPreview = buildRoutineActionPreview(mapState.baseSnapshot || snapshot, 获取地图训练执行动作(), focusItem, 获取地图日常动作tick());
        pushActionSlot('train', '训练', { reason: 包装动作说明(构建动作摘要文本(actionPreview, '训练')), 需要移动 });
        return;
      }
      if (normalized === 'meditate') {
        const actionPreview = buildRoutineActionPreview(mapState.baseSnapshot || snapshot, normalized, focusItem, 获取地图日常动作tick());
        pushActionSlot('meditate', '冥想', { reason: 包装动作说明(构建动作摘要文本(actionPreview, '冥想')), 需要移动 });
        return;
      }
      if (normalized === 'rest') {
        const actionPreview = buildRoutineActionPreview(mapState.baseSnapshot || snapshot, normalized, focusItem, 获取地图日常动作tick());
        pushActionSlot('rest', '休息', { reason: 包装动作说明(构建动作摘要文本(actionPreview, '休息')), 需要移动 });
        return;
      }
      if (normalized === 'sleep') {
        const actionPreview = buildRoutineActionPreview(mapState.baseSnapshot || snapshot, normalized, focusItem, 获取地图日常动作tick());
        pushActionSlot('sleep', '睡眠', { reason: 包装动作说明(构建动作摘要文本(actionPreview, '睡眠/恢复类动作')), 需要移动 });
        return;
      }
      pushActionSlot(normalized, getNodeInteractionLabel(normalized), { reason: 需要移动 ? '抵达后执行' : '', 需要移动 });
    };
    const allowLocalActions = !!(isFocusCurrentNode && (!inPreview || previewCurrentBranch));
    const allowTravelQueuedActions = !!(!allowLocalActions && focusItem && !isFreeSelection && !canPreviewEnter && travelPreview && (!inPreview || previewCurrentBranch));

    if (inPreview && !previewCurrentBranch && previewTrailNames[0]) {
      pushActionSlot('travel_anchor', `前往${previewTrailNames[0]}`, { reason: '移动到子图入口' });
    } else if (travelPreview) {
      const travelDisabled = !!(previewRequest && previewRequest.costs && !previewRequest.costs.canAfford);
      pushActionSlot('travel', isFreeSelection ? '开始移动' : pendingForSelection ? '确认前往' : '规划路线', { reason: '', disabled: travelDisabled });
    } else if (focusItem && canPreviewEnter) {
      pushActionSlot('enter', '进入子图', { reason: '预览子地图，不改变当前位置' });
    }
    if ((allowLocalActions || allowTravelQueuedActions) && !canPreviewEnter) {
      获取节点本地动作(focusItem, mapState.baseSnapshot || snapshot).forEach(action => {
        pushMappedActionSlot(action, { 需要移动: allowTravelQueuedActions });
      });
    }

    let selectedAction = toText(mapState.selectedAction, '');
    if (['train_body', 'train_mind'].includes(selectedAction)) {
      selectedAction = 'train';
      mapState.selectedAction = 'train';
    }
    if (!selectedAction || !actionSlotCandidates.some(slot => slot.action === selectedAction)) {
      const fallbackSlot = actionSlotCandidates.find(slot => !slot.disabled) || actionSlotCandidates[0] || null;
      selectedAction = fallbackSlot ? fallbackSlot.action : '';
      mapState.selectedAction = selectedAction;
    }
    const selectedActionSlot = actionSlotCandidates.find(slot => slot.action === selectedAction) || null;
    const selectedActionLabel = selectedAction ? getNodeInteractionLabel(selectedAction) : '动作';
    const 当前日常tick = 获取地图日常动作tick();
    const 当前日常时长文本 = 格式化地图日常时长(当前日常tick);
    const selectedActionDetail = {
      title: '待命',
      labels: ['目标', '说明', '消耗'],
      values: ['无', '无', '无'],
      panelDisabled: !selectedActionSlot,
      showTravelMethod: selectedAction === 'travel' || !!(selectedActionSlot && selectedActionSlot.需要移动),
      travelMethodLabel: '方式'
    };

    if (inPreview && !previewCurrentBranch) {
      if (selectedAction === 'travel_anchor' && selectedActionSlot) {
        selectedActionDetail.title = `点击前往${previewTrailNames[0] || previewAnchorName}`;
        selectedActionDetail.labels = ['目标', '状态', '说明'];
        selectedActionDetail.values = [
          previewTrailNames[0] || previewAnchorName,
          '远端预览',
          '先抵达入口，再进入子图执行节点行动'
        ];
        selectedActionDetail.panelDisabled = false;
      } else {
        selectedActionDetail.title = '当前为远端区域预览';
        selectedActionDetail.labels = ['节点', '条件', '说明'];
        selectedActionDetail.values = [
          focusName,
          `需先移动到【${previewTrailNames[0] || previewAnchorName}】`,
          canPreviewEnter ? '双击节点可继续查看子图结构' : '这里只是预览，不会改变你的真实位置'
        ];
        selectedActionDetail.panelDisabled = true;
        mapState.selectedAction = '';
        selectedAction = '';
      }
    } else if (!selectedActionSlot && focusItem && canPreviewEnter) {
      selectedActionDetail.title = '进入子图';
      selectedActionDetail.labels = ['节点', '方式', '说明'];
      selectedActionDetail.values = [focusName, '双击', '预览，不改位置'];
      selectedActionDetail.panelDisabled = true;
      mapState.selectedAction = '';
      selectedAction = '';
    } else if (!selectedActionSlot && focusItem && !canPreviewEnter) {
      if (!isFocusCurrentNode) {
        selectedActionDetail.title = '需先移动到该节点';
        selectedActionDetail.labels = ['节点', '条件', '说明'];
        selectedActionDetail.values = [
          focusName,
          currentActionNodeName ? `你当前位于【${currentActionNodeName}】` : '需要先移动到该节点',
          '先在左侧选择“规划路线/确认前往”，抵达后再执行本地训练、交易或互动。'
        ];
      } else {
        selectedActionDetail.title = '当前节点无可执行动作';
        selectedActionDetail.labels = ['节点', '状态', '说明'];
        selectedActionDetail.values = [focusName, '无动作', focusDescBaseText || '可先切换节点或返回上级'];
      }
      selectedActionDetail.panelDisabled = true;
      mapState.selectedAction = '';
      selectedAction = '';
    } else if (selectedActionSlot) {
      if (selectedActionSlot.需要移动) {
        selectedActionDetail.title = `前往后${selectedActionLabel}`;
        selectedActionDetail.labels = ['动作', '移动', '消耗'];
        selectedActionDetail.values = [selectedActionLabel, actionMoveText, actionCostText];
        selectedActionDetail.panelDisabled = !travelPreview;
      } else if (selectedAction === 'travel') {
        selectedActionDetail.title = isFreeSelection && previewRequest ? '开始移动' : pendingForSelection ? '确认前往' : (previewRequest ? '开始移动' : '选择目标');
        selectedActionDetail.labels = ['目标', '时间', '消耗'];
        selectedActionDetail.values = [actionTargetText, actionMoveText, actionCostText];
        selectedActionDetail.panelDisabled = !travelPreview || !!selectedActionSlot.disabled;
      } else if (selectedAction === 'enter') {
        selectedActionDetail.title = '进入子图';
        selectedActionDetail.labels = ['节点', '方式', '说明'];
        selectedActionDetail.values = [focusName, '点击', selectedActionSlot.reason || '预览子地图，不改变当前位置'];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      } else if (selectedAction === 'meditate') {
        const actionPreview = buildRoutineActionPreview(mapState.baseSnapshot || snapshot, 'meditate', focusItem, 当前日常tick);
        const 结算说明 = actionPreview.detailText || '恢复状态';
        selectedActionDetail.title = '冥想';
        selectedActionDetail.labels = ['行动', '时长', '收益'];
        selectedActionDetail.values = ['冥想', 当前日常时长文本, 结算说明];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      } else if (selectedAction === 'train') {
        const 训练动作 = 获取地图训练执行动作();
        const actionPreview = buildRoutineActionPreview(mapState.baseSnapshot || snapshot, 训练动作, focusItem, 当前日常tick);
        const 结算说明 = actionPreview.detailText || `${获取地图训练项目标题()}收益`;
        selectedActionDetail.title = '训练';
        selectedActionDetail.labels = ['内容', '时长', '收益'];
        selectedActionDetail.values = [获取地图训练项目标题(), 当前日常时长文本, 结算说明];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      } else if (selectedAction === 'rest') {
        const actionPreview = buildRoutineActionPreview(mapState.baseSnapshot || snapshot, 'rest', focusItem, 当前日常tick);
        const 结算说明 = actionPreview.detailText || '恢复状态';
        selectedActionDetail.title = '休息';
        selectedActionDetail.labels = ['行动', '时长', '恢复'];
        selectedActionDetail.values = ['休息', 当前日常时长文本, 结算说明];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      } else if (selectedAction === 'sleep') {
        const actionPreview = buildRoutineActionPreview(mapState.baseSnapshot || snapshot, 'sleep', focusItem, 当前日常tick);
        const 结算说明 = actionPreview.detailText || '恢复状态';
        selectedActionDetail.title = '睡眠';
        selectedActionDetail.labels = ['行动', '时长', '恢复'];
        selectedActionDetail.values = ['睡眠', 当前日常时长文本, 结算说明];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      } else if (selectedAction === 'talk') {
        selectedActionDetail.title = selectedNpc ? `对话 · ${selectedNpc}` : '对话';
        selectedActionDetail.labels = ['对象', '地点', '说明'];
        selectedActionDetail.values = [selectedNpc || selectedActionSlot.reason || focusCharactersText, focusName, selectedNpc ? `将在当前节点与【${selectedNpc}】交谈` : '将在当前节点发起人物交谈'];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      } else if (selectedAction === 'battle') {
        selectedActionDetail.title = selectedNpc ? `切磋 · ${selectedNpc}` : '切磋';
        selectedActionDetail.labels = ['对象', '地点', '说明'];
        selectedActionDetail.values = [selectedNpc || selectedActionSlot.reason || focusCharactersText, focusName, selectedNpc ? `将在当前节点与【${selectedNpc}】切磋` : '将在当前节点触发切磋分发'];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      } else if (selectedAction === 'craft') {
        const extraInfo = [
          selectedActionSlot.reason,
          focusServiceText !== '无' ? `提供 ${focusServiceText}` : '',
          focusEventText !== '无' ? `事件 ${focusEventText}` : '',
          focusItem ? toText(focusItem.desc, '') : ''
        ].filter(Boolean).join(' · ') || '将在当前地点办理工坊委托';
        selectedActionDetail.title = selectedActionLabel;
        selectedActionDetail.labels = ['动作', '地点', '说明'];
        selectedActionDetail.values = [selectedActionLabel, focusName, extraInfo];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      } else if (selectedNpc && ['trade', 'bid'].includes(selectedAction)) {
        const npcActionInfo = [
          focusServiceText !== '无' ? `提供 ${focusServiceText}` : '',
          focusEventText !== '无' ? `事件 ${focusEventText}` : '',
          selectedActionSlot.reason && selectedActionSlot.reason !== selectedNpc ? selectedActionSlot.reason : ''
        ].filter(Boolean).join(' · ') || `将在当前节点与【${selectedNpc}】进行${selectedActionLabel}`;
        selectedActionDetail.title = `${selectedActionLabel} · ${selectedNpc}`;
        selectedActionDetail.labels = ['对象', '地点', '说明'];
        selectedActionDetail.values = [selectedNpc, focusName, npcActionInfo];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      } else {
        const extraInfo = [
          selectedActionSlot.reason,
          focusServiceText !== '无' ? `提供 ${focusServiceText}` : '',
          focusEventText !== '无' ? `事件 ${focusEventText}` : '',
          focusItem ? toText(focusItem.desc, '') : ''
        ].filter(Boolean).join(' · ') || '无';
        selectedActionDetail.title = selectedActionLabel;
        selectedActionDetail.labels = ['动作', '节点', '信息'];
        selectedActionDetail.values = [selectedActionLabel, focusName, extraInfo];
        selectedActionDetail.panelDisabled = !!selectedActionSlot.disabled;
      }

      if (selectedActionSlot.disabled && selectedActionSlot.reason) {
        selectedActionDetail.values[2] = selectedActionSlot.reason;
      }
    }

    const 当前行动展示槽 = selectedActionSlot
      ? selectedActionSlot
      : (selectedActionDetail.title
        ? {
            action: selectedAction || '',
            text: selectedActionDetail.title,
            disabled: true,
            reason: selectedActionDetail.values.filter(Boolean).join(' · ')
          }
        : null);
    const 当前行动标题 = 当前行动展示槽 ? toText(当前行动展示槽.text, selectedActionDetail.title) : selectedActionDetail.title;
    const 行动选择签名 = actionSlotCandidates.map(slot => [
      slot.action,
      slot.text,
      slot.disabled ? '1' : '0',
      slot.reason
    ].join('::')).join('|');
    getMapUiElements('[data-map-action-select]').forEach(选择框 => {
      if (!(选择框 instanceof HTMLSelectElement)) return;
      if (选择框.dataset.mapActionOptionsSignature !== 行动选择签名) {
        选择框.innerHTML = '';
        if (!actionSlotCandidates.length) {
          const 空选项 = document.createElement('option');
          空选项.value = '';
          空选项.textContent = '暂无可用行动';
          空选项.disabled = true;
          选择框.appendChild(空选项);
        } else {
          actionSlotCandidates.forEach(slot => {
            const 行动选项 = document.createElement('option');
            行动选项.value = slot.action;
            行动选项.textContent = slot.disabled ? `${slot.text}（不可用）` : slot.text;
            行动选项.disabled = !!slot.disabled && slot.action !== selectedAction;
            行动选项.title = slot.reason || slot.text;
            选择框.appendChild(行动选项);
          });
        }
        选择框.dataset.mapActionOptionsSignature = 行动选择签名;
      }
      选择框.disabled = !actionSlotCandidates.length;
      选择框.value = actionSlotCandidates.some(slot => slot.action === selectedAction) ? selectedAction : '';
      选择框.title = 当前行动展示槽 ? [当前行动展示槽.text, 当前行动展示槽.reason].filter(Boolean).join(' · ') : '暂无可用行动';
    });
    getMapUiElements('[data-map-duration-wrap]').forEach(容器 => {
      容器.classList.toggle('is-hidden', !是否地图可变时长动作(selectedAction));
    });
    getMapUiElements('[data-map-duration-cell]').forEach(容器 => {
      容器.classList.toggle('duration-active', 是否地图可变时长动作(selectedAction));
      容器.classList.toggle('is-actionable', 是否地图可变时长动作(selectedAction));
      容器.title = 是否地图可变时长动作(selectedAction) ? '编辑时长' : '';
    });
    getMapUiElements('[data-map-training-cell]').forEach(容器 => {
      容器.classList.toggle('training-active', selectedAction === 'train');
      容器.title = selectedAction === 'train' ? '选择训练内容' : '';
    });
    getMapUiElements('[data-map-request-coord]').forEach(文本 => {
      文本.classList.remove('is-hidden');
    });
    getMapUiElements('[data-map-request-targetloc]').forEach(文本 => {
      文本.classList.remove('is-hidden');
    });
    getMapUiElements('[data-map-duration-text]').forEach(文本 => {
      文本.contentEditable = 是否地图可变时长动作(selectedAction) ? 'true' : 'false';
    });
    getMapUiElements('[data-map-training-select]').forEach(选择框 => {
      if (!(选择框 instanceof HTMLSelectElement)) return;
      选择框.disabled = selectedAction !== 'train';
      选择框.classList.toggle('is-hidden', selectedAction !== 'train');
      选择框.value = 获取地图训练项目();
    });
    getMapUiElements('[data-map-action-execute]').forEach(按钮 => {
      按钮.classList.toggle('disabled', !当前行动展示槽 || !!selectedActionDetail.panelDisabled);
      按钮.disabled = !当前行动展示槽 || !!selectedActionDetail.panelDisabled;
      按钮.dataset.mapActionBtn = 当前行动展示槽 && 当前行动展示槽.action ? 当前行动展示槽.action : '';
      按钮.title = 当前行动展示槽 && !selectedActionDetail.panelDisabled ? `执行 ${当前行动标题}` : '当前行动不可执行';
    });
    setMapText('[data-map-selected-action]', 当前行动标题 || '待命');
    getMapUiElements('[data-map-travel-cycle]').forEach(row => {
      row.classList.toggle('is-hidden', !selectedActionDetail.showTravelMethod);
      row.classList.toggle('disabled', !selectedActionDetail.showTravelMethod || !travelPreview);
      row.title = selectedActionDetail.showTravelMethod ? '切换移动方式' : '';
    });
    getMapUiElements('[data-map-travel-panel]').forEach(panel => {
      panel.classList.toggle('disabled', !!selectedActionDetail.panelDisabled);
      panel.classList.toggle('has-method', !!selectedActionDetail.showTravelMethod);
    });
    setMapText('[data-map-request-method]', travelMethodDisplay);
    setMapText('[data-map-request-panel-hint]', selectedActionDetail.title);
    setMapText("[data-map-request-label='0']", selectedActionDetail.labels[0]);
    setMapText("[data-map-request-label='1']", selectedActionDetail.labels[1]);
    setMapText("[data-map-request-label='2']", selectedActionDetail.labels[2]);
    setMapText('[data-map-request-targetloc]', selectedActionDetail.values[0]);
    setMapText('[data-map-request-coord]', selectedActionDetail.values[1]);
    setMapText('[data-map-request-cost]', selectedActionDetail.values[2]);

    setMapText('[data-map-primary-panel-title]', '详细信息');
    setMapText('[data-map-secondary-panel-title]', '人物');
    getMapUiElements('[data-map-secondary-panel-badge]').forEach(徽章 => {
      徽章.innerHTML = `<span data-map-npc-count>${characterEntries.length}</span> 人`;
    });

    getMapUiElements('[data-map-travel-action]').forEach(card => {
      card.classList.toggle('disabled', !travelPreview || (inPreview && !previewCurrentBranch));
    });
    getMapUiElements("[data-map-control='back']").forEach(btn => {
      btn.disabled = !inPreview;
      btn.classList.toggle('active', inPreview);
    });
    ensureMapInteractionBindings();
    updateMapCoordinateReadout();
  }

  function applyMapWorldTransform(options = {}) {
    const {
      updateReadout = true,
      updateMiniMap = true,
      measureEdges = true,
      updateNodeScale = true,
      canvasEl = null
    } = options || {};
    const renderZoom = getMapRenderZoom();
    const panX = Math.round(toNumber(mapState.panX, 0));
    const panY = Math.round(toNumber(mapState.panY, 0));
    const worldEls = canvasEl
      ? getScopedMapUiElements(canvasEl, '[data-map-world]')
      : getMapUiElements('[data-map-world]');
    worldEls.forEach(world => {
      const nodeUiScale = clamp(1 / Math.max(renderZoom, 1), 0.08, 1);
      const 关联画布 = world.closest('.map-canvas.interactive-map');
      if (!设置地图画布快速变换(关联画布, panX, panY, renderZoom)) {
        setMapNodeStyle(world, 'transform', `translate3d(${panX}px, ${panY}px, 0) scale(${Number(renderZoom.toFixed(3))})`);
      }
      if (updateNodeScale) setMapNodeStyle(world, '--node-ui-scale', String(nodeUiScale));
      if (measureEdges && 关联画布) 更新地图节点标签边缘状态(关联画布);
    });
    if (updateReadout) updateMapCoordinateReadout(canvasEl || null);
    if (updateMiniMap) renderMiniMapState(canvasEl || undefined);
  }

  function 延后同步地图交互附属状态(canvasEl = getPrimaryMapCanvas()) {
    if (延后同步地图交互附属状态.计时器) clearTimeout(延后同步地图交互附属状态.计时器);
    延后同步地图交互附属状态.计时器 = setTimeout(() => {
      延后同步地图交互附属状态.计时器 = null;
      if (mapDragState.active || miniMapDragState.active) return;
      applyMapWorldTransform({ canvasEl, updateReadout: false, updateMiniMap: false, measureEdges: false, updateNodeScale: true });
      if (canvasEl) canvasEl.classList.remove('map-transforming');
      if (canvasEl) 更新地图节点标签边缘状态(canvasEl);
      updateMapCoordinateReadout(canvasEl);
      renderMiniMapState(canvasEl);
    }, 120);
  }

  function scheduleMapDragTransform() {
    if (mapDragState.raf) return;
    mapDragState.raf = requestAnimationFrame(() => {
      mapDragState.raf = 0;
      applyMapWorldTransform({
        canvasEl: mapDragState.sourceCanvas || getPrimaryMapCanvas(),
        updateReadout: false,
        updateMiniMap: false,
        measureEdges: false,
        updateNodeScale: false
      });
    });
  }

  function setMapHoverPoint(canvasEl, clientX, clientY) {
    mapState.hoverCanvas = canvasEl || null;
    mapState.cursorClientX = clientX ?? null;
    mapState.cursorClientY = clientY ?? null;
    const point = resolveMapClientPoint(canvasEl, clientX, clientY);
    if (!point) {
      mapState.hoverLocalX = null;
      mapState.hoverLocalY = null;
      mapState.hoverCoord = null;
      return;
    }
    mapState.hoverLocalX = point.renderX;
    mapState.hoverLocalY = point.renderY;
    mapState.hoverCoord = point.inside ? convertMapLocalPointToCoord(point.localX, point.localY, canvasEl) : null;
  }

  function handleMapWheel(event) {
    event.preventDefault();
    event.stopPropagation();
    const canvasEl = event.currentTarget;
    const point = resolveMapClientPoint(canvasEl, event.clientX, event.clientY);
    const oldZoom = Math.max(MIN_MAP_ZOOM, toNumber(mapState.zoom, MIN_MAP_ZOOM));
    const oldRenderZoom = getMapRenderZoom(oldZoom);
    const step = event.deltaY < 0 ? 0.28 : -0.28;
    const nextZoom = clamp(Number((oldZoom + step).toFixed(2)), MIN_MAP_ZOOM, MAX_MAP_ZOOM);
    const nextRenderZoom = getMapRenderZoom(nextZoom);
    if (Math.abs(nextZoom - oldZoom) < 1e-6) return;
    if (canvasEl && canvasEl.clientWidth && canvasEl.clientHeight) {
      const anchorX = point ? point.localX : (canvasEl.clientWidth / 2);
      const anchorY = point ? point.localY : (canvasEl.clientHeight / 2);
      const cx = canvasEl.clientWidth / 2;
      const cy = canvasEl.clientHeight / 2;
      mapState.panX = Number((anchorX - cx - ((anchorX - cx - mapState.panX) / oldRenderZoom) * nextRenderZoom).toFixed(2));
      mapState.panY = Number((anchorY - cy - ((anchorY - cy - mapState.panY) / oldRenderZoom) * nextRenderZoom).toFixed(2));
    }
    const 原图层 = mapState.layer;
    mapState.zoom = nextZoom;
    clampMapPan(canvasEl);
    mapState.hoverCanvas = canvasEl || null;
    mapState.cursorClientX = event.clientX ?? null;
    mapState.cursorClientY = event.clientY ?? null;
    mapState.hoverLocalX = point ? point.renderX : null;
    mapState.hoverLocalY = point ? point.renderY : null;
    mapState.hoverCoord = point && point.inside ? convertMapLocalPointToCoord(point.localX, point.localY, canvasEl) : null;
    if (mapState.layerFollowsZoom) mapState.layer = resolveMapLayerByZoom(mapState.zoom);
    if (mapState.layer !== 原图层) {
      syncInteractiveMapUI({ center: false, updateInfo: false });
      return;
    }
    if (canvasEl) canvasEl.classList.add('map-transforming');
    applyMapWorldTransform({ canvasEl, updateReadout: false, updateMiniMap: false, measureEdges: false, updateNodeScale: false });
    延后同步地图交互附属状态(canvasEl);
  }

  function handleMapPointerDown(event) {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('.map-node')) return;
    event.preventDefault();
    event.stopPropagation();
    cancelScheduledHoverSync();
    if (mapDragState.raf) {
      cancelAnimationFrame(mapDragState.raf);
      mapDragState.raf = 0;
    }
    mapDragState.lastMiniMapSyncAt = 0;
    const point = resolveMapClientPoint(event.currentTarget, event.clientX, event.clientY);
    mapDragState.active = true;
    mapDragState.moved = false;
    mapDragState.startX = point ? point.localX : event.clientX;
    mapDragState.startY = point ? point.localY : event.clientY;
    mapDragState.起始客户端X = event.clientX;
    mapDragState.起始客户端Y = event.clientY;
    mapDragState.originX = mapState.panX;
    mapDragState.originY = mapState.panY;
    mapDragState.sourceCanvas = event.currentTarget;
    event.currentTarget.classList.add('dragging');
    if (typeof event.currentTarget.setPointerCapture === 'function' && event.pointerId !== undefined) {
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch(e) {}
    }
    
  }

  function handleMapPointerMove(event) {
    if (!mapDragState.active) return;
    const 事件目标 = event && event.target instanceof Element ? event.target : null;
    const canvasEl = mapDragState.sourceCanvas || mapState.hoverCanvas || (事件目标 ? 事件目标.closest('.map-canvas.interactive-map') : null) || getPrimaryMapCanvas();
    const deltaX = event.clientX - mapDragState.起始客户端X;
    const deltaY = event.clientY - mapDragState.起始客户端Y;
    mapState.panX = mapDragState.originX + deltaX;
    mapState.panY = mapDragState.originY + deltaY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) mapDragState.moved = true;
    clampMapPan(canvasEl);
    scheduleMapDragTransform();
    event.preventDefault();
    event.stopPropagation();
  }

  function 拦截地图拖动全局指针事件(事件) {
    const 移动事件 = 事件.type === 'pointermove' || 事件.type === 'mousemove';
    const 结束事件 = 事件.type === 'pointerup' || 事件.type === 'pointercancel' || 事件.type === 'mouseup';
    if (!移动事件 && !结束事件) return;
    if (mapDragState.active) {
      if (移动事件) handleMapPointerMove(事件);
      else handleMapPointerUp(事件);
    } else if (miniMapDragState.active) {
      if (移动事件) handleMiniMapPointerMove(事件);
      else handleMiniMapPointerUp(事件);
    } else {
      return;
    }
    if (typeof 事件.stopImmediatePropagation === 'function') 事件.stopImmediatePropagation();
    else 事件.stopPropagation();
  }

  function handleMiniMapPointerDown(event) {
    if (event.button !== 0) return;
    cancelScheduledHoverSync();
    const miniWorldEl = event.currentTarget.closest('.map-mini-world') || event.currentTarget;
    miniMapDragState.active = true;
    miniMapDragState.sourceEl = miniWorldEl;
    miniMapDragState.pointerId = event.pointerId;
    const viewportEl = miniWorldEl.querySelector('[data-map-mini-viewport]');
    const viewportRect = viewportEl && typeof viewportEl.getBoundingClientRect === 'function' ? viewportEl.getBoundingClientRect() : null;
    if (event.target.closest('[data-map-mini-viewport]') && viewportRect && viewportRect.width > 0 && viewportRect.height > 0) {
      miniMapDragState.offsetX = event.clientX - (viewportRect.left + viewportRect.width / 2);
      miniMapDragState.offsetY = event.clientY - (viewportRect.top + viewportRect.height / 2);
    } else {
      miniMapDragState.offsetX = 0;
      miniMapDragState.offsetY = 0;
    }
    miniWorldEl.classList.add('dragging');
    updateMapFromMiniMapClientPoint(miniWorldEl, event.clientX, event.clientY);
    
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function handleMiniMapPointerMove(event) {
    if (!miniMapDragState.active || !miniMapDragState.sourceEl) return;
    if (miniMapDragState.pointerId !== null && event.pointerId !== undefined && event.pointerId !== miniMapDragState.pointerId) return;
    updateMapFromMiniMapClientPoint(miniMapDragState.sourceEl, event.clientX, event.clientY);
  }

  function handleMiniMapPointerUp(event) {
    if (!miniMapDragState.active) return;
    if (miniMapDragState.pointerId !== null && event && event.pointerId !== undefined && event.pointerId !== miniMapDragState.pointerId) return;
    if (miniMapDragState.sourceEl) miniMapDragState.sourceEl.classList.remove('dragging');
    if (event && event.currentTarget && typeof event.currentTarget.releasePointerCapture === 'function') {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch(e) {}
    }
    miniMapDragState.active = false;
    miniMapDragState.sourceEl = null;
    miniMapDragState.pointerId = null;
    miniMapDragState.offsetX = 0;
    miniMapDragState.offsetY = 0;
    scheduleHoverSync(getPrimaryMapCanvas());
  }

  function handleMapPointerUp(event) {
    if (!mapDragState.active) return;
    const releaseCanvas = mapDragState.sourceCanvas || getPrimaryMapCanvas();
    mapDragState.active = false;
    if (mapDragState.moved) mapDragState.lastDragAt = Date.now();
    if (mapDragState.raf) {
      cancelAnimationFrame(mapDragState.raf);
      mapDragState.raf = 0;
    }
    mapDragState.sourceCanvas = null;
    if (event && releaseCanvas && typeof releaseCanvas.releasePointerCapture === 'function' && event.pointerId !== undefined) {
      try { releaseCanvas.releasePointerCapture(event.pointerId); } catch(e) {}
    }
    setMapHoverPoint(releaseCanvas, event.clientX, event.clientY);
    getMapUiElements('.map-canvas.interactive-map').forEach(canvasEl => canvasEl.classList.remove('dragging'));
    applyMapWorldTransform({ canvasEl: releaseCanvas, updateReadout: true, updateMiniMap: true, measureEdges: true });
    mapDragState.lastMiniMapSyncAt = 0;
    scheduleHoverSync(mapState.hoverCanvas || releaseCanvas);
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleMapCanvasClick(event) {
    if (Date.now() - mapDragState.lastDragAt < 160) return;
    if (Date.now() < toNumber(mapState.忽略画布点击至, 0)) return;
    if (event.target.closest('.map-node')) return;
    const canvasEl = event.currentTarget;
    setMapHoverPoint(canvasEl, event.clientX, event.clientY);
    const point = resolveMapClientPoint(canvasEl, event.clientX, event.clientY);
    const coord = mapState.hoverCanvas === canvasEl && mapState.hoverCoord
      ? mapState.hoverCoord
      : point
        ? convertMapLocalPointToCoord(point.localX, point.localY, canvasEl)
        : null;
    if (!coord) return;
    const freePoint = { x: roundCoord(coord.x), y: roundCoord(coord.y) };
    mapState.selectedNode = '';
    mapState.selectedFreePoint = freePoint;
    mapState.infoPanelMode = 'selection';
    if (!hasPendingTravelRequestForTarget()) mapState.pendingTravelRequest = null;
    mapState.待移动后动作 = null;
    syncInteractiveMapUI({ center: false, updateInfo: true });
  }

  function 关闭地图维护右键菜单() {
    const 菜单 = document.querySelector('[data-map-maintenance-menu]');
    if (菜单) 菜单.remove();
    if (关闭地图维护右键菜单._关闭点击) {
      document.removeEventListener('pointerdown', 关闭地图维护右键菜单._关闭点击, true);
      关闭地图维护右键菜单._关闭点击 = null;
    }
    if (关闭地图维护右键菜单._关闭按键) {
      document.removeEventListener('keydown', 关闭地图维护右键菜单._关闭按键, true);
      关闭地图维护右键菜单._关闭按键 = null;
    }
  }

  function 打开地图维护右键菜单(事件, 选项 = {}) {
    关闭地图维护右键菜单();
    const 有节点 = !!选项.节点名;
    const 是动态地点 = 判断地图维护动态地点(选项.节点名);
    const 动作列表 = 有节点
      ? [
          ['add', '新增地点'],
          ['damage', '破坏'],
          ['repair', '修复'],
          ...(是动态地点 ? [['delete', '删除']] : [])
        ]
      : [
          ['add', '新增地点']
        ];
    const 菜单 = document.createElement('div');
    菜单.className = 'map-maintenance-menu';
    菜单.setAttribute('data-map-maintenance-menu', '1');
    菜单.innerHTML = 动作列表.map(([动作, 文本]) => `<button type="button" data-map-maintenance="${htmlEscape(动作)}">${htmlEscape(文本)}</button>`).join('');
    菜单.querySelectorAll('[data-map-maintenance]').forEach(按钮 => {
      按钮.dataset.mapBound = '1';
      注册地图元素事件(按钮, 'mapBound', 'click', 点击事件 => {
        点击事件.preventDefault();
        点击事件.stopPropagation();
        const 操作 = 按钮.dataset.mapMaintenance || '';
        关闭地图维护右键菜单();
        执行地图维护操作(操作);
      });
    });
    document.body.appendChild(菜单);
    const 宽度 = 菜单.offsetWidth || 126;
    const 高度 = 菜单.offsetHeight || 110;
    const 左侧 = clamp(事件.clientX, 8, Math.max(8, window.innerWidth - 宽度 - 8));
    const 顶部 = clamp(事件.clientY, 8, Math.max(8, window.innerHeight - 高度 - 8));
    菜单.style.left = `${左侧}px`;
    菜单.style.top = `${顶部}px`;
    关闭地图维护右键菜单._关闭点击 = 点击事件 => {
      if (点击事件.target instanceof Element && 点击事件.target.closest('[data-map-maintenance-menu]')) return;
      关闭地图维护右键菜单();
    };
    关闭地图维护右键菜单._关闭按键 = 按键事件 => {
      if (按键事件.key === 'Escape') 关闭地图维护右键菜单();
    };
    注册地图事件(document, 'pointerdown', 关闭地图维护右键菜单._关闭点击, true);
    注册地图事件(document, 'keydown', 关闭地图维护右键菜单._关闭按键, true);
  }

  function handleMapCanvasContextMenu(事件) {
    if (事件.target.closest('.map-node')) return;
    事件.preventDefault();
    事件.stopPropagation();
    const canvasEl = 事件.currentTarget;
    setMapHoverPoint(canvasEl, 事件.clientX, 事件.clientY);
    const point = resolveMapClientPoint(canvasEl, 事件.clientX, 事件.clientY);
    const coord = point ? convertMapLocalPointToCoord(point.localX, point.localY, canvasEl) : null;
    if (!coord) return;
    mapState.selectedNode = '';
    mapState.selectedFreePoint = { x: roundCoord(coord.x), y: roundCoord(coord.y) };
    mapState.infoPanelMode = 'selection';
    if (!hasPendingTravelRequestForTarget()) mapState.pendingTravelRequest = null;
    mapState.待移动后动作 = null;
    syncInteractiveMapUI({ center: false, updateInfo: true });
    打开地图维护右键菜单(事件, { 坐标: mapState.selectedFreePoint });
  }

  function scheduleHoverSync(canvasEl = null) {
    if (mapDragState.active || miniMapDragState.active) return;
    hoverSyncCanvas = canvasEl || null;
    if (hoverSyncRaf) cancelAnimationFrame(hoverSyncRaf);
    hoverSyncRaf = requestAnimationFrame(() => {
      hoverSyncRaf = 0;
      if (!mapDragState.active && !miniMapDragState.active) {
        updateMapCoordinateReadout(hoverSyncCanvas);
      }
    });
    if (hoverSyncTimeout) {
      clearTimeout(hoverSyncTimeout);
    }
    hoverSyncTimeout = setTimeout(() => {
        hoverSyncTimeout = null;
        if (!mapDragState.active && !miniMapDragState.active) {
          renderMapInfoState();
        }
    }, MAP_HOVER_INFO_DEBOUNCE_MS);
  }

  function handleMapCanvasHover(event) {
    if (mapDragState.active) {
      handleMapPointerMove(event);
      return;
    }
    if (miniMapDragState.active) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setMapHoverPoint(event.currentTarget, event.clientX, event.clientY);
    scheduleHoverSync(event.currentTarget);
  }

  function handleMapCanvasLeave() {
    if (mapDragState.active || miniMapDragState.active) return;
    setMapHoverPoint(null, null, null);
    scheduleHoverSync(null);
  }

  let _globalLastClickNodeName = null;
  let _globalLastClickTime = 0;
  function handleNodeLayerClick(event) {
    const node = event.target.closest('.map-node[data-node]');
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    const nextNode = node.dataset.node;
    mapState.selectedFreePoint = null;
    if (!hasPendingTravelRequestForTarget()) mapState.pendingTravelRequest = null;
    if (mapState.待移动后动作 && mapState.待移动后动作.target !== nextNode) mapState.待移动后动作 = null;
    mapState.selectedNode = nextNode;
    mapState.infoPanelMode = 'selection';
    mapState.travelMethodOverride = null;

    // 全局防抖的手工双击逻辑：解决 DOM 重绘吃掉原生 dblclick 的问题！
    const now = Date.now();
    if (_globalLastClickNodeName === nextNode && now - _globalLastClickTime < 350) {
      const canPreviewEnter = canEnterPreviewNode(nextNode, mapState.snapshot);
      if (canPreviewEnter) {
        if (enterPreviewMode(nextNode)) syncInteractiveMapUI({ center: true, updateInfo: true });
        _globalLastClickTime = 0;
        return;
      }
    }
    _globalLastClickNodeName = nextNode;
    _globalLastClickTime = now;

    syncInteractiveMapUI({ center: false, updateInfo: true });
  }

  function cycleTravelMethod() {
    if (!mapState.selectedFreePoint && 判断地图节点为当前位置(mapState.selectedNode)) {
      mapState.travelMethodOverride = null;
      mapState.pendingTravelRequest = null;
      syncInteractiveMapUI({ center: false, updateInfo: true });
      return;
    }
    const distance = getMapTravelPreview()?.distance || 0;
    const snapshot = mapState.snapshot || buildFallbackSnapshot();
    const methods = getAvailableTravelMethods(distance, mapState.currentMapId, snapshot);
    let current = mapState.travelMethodOverride;
    current = resolveTravelMethodVariant(current, snapshot);
    if (!current) {
      const preview = getMapTravelPreview();
      if (preview) current = preview.method;
    }
    if (!current) current = methods[0];
    let idx = methods.indexOf(current);
    if (idx === -1) idx = 0;
    idx = (idx + 1) % methods.length;
    mapState.travelMethodOverride = methods[idx];
    
    // 老板发话：不能卡！！坚决不能用全局庞大的 syncInteractiveMapUI！
    // 仅仅更新移动面板相关的局部文字！实现零延迟丝滑切换！
    const travelPreview = getMapTravelPreview();
    const 待执行移动 = mapState.pendingTravelRequest;
    const 预览移动请求 = travelPreview ? buildMapTravelRequest() : null;
    
    const actionMoveBaseText = 待执行移动 ? `${待执行移动.est_duration}` : 预览移动请求 ? `${预览移动请求.est_duration}` : (travelPreview ? travelPreview.duration : '无');
    const actionMoveText = 待执行移动
      ? `${actionMoveBaseText}${待执行移动.route_plan ? ` · ${待执行移动.route_plan}` : ''}`
      : 预览移动请求
        ? `${actionMoveBaseText}${预览移动请求.route_plan ? ` · ${预览移动请求.route_plan}` : ''}`
        : (travelPreview
          ? `${actionMoveBaseText}${travelPreview.routePlanText ? ` · ${travelPreview.routePlanText}` : ''}`
          : actionMoveBaseText);
          
    const actionCostText = 待执行移动
      ? (待执行移动.costs?.text || '无')
      : 预览移动请求
        ? (预览移动请求.costs?.canAfford
          ? (预览移动请求.costs?.text || '无')
          : ['不可用', 预览移动请求.costs?.reason || '', 预览移动请求.costs?.text && 预览移动请求.costs.text !== '无消耗' ? 预览移动请求.costs.text : ''].filter(Boolean).join(' · '))
        : (travelPreview && travelPreview.costs && travelPreview.costs.text !== '无消耗' ? travelPreview.costs.text : '无消耗');

    const travelMethodText = 待执行移动 ? 待执行移动.method : 预览移动请求 ? 预览移动请求.method : (travelPreview ? travelPreview.method : '无');
    const travelMethodDisplay = travelMethodText === '无' ? '无' : travelMethodText;
    
    setMapText('[data-map-request-method]', travelMethodDisplay);
    setMapText('[data-map-request-coord]', actionMoveText);
    setMapText('[data-map-request-cost]', actionCostText);
    
    getMapUiElements('[data-map-travel-action]').forEach(card => {
      card.classList.toggle('disabled', !travelPreview || (hasActivePreview() && !isPreviewCurrentBranch()));
    });
  }

  function 关闭移动动作确认层(保留动作 = false) {
    document.querySelectorAll('[data-map-move-action-confirm]').forEach(节点 => 节点.remove());
    if (!保留动作) mapState.待移动后动作 = null;
  }

  function 构建移动动作确认数据(actionType = '', item = null) {
    const 动作 = toText(actionType, '');
    const 节点 = item || getItemByName(mapState.selectedNode);
    if (!动作 || !节点) return null;
    const 预览 = getMapTravelPreview();
    if (!预览) return null;
    const 请求 = buildMapTravelRequest();
    if (!请求) return null;
    const 快照 = mapState.snapshot || buildFallbackSnapshot();
    const 方法列表 = getAvailableTravelMethods(预览.distance || 0, mapState.currentMapId, 快照);
    return {
      动作,
      动作标签: getNodeInteractionLabel(动作),
      节点,
      节点名: toText(节点.name, mapState.selectedNode),
      请求,
      方法列表: 方法列表.length ? 方法列表 : [请求.method || 预览.method || '步行'],
    };
  }

  function 打开移动动作确认层(actionType = '', item = null) {
    const 确认数据 = 构建移动动作确认数据(actionType, item);
    if (!确认数据) {
      mapState.待移动后动作 = null;
      if (window.MVU_Toast && typeof window.MVU_Toast.show === 'function') window.MVU_Toast.show('当前无法规划前往该节点。', 'warning');
      return false;
    }
    mapState.pendingTravelRequest = null;
    设置移动后待执行动作(确认数据.动作, 确认数据.节点);
    关闭移动动作确认层(true);

    const 请求 = 确认数据.请求;
    const 可执行 = !(请求.costs && 请求.costs.canAfford === false);
    const 消耗文本 = 请求.costs
      ? (请求.costs.canAfford === false
        ? ['不可用', 请求.costs.reason || '', 请求.costs.text && 请求.costs.text !== '无消耗' ? 请求.costs.text : ''].filter(Boolean).join(' · ')
        : (请求.costs.text || '无'))
      : '无';
    const 方式选项 = 确认数据.方法列表.map(方式 => {
      const 安全方式 = escapeMapHtml(方式);
      return `<option value="${安全方式}"${方式 === 请求.method ? ' selected' : ''}>${安全方式}</option>`;
    }).join('');
    const 弹层 = document.createElement('div');
    弹层.className = 'map-move-action-layer';
    弹层.setAttribute('data-map-move-action-confirm', '1');
    弹层.innerHTML = `
      <div class="map-move-action-dialog" role="dialog" aria-modal="true">
        <div class="map-move-action-head">
          <b>前往后执行</b>
          <span>${escapeMapHtml(确认数据.动作标签)} · ${escapeMapHtml(确认数据.节点名)}</span>
        </div>
        <div class="map-move-action-grid">
          <label class="map-move-action-row map-move-action-method">
            <b>方式</b>
            <select data-map-move-action-method>${方式选项}</select>
          </label>
          <div class="map-move-action-row">
            <b>耗时</b>
            <span>${escapeMapHtml(请求.est_duration || '无')}</span>
          </div>
          <div class="map-move-action-row">
            <b>消耗</b>
            <span>${escapeMapHtml(消耗文本 || '无')}</span>
          </div>
        </div>
        <div class="map-move-action-actions">
          <button type="button" data-map-move-action-cancel>取消</button>
          <button type="button" data-map-move-action-submit${可执行 ? '' : ' disabled'}>${可执行 ? '动身' : '不可用'}</button>
        </div>
      </div>
    `;
    弹层.addEventListener('click', 事件 => {
      if (事件.target === 弹层) 关闭移动动作确认层();
    });
    const 方式选择 = 弹层.querySelector('[data-map-move-action-method]');
    if (方式选择) {
      方式选择.addEventListener('change', 事件 => {
        mapState.travelMethodOverride = toText(事件.target && 事件.target.value, '');
        打开移动动作确认层(确认数据.动作, 确认数据.节点);
      });
    }
    const 取消按钮 = 弹层.querySelector('[data-map-move-action-cancel]');
    if (取消按钮) 取消按钮.addEventListener('click', () => 关闭移动动作确认层());
    const 确认按钮 = 弹层.querySelector('[data-map-move-action-submit]');
    if (确认按钮) {
      确认按钮.addEventListener('click', () => {
        const 最新确认数据 = 构建移动动作确认数据(确认数据.动作, 确认数据.节点);
        if (!最新确认数据 || (最新确认数据.请求.costs && 最新确认数据.请求.costs.canAfford === false)) {
          if (window.MVU_Toast && typeof window.MVU_Toast.show === 'function') window.MVU_Toast.show('当前移动方式不可用。', 'warning');
          return;
        }
        mapState.pendingTravelRequest = null;
        设置移动后待执行动作(最新确认数据.动作, 最新确认数据.节点);
        关闭移动动作确认层(true);
        Promise.resolve(commitMapTravel({ followUpAction: 最新确认数据.动作, 自动执行后续动作: true }))
          .catch(错误 => {
            if (window.MVU_Toast && typeof window.MVU_Toast.show === 'function') window.MVU_Toast.show(错误 && 错误.message ? 错误.message : '移动失败。', 'error');
          });
      });
    }
    document.body.appendChild(弹层);
    return true;
  }

  function handleNodeLayerDoubleClick(event) {
    const node = event.target.closest('.map-node[data-node]');
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    const nextNode = node.dataset.node;
    mapState.selectedNode = nextNode;
    const canPreviewEnter = canEnterPreviewNode(nextNode, mapState.snapshot);
    if (canPreviewEnter) {
      if (enterPreviewMode(nextNode)) syncInteractiveMapUI({ center: true, updateInfo: true });
    }
  }

  function handleNodeLayerContextMenu(事件) {
    const node = 事件.target.closest('.map-node[data-node]');
    if (!node) return;
    事件.preventDefault();
    事件.stopPropagation();
    const nextNode = node.dataset.node;
    mapState.selectedFreePoint = null;
    if (!hasPendingTravelRequestForTarget()) mapState.pendingTravelRequest = null;
    if (mapState.待移动后动作 && mapState.待移动后动作.target !== nextNode) mapState.待移动后动作 = null;
    mapState.selectedNode = nextNode;
    mapState.infoPanelMode = 'selection';
    mapState.travelMethodOverride = null;
    syncInteractiveMapUI({ center: false, updateInfo: true });
    打开地图维护右键菜单(事件, { 节点名: nextNode });
  }

  function ensureMapInteractionBindings() {
    if (!pointerBound) {
      pointerBound = true;
      注册地图事件(window, 'pointermove', 拦截地图拖动全局指针事件, true);
      注册地图事件(window, 'pointerup', 拦截地图拖动全局指针事件, true);
      注册地图事件(window, 'pointercancel', 拦截地图拖动全局指针事件, true);
      注册地图事件(window, 'mousemove', 拦截地图拖动全局指针事件, true);
      注册地图事件(window, 'mouseup', 拦截地图拖动全局指针事件, true);
      注册地图事件(document, 'pointermove', 拦截地图拖动全局指针事件, true);
      注册地图事件(document, 'pointerup', 拦截地图拖动全局指针事件, true);
      注册地图事件(document, 'pointercancel', 拦截地图拖动全局指针事件, true);
      注册地图事件(document, 'mousemove', 拦截地图拖动全局指针事件, true);
      注册地图事件(document, 'mouseup', 拦截地图拖动全局指针事件, true);
      注册地图事件(window, 'pointermove', handleMapPointerMove);
      注册地图事件(window, 'pointermove', handleMiniMapPointerMove);
      注册地图事件(window, 'pointerup', handleMapPointerUp);
      注册地图事件(window, 'pointerup', handleMiniMapPointerUp);
      注册地图事件(window, 'pointercancel', handleMapPointerUp);
      注册地图事件(window, 'pointercancel', handleMiniMapPointerUp);
    }

    if (!mapState.全局动作委托已绑定) {
      mapState.全局动作委托已绑定 = true;
      注册地图事件(document, 'click', event => {
        const 目标 = event.target instanceof Element ? event.target : null;
        if (!目标) return;
        const 动作按钮 = 目标.closest('[data-map-node-action]');
        if (动作按钮 && !动作按钮.dataset.mapBound) {
          event.preventDefault();
          event.stopPropagation();
          if (动作按钮.disabled) return;
          const 动作 = toText(动作按钮.dataset.mapNodeAction, '');
          if (!动作) return;
          mapState.selectedAction = 动作;
          syncInteractiveMapUI({ center: false, infoOnly: true });
          return;
        }
        const 维护按钮 = 目标.closest('[data-map-maintenance]');
        if (维护按钮 && !维护按钮.dataset.mapBound) {
          event.preventDefault();
          event.stopPropagation();
          执行地图维护操作(维护按钮.dataset.mapMaintenance || '');
        }
      });
    }

    getMapUiElements('.map-mini-world').forEach(miniWorldEl => {
      if (miniWorldEl.dataset.mapMiniBound === '1') return;
      miniWorldEl.dataset.mapMiniBound = '1';
      注册地图元素事件(miniWorldEl, 'mapMiniBound', 'pointerdown', handleMiniMapPointerDown);
    });

    getMapUiElements('.map-canvas.interactive-map').forEach(canvasEl => {
      if (canvasEl.dataset.mapBound === '1') return;
      canvasEl.dataset.mapBound = '1';
      注册地图元素事件(canvasEl, 'mapBound', 'wheel', handleMapWheel, { passive: false });
      注册地图元素事件(canvasEl, 'mapBound', 'pointerdown', handleMapPointerDown);
      注册地图元素事件(canvasEl, 'mapBound', 'pointermove', handleMapCanvasHover);
      注册地图元素事件(canvasEl, 'mapBound', 'pointerleave', handleMapCanvasLeave);
      注册地图元素事件(canvasEl, 'mapBound', 'click', handleMapCanvasClick);
      注册地图元素事件(canvasEl, 'mapBound', 'contextmenu', handleMapCanvasContextMenu);
    });

    getMapUiElements('[data-map-node-layer]').forEach(layerEl => {
      if (layerEl.dataset.mapBound === '1') return;
      layerEl.dataset.mapBound = '1';
      注册地图元素事件(layerEl, 'mapBound', 'click', handleNodeLayerClick);
      注册地图元素事件(layerEl, 'mapBound', 'dblclick', handleNodeLayerDoubleClick);
      注册地图元素事件(layerEl, 'mapBound', 'contextmenu', handleNodeLayerContextMenu);
    });

    getMapUiElements('[data-map-control]').forEach(btn => {
      if (btn.dataset.mapBound === '1') return;
      btn.dataset.mapBound = '1';
      注册地图元素事件(btn, 'mapBound', 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        const control = btn.dataset.mapControl;
        if (control === 'zoom-in') {
          mapState.zoom = clamp(Number((mapState.zoom + 0.22).toFixed(2)), MIN_MAP_ZOOM, MAX_MAP_ZOOM);
          syncInteractiveMapUI({ center: false, updateInfo: false });
          return;
        }
        if (control === 'zoom-out') {
          mapState.zoom = clamp(Number((mapState.zoom - 0.22).toFixed(2)), MIN_MAP_ZOOM, MAX_MAP_ZOOM);
          syncInteractiveMapUI({ center: false, updateInfo: false });
          return;
        }
        if (control === 'focus') {
          focusCurrentLocation();
          return;
        }
        if (control === 'back') {
          if (exitPreviewMode()) syncInteractiveMapUI({ center: true, updateInfo: true });
          return;
        }
        mapState.selectedFreePoint = null;
        if (hasActivePreview() && mapState.baseSnapshot) {
          mapState.previewViewStack = [];
          mapState.previewTrail = [];
          syncPreviewKeyFromTrail();
          syncMapStateFromSnapshot(mapState.baseSnapshot, { preserveSelection: false, forceLayer: inferInitialLayer(mapState.baseSnapshot), initializeLayer: false });
        }
        mapState.zoom = DEFAULT_MAP_ZOOM;
        mapState.panX = 0;
        mapState.panY = 0;
        syncInteractiveMapUI({ center: false, updateInfo: true });
      });
    });

    getMapUiElements('[data-map-action-select]').forEach(选择框 => {
      if (选择框.dataset.mapBound === '1') return;
      选择框.dataset.mapBound = '1';
      注册地图元素事件(选择框, 'mapBound', 'change', event => {
        event.preventDefault();
        event.stopPropagation();
        mapState.selectedAction = toText(选择框.value, '');
        syncInteractiveMapUI({ center: false, infoOnly: true });
      });
    });

    getMapUiElements('[data-map-duration-text]').forEach(文本 => {
      if (文本.dataset.mapBound === '1') return;
      文本.dataset.mapBound = '1';
      const 提交时长文本 = () => {
        if (!是否地图可变时长动作(mapState.selectedAction)) return;
        const 输入文本 = toText(文本.textContent, '').replace(/小时|时|h/gi, '').trim();
        const 小时数 = clamp(toNumber(输入文本, 获取地图日常动作tick() / 6), 0.1, 24);
        mapState.routineTicks = Math.max(1, Math.min(144, Math.round(小时数 * 6)));
        syncInteractiveMapUI({ center: false, infoOnly: true });
      };
      注册地图元素事件(文本, 'mapBound', 'focus', () => {
        if (!是否地图可变时长动作(mapState.selectedAction)) return;
        文本.textContent = formatRoutineDeltaValue(获取地图日常动作tick() / 6);
        const 范围 = document.createRange();
        范围.selectNodeContents(文本);
        const 选择 = window.getSelection();
        if (选择) {
          选择.removeAllRanges();
          选择.addRange(范围);
        }
      });
      注册地图元素事件(文本, 'mapBound', 'blur', 提交时长文本);
      注册地图元素事件(文本, 'mapBound', 'keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          文本.blur();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          syncInteractiveMapUI({ center: false, infoOnly: true });
        }
      });
      注册地图元素事件(文本, 'mapBound', 'paste', event => {
        event.preventDefault();
        event.stopPropagation();
        const 粘贴文本 = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
        document.execCommand('insertText', false, 粘贴文本);
      });
    });

    getMapUiElements('[data-map-training-select]').forEach(选择框 => {
      if (选择框.dataset.mapBound === '1') return;
      选择框.dataset.mapBound = '1';
      注册地图元素事件(选择框, 'mapBound', 'change', event => {
        event.preventDefault();
        event.stopPropagation();
        const 项目 = toText(选择框.value, '力量');
        mapState.训练项目 = ['力量', '防御', '敏捷', '体魄', '精神'].includes(项目) ? 项目 : '力量';
        syncInteractiveMapUI({ center: false, infoOnly: true });
      });
    });

    getMapUiElements('[data-map-action-execute]').forEach(按钮 => {
      if (按钮.dataset.mapBound === '1') return;
      按钮.dataset.mapBound = '1';
      注册地图元素事件(按钮, 'mapBound', 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (按钮.classList.contains('disabled') || 按钮.disabled) return;
        performMapAction(toText(mapState.selectedAction, '') || toText(按钮.dataset.mapActionBtn, '') || 'travel');
      });
    });

    getMapUiElements('[data-map-node-action]').forEach(按钮 => {
      if (按钮.dataset.mapBound === '1') return;
      按钮.dataset.mapBound = '1';
      注册地图元素事件(按钮, 'mapBound', 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (按钮.disabled) return;
        const 动作 = toText(按钮.dataset.mapNodeAction, '');
        if (!动作) return;
        mapState.selectedAction = 动作;
        syncInteractiveMapUI({ center: false, infoOnly: true });
      });
    });

    getMapUiElements('[data-map-maintenance]').forEach(按钮 => {
      if (按钮.dataset.mapBound === '1') return;
      按钮.dataset.mapBound = '1';
      注册地图元素事件(按钮, 'mapBound', 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        执行地图维护操作(按钮.dataset.mapMaintenance || '');
      });
    });

    getMapUiElements('[data-map-npc-select]').forEach(btn => {
      if (btn.dataset.mapBound === '1') return;
      btn.dataset.mapBound = '1';
      注册地图元素事件(btn, 'mapBound', 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        const npcName = toText(btn.dataset.mapNpcSelect, '');
        if (!npcName) return;
        mapState.selectedNpc = npcName;
        const nextAction = toText(btn.dataset.mapNpcAction, '');
        if (nextAction) mapState.selectedAction = nextAction;
        syncInteractiveMapUI({ center: false, infoOnly: true });
      });
    });

    getMapUiElements('[data-map-travel-cycle]').forEach(row => {
      if (row.dataset.mapBound === '1') return;
      row.dataset.mapBound = '1';
      注册地图元素事件(row, 'mapBound', 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (row.classList.contains('disabled') || row.classList.contains('is-hidden')) return;
        cycleTravelMethod();
      });
    });

    getMapUiElements('[data-map-layer-pill]').forEach(pill => {
      if (pill.dataset.mapBound === '1') return;
      pill.dataset.mapBound = '1';
      注册地图元素事件(pill, 'mapBound', 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        const nextLayer = pill.dataset.mapLayerPill;
        mapState.layer = nextLayer;
        mapState.zoom = mapState.layerFollowsZoom ? (mapZoomTargets[nextLayer] || DEFAULT_MAP_ZOOM) : DEFAULT_MAP_ZOOM;
        mapState.selectedFreePoint = null;
        mapState.selectedNode = resolveSelectedNodeForLayer(nextLayer) || mapState.selectedNode;
        syncInteractiveMapUI({ center: true });
      });
    });

    getMapUiElements('[data-map-panel-mode]').forEach(btn => {
      if (btn.dataset.mapBound === '1') return;
      btn.dataset.mapBound = '1';
      注册地图元素事件(btn, 'mapBound', 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        mapState.infoPanelMode = toText(btn.dataset.mapPanelMode, 'follow') === 'selection' ? 'selection' : 'follow';
        syncInteractiveMapUI({ center: false, updateInfo: true });
      });
    });
  }

  function syncInteractiveMapUI(options = {}, fullDataSync = false) {
    const { center = false, updateInfo = fullDataSync, visualOnly = false, infoOnly = false } = options;
    const snapshot = mapState.snapshot || buildFallbackSnapshot();
    window.__sheepMapSnapshot = snapshot;
    const terrainToken = `${mapState.currentMapId}|${toText(deepGet(snapshot, 'mapMeta.name', ''), '')}|${Array.isArray(snapshot.items) ? snapshot.items.length : 0}`;
    syncMapLayoutShell();
    if (!visualOnly) {
      normalizeMapSelection();
      if (syncInteractiveMapUI.__terrainToken !== terrainToken) {
        renderMapTerrain();
        syncInteractiveMapUI.__terrainToken = terrainToken;
      }
      ensureMapInteractionBindings();
    }
    if (center) {
      if (mapState.selectedFreePoint) centerMapOnCoord(mapState.selectedFreePoint, getPrimaryMapCanvas());
      else if (mapState.selectedNode) centerMapOnNode(mapState.selectedNode);
      else centerMapOnCoord(getCurrentCoord(), getPrimaryMapCanvas());
    }
    if (!infoOnly) {
      renderMapVisualState();
      applyMapWorldTransform();
    }
    if (updateInfo || infoOnly) {
      renderMapInfoState(); // 单独刷新侧边栏
    }
  }

  function scheduleSync(center = false, updateInfo = false) {
    scheduleSync.__center = !!(scheduleSync.__center || center);
    scheduleSync.__updateInfo = !!(scheduleSync.__updateInfo || updateInfo);
    if (scheduleSync.__raf) return;
    scheduleSync.__raf = requestAnimationFrame(() => {
      const nextCenter = !!scheduleSync.__center;
      const nextUpdateInfo = !!scheduleSync.__updateInfo;
      scheduleSync.__raf = 0;
      scheduleSync.__center = false;
      scheduleSync.__updateInfo = false;
      try {
        syncInteractiveMapUI({ center: nextCenter, updateInfo: nextUpdateInfo });
      } catch (error) {
        console.error('sheep map restore failed', error);
      }
    });
  }

  async function refreshLiveMap(preserveSelection = true, sharedVars = undefined) {
    try {
      const firstLoad = !mapState.hasLoaded;
      const vars = sharedVars === undefined ? await getAllVariablesSafe() : sharedVars;
      const root = resolveRootData(vars);
      const effective = root ? buildEffectiveSd(root) : { rootData: null };
      const baseSnapshot = effective && effective.rootData ? buildMapSnapshot(effective.rootData) : buildFallbackSnapshot();
      const previousMapId = mapState.currentMapId;
      const previousCurrent = mapState.currentNode;
      const previousPreviewTrail = Array.isArray(mapState.previewTrail) ? mapState.previewTrail.join('>') : '';
      mapState.baseSnapshot = baseSnapshot;
      let snapshot = baseSnapshot;
      if (Array.isArray(mapState.previewTrail) && mapState.previewTrail.length) {
        const previewPayload = getPreviewPayloadByTrail(baseSnapshot, mapState.previewTrail);
        if (previewPayload) {
          snapshot = buildSnapshotFromMapPayload(previewPayload, baseSnapshot.rootData, baseSnapshot.activeName, baseSnapshot.activeChar, {
            charactersByLoc: baseSnapshot.charactersByLoc,
            characterDigest: baseSnapshot.characterDigest
          });
        } else {
          mapState.previewTrail = [];
          mapState.previewViewStack = [];
          syncPreviewKeyFromTrail();
        }
      }
      const currentPreviewTrail = Array.isArray(mapState.previewTrail) ? mapState.previewTrail.join('>') : '';
      const refreshSignature = buildMapRefreshSignature(snapshot, currentPreviewTrail);
      const shellMissing = !document.querySelector('#page-map .map-layout')
        || !document.querySelector(".split-left-page[data-target='page-map'] .map-hero-card")
        || !document.querySelector(".split-right-page[data-target='page-map'] .map-side-stack");
      window.__sheepMapSnapshot = snapshot;
      if (preserveSelection && !firstLoad && !shellMissing && mapState.lastRefreshSignature === refreshSignature) {
        mapState.snapshot = snapshot;
        mapState.hasLoaded = true;
        setMapSyncState('无变化', snapshot.currentMapId);
        scheduleSync(false, true);
        return;
      }
      mapState.lastRefreshSignature = refreshSignature;
      syncMapStateFromSnapshot(snapshot, { preserveSelection });
      const shouldCenter = firstLoad
        || previousMapId !== snapshot.currentMapId
        || previousCurrent !== mapState.currentNode
        || previousPreviewTrail !== currentPreviewTrail;
      mapState.hasLoaded = true;
      window.__sheepMapSnapshot = snapshot;
      if (firstLoad || shellMissing) {
        resyncMapShell({ center: shouldCenter, syncVisual: false });
      }
      setMapSyncState('已同步', snapshot.currentMapId);
      scheduleSync(shouldCenter, true);
    } catch (error) {
      console.error('sheep map live refresh failed', error);
      setMapSyncState('同步失败', error && error.message ? error.message : '地图刷新异常');
      if (!mapState.hasLoaded) {
        const fallbackSnapshot = buildFallbackSnapshot();
        mapState.baseSnapshot = fallbackSnapshot;
        mapState.previewViewStack = [];
        mapState.previewTrail = [];
        syncPreviewKeyFromTrail();
        syncMapStateFromSnapshot(fallbackSnapshot, { preserveSelection: false, forceLayer: inferInitialLayer(fallbackSnapshot), initializeLayer: false });
        mapState.hasLoaded = true;
        setMapSyncState('异常回退', 'fallback');
        resyncMapShell({ center: true, syncVisual: false });
        scheduleSync(true, true);
      } else {
        scheduleSync(false, true);
      }
    }
  }

  function init() {
    injectStyle();
    if (!ensurePageMapMarkup()) return;
    refreshSplitMapPages();
    bindTabResync();
    mapState.snapshot = buildFallbackSnapshot();
    mapState.bounds = mapState.snapshot.bounds;
    mapState.items = mapState.snapshot.items;
    mapState.itemMap = new Map(mapState.snapshot.items.map(item => [item.name, item]));
    mapState.lastTravelNote = '已载入默认节点集';
    setMapSyncState('初始化', 'init');
    mapState.currentNode = mapState.snapshot.currentLoc;
    mapState.selectedNode = mapState.snapshot.currentLoc;
    resyncMapShell({ center: true });
    setTimeout(() => scheduleSync(false), 80);
    setTimeout(() => scheduleSync(false), 240);
    setTimeout(() => scheduleSync(false), 640);
    try {
      window.__sheepMapBridge = {
        buildUnifiedNodePanels: 构建星图外壳节点面板,
        describeTravelToNode,
        travelToNode,
        deriveDynamicLocationCoord: 推导动态地点坐标,
        focusCurrentLocation
      };
    } catch (_) {}
    注册地图事件(window, 'resize', () => scheduleSync(false));

    (async () => {
      await waitForMvuReady();
      await refreshLiveMap(false);
      bindMvuUpdates(vars => {
        refreshLiveMap(true, vars);
      });
    })();
  }

  init();
})();
