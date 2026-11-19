/* ============================================================
   AETHER OS · 地点与路线数据层
   Photon 地理编码 · OSM 详情 · OSRM / FOSSGIS 路线 · IP 定位回退
   ============================================================ */
(() => {
  'use strict';
  const Aether = window.Aether;
  if (!Aether) return;

  const PHOTON = 'https://photon.komoot.io';
  const OVERPASS = [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.osm.ch/api/interpreter'
  ];
  const ROUTERS = {
    driving: 'https://router.project-osrm.org/route/v1/driving/',
    walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/',
    cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving/'
  };
  const MODE_NAMES = { driving: '驾车', walking: '步行', cycling: '骑行' };
  const detailCache = new Map();

  async function fetchJson(url, options = {}, timeout = 9000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, {
        ...options,
        signal: ctl.signal,
        headers: { Accept: 'application/json', ...(options.headers || {}) }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      if (err && err.name === 'AbortError') throw new Error('请求超时');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function haversine(a, b) {
    const R = 6371, rad = x => x * Math.PI / 180;
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function fmtDistance(m) {
    if (!Number.isFinite(m)) return '--';
    return m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' km' : Math.round(m) + ' m';
  }

  function fmtDuration(sec) {
    if (!Number.isFinite(sec)) return '--';
    const min = Math.round(sec / 60);
    if (min < 60) return Math.max(1, min) + ' 分钟';
    const h = Math.floor(min / 60), m = min % 60;
    return h + ' 小时' + (m ? ' ' + m + ' 分' : '');
  }

  const CATEGORY = {
    'amenity:restaurant': '餐厅', 'amenity:fast_food': '快餐', 'amenity:cafe': '咖啡馆', 'amenity:bar': '酒吧',
    'amenity:pub': '酒吧', 'amenity:food_court': '美食广场', 'amenity:hospital': '医院',
    'amenity:clinic': '诊所', 'amenity:doctors': '诊所', 'amenity:pharmacy': '药店', 'amenity:dentist': '牙科',
    'amenity:bank': '银行', 'amenity:atm': 'ATM', 'amenity:bureau_de_change': '货币兑换',
    'amenity:fuel': '加油站', 'amenity:charging_station': '充电站', 'amenity:parking': '停车场',
    'amenity:police': '警察局', 'amenity:fire_station': '消防站', 'amenity:post_office': '邮局',
    'amenity:post_box': '邮筒', 'amenity:school': '学校', 'amenity:university': '大学', 'amenity:college': '学院',
    'amenity:library': '图书馆', 'amenity:townhall': '市政厅', 'amenity:courthouse': '法院',
    'amenity:embassy': '大使馆', 'amenity:community_centre': '社区中心', 'amenity:marketplace': '市场',
    'amenity:bus_station': '汽车站', 'amenity:taxi': '出租车', 'amenity:car_rental': '租车',
    'amenity:travel_agency': '旅行社', 'amenity:toilets': '公共厕所', 'amenity:drinking_water': '饮水点',
    'amenity:place_of_worship': '宗教场所', 'amenity:gym': '健身房', 'amenity:cinema': '电影院',
    'amenity:theatre': '剧院', 'amenity:arts_centre': '艺术中心', 'amenity:nightclub': '夜店',
    'tourism:hotel': '酒店', 'tourism:hostel': '旅舍', 'tourism:guest_house': '民宿', 'tourism:motel': '汽车旅馆',
    'tourism:apartment': '公寓酒店', 'tourism:attraction': '景点', 'tourism:museum': '博物馆',
    'tourism:gallery': '美术馆', 'tourism:viewpoint': '观景点', 'tourism:zoo': '动物园',
    'tourism:theme_park': '主题公园', 'tourism:information': '游客中心', 'tourism:camp_site': '营地',
    'shop:supermarket': '超市', 'shop:convenience': '便利店', 'shop:mall': '商场', 'shop:department_store': '百货',
    'shop:bakery': '面包店', 'shop:butcher': '肉店', 'shop:greengrocer': '果蔬店', 'shop:clothes': '服装店',
    'shop:shoes': '鞋店', 'shop:electronics': '电子产品', 'shop:mobile_phone': '手机店', 'shop:computer': '电脑店',
    'shop:hardware': '五金店', 'shop:furniture': '家具店', 'shop:books': '书店', 'shop:stationery': '文具店',
    'shop:jewelry': '珠宝店', 'shop:optician': '眼镜店', 'shop:chemist': '药店', 'shop:car': '汽车店',
    'shop:bicycle': '自行车店', 'shop:sports': '体育用品', 'shop:toys': '玩具店', 'shop:pet': '宠物店',
    'shop:florist': '花店', 'shop:alcohol': '酒类商店', 'shop:gift': '礼品店', 'shop:travel_agency': '旅行社',
    'leisure:park': '公园', 'leisure:garden': '花园', 'leisure:playground': '游乐场', 'leisure:sports_centre': '体育中心',
    'leisure:stadium': '体育场', 'leisure:fitness_centre': '健身房', 'leisure:swimming_pool': '游泳池',
    'office:government': '政府机构', 'office:company': '公司', 'office:diplomatic': '外交机构',
    'office:lawyer': '律师事务所', 'office:insurance': '保险公司', 'office:estate_agent': '房产中介',
    'railway:station': '火车站', 'railway:halt': '车站', 'railway:subway_entrance': '地铁口',
    'highway:bus_stop': '公交站', 'aeroway:aerodrome': '机场', 'aeroway:terminal': '航站楼',
    'place:city': '城市', 'place:town': '城镇', 'place:village': '村庄', 'place:suburb': '城区',
    'place:neighbourhood': '街区', 'place:locality': '地名', 'waterway:river': '河流',
    'landuse:residential': '住宅区', 'landuse:commercial': '商业区', 'landuse:industrial': '工业区',
    'landuse:retail': '商业区', 'building:yes': '建筑', 'building:commercial': '商业楼',
    'building:residential': '住宅楼', 'man_made:tower': '塔', 'man_made:lighthouse': '灯塔',
    'natural:peak': '山峰', 'natural:bay': '海湾', 'natural:beach': '海滩', 'boundary:administrative': '行政区域'
  };
  const CATEGORY_BY_KEY = {
    amenity: '公共设施', tourism: '旅游', shop: '商店', leisure: '休闲', office: '机构',
    railway: '车站', highway: '道路', aeroway: '机场', place: '地名', natural: '自然', boundary: '边界'
  };

  function classify(key, value) {
    return CATEGORY[key + ':' + value] || CATEGORY_BY_KEY[key] || '地点';
  }

  function normalizeFeature(f, origin) {
    const p = f.properties || {};
    const [lon, lat] = f.geometry.coordinates;
    const labelParts = [];
    [p.name, p.street, p.district, p.city, p.state, p.country].forEach(v => {
      if (v && labelParts.indexOf(v) === -1 && v !== p.name) labelParts.push(v);
    });
    return {
      name: p.name || p.street || '未命名地点',
      label: labelParts.join(' · '),
      lat, lon,
      osmType: p.osm_type || '',
      osmId: p.osm_id || null,
      key: p.osm_key || '',
      value: p.osm_value || '',
      category: classify(p.osm_key, p.osm_value),
      street: p.street || '',
      housenumber: p.housenumber || '',
      city: p.city || p.district || '',
      district: p.district || '',
      state: p.state || '',
      country: p.country || '',
      countrycode: (p.countrycode || '').toUpperCase(),
      postcode: p.postcode || '',
      distance: origin ? haversine(origin, [lat, lon]) * 1000 : null
    };
  }

  async function search(query, options = {}) {
    const q = String(query || '').trim();
    if (!q) return [];
    const limit = Math.min(50, Math.max(4, options.limit || 12));
    const params = new URLSearchParams({ q, limit: String(limit) });
    const hasOrigin = Number.isFinite(options.lat) && Number.isFinite(options.lon);
    if (hasOrigin) {
      params.set('lat', Number(options.lat).toFixed(5));
      params.set('lon', Number(options.lon).toFixed(5));
    }
    const data = await fetchJson(PHOTON + '/api/?' + params.toString(), {}, 8000);
    const origin = hasOrigin ? [Number(options.lat), Number(options.lon)] : null;
    const list = (data.features || []).map(f => normalizeFeature(f, origin));
    const seen = new Set();
    const out = [];
    list.forEach(p => {
      const id = p.osmId ? p.osmType + p.osmId : p.lat.toFixed(4) + ',' + p.lon.toFixed(4);
      if (seen.has(id)) return;
      seen.add(id);
      out.push(p);
    });
    const ql = q.toLowerCase();
    const ranked = out.map((p, idx) => {
      const name = p.name.toLowerCase();
      let score = 0;
      if (name === ql) score += 80;
      else if (name.startsWith(ql)) score += 50;
      else if (name.indexOf(ql) !== -1) score += 25;
      if (p.key === 'tourism') score += 20;
      if (p.key === 'building' || p.key === 'man_made') score += 10;
      if (['景点', '观景点', '博物馆', '美术馆', '公园', '宗教场所', '塔', '灯塔', '建筑'].indexOf(p.category) !== -1) score += 35;
      if (['公交站', '停车场', '地名', '村庄', '街区', '道路', '住宅区', '住宅', '住宅楼'].indexOf(p.category) !== -1) score -= 30;
      if (origin) score -= Math.log1p(haversine(origin, [p.lat, p.lon])) * 6;
      score -= idx * 0.4;
      return { p, score };
    });
    ranked.sort((a, b) => b.score - a.score);
    return ranked.map(x => x.p);
  }

  function osmKind(type) {
    return { N: 'node', W: 'way', R: 'relation' }[type] || '';
  }

  function overpassTags(kind, id) {
    const key = kind + '/' + id;
    if (detailCache.has(key)) return detailCache.get(key);
    const q = '[out:json][timeout:8];' + kind + '(' + id + ');out tags center;';
    const task = (async () => {
      const attempts = OVERPASS.map(endpoint =>
        fetchJson(endpoint + '?data=' + encodeURIComponent(q), {}, 8000).then(data => {
          const el = (data.elements || [])[0];
          if (!el) throw Object.assign(new Error('该地点暂无详情'), { empty: true });
          return el.tags || {};
        })
      );
      return await new Promise((resolve, reject) => {
        let left = attempts.length;
        const errors = [];
        attempts.forEach(p => p.then(resolve).catch(err => {
          errors.push(err);
          if (--left === 0) {
            const first = errors.find(e => !e.empty) || errors[0];
            reject(new Error(first && first.message ? first.message : '详情数据源不可达'));
          }
        }));
      });
    })();
    detailCache.set(key, task);
    task.catch(() => detailCache.delete(key));
    return task;
  }

  function splitValues(v) {
    return String(v || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
  }

  function addressOf(place, tags) {
    const parts = [];
    const street = tags['addr:street'] || place.street;
    const number = tags['addr:housenumber'] || place.housenumber;
    if (street) parts.push(street + (number ? ' ' + number : ''));
    const district = tags['addr:district'] || tags['addr:subdistrict'] || place.district;
    const city = tags['addr:city'] || place.city;
    const province = tags['addr:province'] || tags['addr:state'] || place.state;
    const postcode = tags['addr:postcode'] || place.postcode;
    if (district && district !== city) parts.push(district);
    if (city) parts.push(city);
    if (province && province !== city) parts.push(province);
    if (postcode) parts.push(postcode);
    if (!parts.length) parts.push(place.country);
    return parts.filter(Boolean).join(' · ');
  }

  async function details(place) {
    const base = {
      phones: [], website: '', hours: '', address: addressOf(place, {}),
      operator: '', brand: '', wikidata: '', wikipedia: '', source: 'photon', tags: {}
    };
    const kind = osmKind(place.osmType);
    if (!kind || !place.osmId) return base;
    try {
      const tags = await overpassTags(kind, place.osmId);
      const phones = [];
      ['phone', 'contact:phone', 'contact:mobile', 'mobile'].forEach(k => {
        splitValues(tags[k]).forEach(v => { if (phones.indexOf(v) === -1) phones.push(v); });
      });
      return {
        phones,
        website: tags.website || tags['contact:website'] || '',
        hours: tags.opening_hours || '',
        address: addressOf(place, tags),
        operator: tags.operator || '',
        brand: tags.brand || '',
        wikidata: tags.wikidata || '',
        wikipedia: tags.wikipedia || '',
        source: 'osm',
        tags
      };
    } catch (err) {
      base.error = err && err.message ? err.message : String(err);
      return base;
    }
  }

  async function ipLocate() {
    const data = await fetchJson('https://ipinfo.io/json', {}, 6000);
    const loc = String(data.loc || '').split(',').map(Number);
    if (loc.length !== 2 || !Number.isFinite(loc[0]) || !Number.isFinite(loc[1])) throw new Error('IP 定位无坐标');
    return { lat: loc[0], lon: loc[1], city: data.city || '', region: data.region || '', country: data.country || '', source: 'ip' };
  }

  const MANEUVER = {
    depart: '出发', arrive: '到达目的地', turn: '转向', 'new name': '继续', continue: '继续',
    merge: '汇入', fork: '分岔', 'on ramp': '上匝道', 'off ramp': '下匝道', 'end of road': '道路尽头',
    roundabout: '进入环岛', rotary: '进入环岛', 'roundabout turn': '环岛转向',
    'exit roundabout': '驶出环岛', 'exit rotary': '驶出环岛', notification: '提示'
  };
  const MODIFIER = {
    left: '左转', right: '右转', straight: '直行', 'slight left': '稍向左转',
    'slight right': '稍向右转', 'sharp left': '急左转', 'sharp right': '急右转', uturn: '掉头'
  };

  function stepText(step) {
    const m = step.maneuver || {};
    const type = m.type || '';
    const mod = m.modifier || '';
    const name = step.name ? '进入 ' + step.name : '';
    if (type === 'depart') return '出发' + (step.name ? '，沿 ' + step.name : '');
    if (type === 'arrive') return '到达目的地';
    if (type === 'roundabout' || type === 'rotary') {
      return '进入环岛' + (m.exit ? '，从第 ' + m.exit + ' 个出口驶出' : '') + (step.name ? '，进入 ' + step.name : '');
    }
    if (type === 'new name' || type === 'continue') {
      if (mod === 'straight') return '继续直行' + (step.name ? '，沿 ' + step.name : '');
      return (MODIFIER[mod] || '继续') + (step.name ? '，沿 ' + step.name : '');
    }
    if (type === 'merge') return '汇入' + (step.name ? ' ' + step.name : '');
    if (type === 'fork') return (mod ? MODIFIER[mod] || '' : '') + '走分岔' + (step.name ? '，进入 ' + step.name : '');
    if (type === 'on ramp') return '上匝道' + (step.name ? '，进入 ' + step.name : '');
    if (type === 'off ramp') return '下匝道' + (step.name ? '，进入 ' + step.name : '');
    if (type === 'end of road') return '道路尽头' + (mod ? MODIFIER[mod] || '' : '');
    if (mod && MODIFIER[mod]) return MODIFIER[mod] + (name ? '，' + name : '');
    return (MANEUVER[type] || '继续') + (name ? '，' + name : '');
  }

  async function route(from, to, mode = 'driving') {
    const base = ROUTERS[mode] || ROUTERS.driving;
    const url = base + `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true&alternatives=false`;
    const data = await fetchJson(url, {}, 15000);
    if (data.code !== 'Ok' || !data.routes || !data.routes[0]) throw new Error('未找到可行路线');
    const r = data.routes[0];
    const geometry = (r.geometry && r.geometry.coordinates ? r.geometry.coordinates : []).map(([lon, lat]) => [lat, lon]);
    const steps = [];
    (r.legs || []).forEach(leg => (leg.steps || []).forEach(s => {
      steps.push({
        text: stepText(s),
        distance: s.distance,
        duration: s.duration,
        name: s.name || '',
        type: s.maneuver && s.maneuver.type,
        modifier: s.maneuver && s.maneuver.modifier,
        location: s.maneuver && s.maneuver.location ? [s.maneuver.location[1], s.maneuver.location[0]] : null
      });
    }));
    return { distance: r.distance, duration: r.duration, geometry, steps, mode };
  }

  Aether.places = {
    search,
    details,
    route,
    ipLocate,
    haversine,
    fmtDistance,
    fmtDuration,
    classify,
    modeName: m => MODE_NAMES[m] || m
  };
})();
