import './style.css';

const canvas = document.querySelector('#moon');
const ctx = canvas.getContext('2d');
const keys = new Set();
const worldSize = 2400;
const camera = { x: 0, y: 0 };
const astronaut = { x: 1200, y: 1200, facingLeft: false, moving: false, suited: false };
const controlRoomDoor = { x: 1370, y: 1200 };
const requiredSamples = 3;
const sampleSites = [
  { id: 'sample-site-0', x: 650, y: 1760, collected: false },
  { id: 'sample-site-1', x: 2180, y: 1650, collected: false },
  { id: 'sample-site-2', x: 570, y: 650, collected: false },
  { id: 'sample-site-3', x: 2010, y: 560, collected: false },
  { id: 'sample-site-4', x: 1260, y: 2140, collected: false }
];
const baseBuildings = [
  { id: 'control', label: 'CONTROL', x: 1370, y: 1200, width: 250, height: 195, groundAnchor: .56, labelAnchor: .58, asset: '/assets/control-room.svg' },
  { id: 'solar', label: 'SOLAR', x: 1010, y: 1035, width: 250, height: 195, groundAnchor: .684, labelAnchor: .40, asset: '/assets/solar-array.svg' },
  { id: 'greenhouse', label: 'GARDEN', x: 1500, y: 890, width: 235, height: 183, groundAnchor: .656, labelAnchor: .51, asset: '/assets/greenhouse.svg' },
  { id: 'lab', label: 'LAB', x: 1690, y: 1230, width: 245, height: 191, groundAnchor: .636, labelAnchor: .59, asset: '/assets/research-lab.svg' },
  { id: 'shelter', label: 'SHELTER', x: 1470, y: 1540, width: 218, height: 162, groundAnchor: .68, labelAnchor: .56, asset: '/assets/storm-shelter.svg' }
];
for (const building of baseBuildings) {
  building.image = new Image();
  building.image.src = building.asset;
  if (building.id === 'shelter') {
    building.reinforcedImage = new Image();
    building.reinforcedImage.src = '/assets/storm-shelter-reinforced.svg';
  }
}
let scene = 'lunar';
let gameStarted = false;
let missionEnded = false;
let missionTime = Date.parse('2012-01-23T00:00:00Z');
let lastClockMinute = -1;
const gameHour = 60 * 60 * 1000;
const missionDeadlineAt = Date.parse('2012-01-28T12:00:00Z');
const sepEpisodeGap = 36 * gameHour;
const simulatedStormDuration = 12 * gameHour;
const storm = { dataState: 'loading', episodes: [], currentIndex: 0, event: null, phase: 'loading', alertAt: null, startAt: null, endAt: null, exposure: 0, shieldLevel: 0 };
const supplies = {
  basePower: 55, solarProgress: 0, suitEnergy: 60, suitLifeSupport: 70, stamina: 100,
  meals: 2, maxMeals: 4, greenhouseMeals: 0, maxGreenhouseMeals: 4, greenhouseProgress: 0,
  greenhouseOn: true, samplesScanned: 0, samplesAtLab: 0, carriedSample: false, researchPoints: 0,
  researchComplete: false, activity: null, feedback: null, noticeUntil: 0,
  warnedLifeSupport: false, warnedBattery: false
};
const solarPowerPerHour = 1.6;
const basePowerUsePerHour = .8;
const greenhousePowerPerHour = 1.5;
const greenhouseHoursPerMeal = 4;
let lastSuppliesUpdate = 0;
let width = 0;
let height = 0;
let pixelRatio = 1;
let lastTime = 0;

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const rand = random(23817);
const rocks = Array.from({ length: 115 }, () => ({ x: rand() * worldSize, y: rand() * worldSize, size: 4 + rand() * 20, shade: rand() }));
const craters = Array.from({ length: 37 }, () => ({ x: rand() * worldSize, y: rand() * worldSize, rx: 28 + rand() * 90, ry: 12 + rand() * 36, shade: rand() }));
const ridges = Array.from({ length: 18 }, () => ({ x: rand() * worldSize, y: rand() * worldSize, size: 20 + rand() * 55, angle: rand() * Math.PI }));
const speckles = Array.from({ length: 1250 }, () => ({ x: rand() * worldSize, y: rand() * worldSize, r: .6 + rand() * 1.8, a: .04 + rand() * .12 }));

function resize() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function iso(x, y) { return { x: (x - y) * .72, y: (x + y) * .36 }; }
function screenPoint(x, y) {
  const point = iso(x, y);
  const center = iso(astronaut.x, astronaut.y);
  return { x: point.x - center.x + width / 2, y: point.y - center.y + height / 2 };
}

function drawTerrain(time) {
  ctx.fillStyle = '#69635c';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(Math.PI / 4);
  ctx.scale(.72, .36);
  ctx.translate(-astronaut.x, -astronaut.y);
  ctx.fillStyle = '#69635c';
  ctx.fillRect(0, 0, worldSize, worldSize);
  ctx.restore();

  for (const spot of speckles) {
    const p = screenPoint(spot.x, spot.y);
    if (p.x < -3 || p.x > width + 3 || p.y < -3 || p.y > height + 3) continue;
    ctx.fillStyle = `rgba(38, 34, 31, ${spot.a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, spot.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const crater of craters) {
    const p = screenPoint(crater.x, crater.y);
    if (p.x < -crater.rx || p.x > width + crater.rx || p.y < -crater.ry || p.y > height + crater.ry) continue;
    ctx.fillStyle = crater.shade > .5 ? '#59534d' : '#615b55';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, crater.rx, crater.ry, -.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b9ae9d'; ctx.lineWidth = 2; ctx.globalAlpha = .38;
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, crater.rx * .88, crater.ry * .78, -.12, Math.PI * .05, Math.PI * 1.05); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const ridge of ridges) drawRidge(ridge);
  for (const rock of rocks) drawRock(rock);
  drawBaseBuildings(time);
}

function drawBaseBuildings(time) {
  for (const building of [...baseBuildings].sort((first, second) => first.x + first.y - second.x - second.y)) {
    const p = screenPoint(building.x, building.y);
    if (p.x < -building.width || p.x > width + building.width || p.y < -building.height || p.y > height + building.height) continue;
    const top = p.y - building.height * building.groundAnchor;
    const labelY = p.y - building.height * building.labelAnchor;
    const buildingImage = building.id === 'shelter' && storm.shieldLevel > 0 ? building.reinforcedImage : building.image;
    if (buildingImage?.complete && buildingImage.naturalWidth) ctx.drawImage(buildingImage, p.x - building.width / 2, top, building.width, building.height);
    ctx.fillStyle = '#e5ebd7'; ctx.font = '600 9px "DM Mono", monospace'; ctx.textAlign = 'center';
    ctx.shadowColor = '#142322'; ctx.shadowBlur = 5;
    ctx.fillText(building.label, p.x, labelY);
    ctx.shadowBlur = 0;
    if (building.id === 'solar') {
      const solarCharge = supplies.basePower >= 100 ? 1 : supplies.solarProgress;
      drawMeterBar(p.x, labelY + 14, solarCharge, '#f4bf32', 132);
    }
    if (building.id === 'greenhouse') {
      const progress = supplies.greenhouseMeals >= supplies.maxGreenhouseMeals ? 1 : supplies.greenhouseProgress / greenhouseHoursPerMeal;
      drawMeterBar(p.x, labelY + 14, progress, supplies.greenhouseOn ? '#73df87' : '#8d9a83', 132);
      ctx.fillStyle = '#fff3c9'; ctx.font = '700 9px "DM Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${supplies.greenhouseOn ? 'ON' : 'OFF'} · ${supplies.greenhouseMeals} READY`, p.x, labelY + 31);
    }
    if (supplies.activity?.type === 'research' && building.id === 'lab') {
      const progress = Math.min(1, (missionTime - supplies.activity.startAt) / supplies.activity.duration);
      drawMeterBar(p.x, labelY + 14, progress, '#75d5ed', 112);
    }
    if (supplies.activity?.type === 'shield' && building.id === 'shelter') {
      const progress = Math.min(1, (missionTime - supplies.activity.startAt) / supplies.activity.duration);
      drawMeterBar(p.x, labelY + 14, progress, '#e9bd55', 112);
    }
    if (supplies.feedback?.scene === 'lunar' && supplies.feedback.target === building.id) {
      drawRewardBubble(p.x, labelY + 14, time);
    }
  }
  drawSampleSites(time);
  const nearby = getNearbyStation();
  if (nearby) drawInteractionPrompt(nearby);
}

function getNearbyStation() {
  if (supplies.activity) return null;
  const stations = [
    { id: 'control', x: controlRoomDoor.x, y: controlRoomDoor.y, range: 200 },
    { id: 'greenhouse', x: 1500, y: 890, range: 190 },
    { id: 'lab', x: 1690, y: 1230, range: 175 },
    { id: 'shelter', x: 1470, y: 1540, range: 150 },
    ...sampleSites.filter(site => !site.collected && supplies.samplesScanned < requiredSamples).map(site => ({ ...site, type: 'sample', range: 92 }))
  ];
  return stations
    .map(station => ({ ...station, distance: Math.hypot(astronaut.x - station.x, astronaut.y - station.y) }))
    .filter(station => station.distance < station.range)
    .sort((first, second) => first.distance - second.distance)[0] || null;
}

function drawInteractionPrompt(station) {
  const p = screenPoint(station.x, station.y);
  let label = 'E  CONTROL ROOM';
  if (station.id === 'greenhouse') label = supplies.greenhouseMeals > 0 ? 'E  TAKE FOOD' : 'E  CHECK GARDEN';
  else if (station.id === 'lab') label = supplies.carriedSample ? 'E  DROP SAMPLE' : supplies.samplesAtLab >= requiredSamples && !supplies.researchComplete ? 'E  RESEARCH' : 'E  LAB';
  else if (station.id === 'shelter') label = 'E  ENTER SHELTER';
  else if (station.type === 'sample') label = supplies.carriedSample ? 'PACK FULL' : 'E  SCAN SAMPLE';
  ctx.font = 'bold 10px Manrope, sans-serif';
  const boxWidth = Math.max(110, ctx.measureText(label).width + 30);
  const boxY = p.y + 32;
  ctx.fillStyle = '#fff3c9'; ctx.beginPath(); ctx.roundRect(p.x - boxWidth / 2, boxY, boxWidth, 28, 10); ctx.fill();
  ctx.strokeStyle = '#5d5140'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#283a32';
  ctx.fillText(label, p.x, boxY + 18);
}

function drawSampleSites(time) {
  if (supplies.samplesScanned >= requiredSamples) return;
  for (const [index, site] of sampleSites.entries()) {
    if (site.collected) continue;
    const p = screenPoint(site.x, site.y);
    if (p.x < -48 || p.x > width + 48 || p.y < -48 || p.y > height + 48) continue;
    const pulse = 1 + Math.sin(time * .006 + index) * .12;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#332b27a8'; ctx.beginPath(); ctx.ellipse(0, 9, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff7566'; ctx.lineWidth = 3; ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = '#ff635b';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff0c8'; ctx.strokeStyle = '#7d3a32'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(-2, -5); ctx.lineTo(4, -4); ctx.lineTo(6, 2); ctx.lineTo(1, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff1cf'; ctx.font = '700 9px "DM Mono", monospace'; ctx.textAlign = 'center';
    ctx.shadowColor = '#241c17'; ctx.shadowBlur = 5; ctx.fillText('SAMPLE', 0, -25); ctx.shadowBlur = 0;
    if (supplies.activity?.type === 'scan' && supplies.activity.siteIndex === index) {
      const progress = Math.min(1, (missionTime - supplies.activity.startAt) / supplies.activity.duration);
      drawMeterBar(0, -40, progress, '#ff7867', 82);
    }
    if (supplies.feedback?.target === site.id) drawRewardBubble(0, -23, time);
    ctx.restore();
  }
}

function drawMeterBar(x, y, progress, accent, barWidth = 96) {
  const barHeight = 12;
  ctx.save();
  ctx.shadowColor = '#141c1c9c'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#fff7df'; ctx.beginPath(); ctx.roundRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight, 7); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#45433d'; ctx.beginPath(); ctx.roundRect(x - barWidth / 2 + 2, y - barHeight / 2 + 2, barWidth - 4, barHeight - 4, 5); ctx.fill();
  ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(x - barWidth / 2 + 2, y - barHeight / 2 + 2, Math.max(0, (barWidth - 4) * progress), barHeight - 4, 5); ctx.fill();
  ctx.restore();
}

function drawRewardBubble(x, y, time) {
  const feedback = supplies.feedback;
  if (!feedback || feedback.scene !== scene) return;
  const elapsed = time - feedback.startedAt;
  if (elapsed < 0 || elapsed >= 1000) return;
  const progress = elapsed / 1000;
  const label = feedback.text;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.font = '800 15px Manrope, sans-serif';
  const bubbleWidth = Math.max(54, ctx.measureText(label).width + 24);
  const bubbleHeight = 29;
  const bubbleX = x - bubbleWidth / 2;
  const bubbleY = y - 40 - progress * 20;
  ctx.shadowColor = '#12171488'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#fff6d9'; ctx.beginPath(); ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 14); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.moveTo(x - 5, bubbleY + bubbleHeight - 1); ctx.lineTo(x + 5, bubbleY + bubbleHeight - 1); ctx.lineTo(x, bubbleY + bubbleHeight + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = feedback.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, bubbleY + bubbleHeight / 2 + 1);
  ctx.restore();
}

function drawControlRoom(time) {
  ctx.fillStyle = '#192b31'; ctx.fillRect(0, 0, width, height);
  const back = { x: width * .5, y: height * .08 };
  const left = { x: width * .08, y: height * .38 };
  const right = { x: width * .92, y: height * .38 };
  const front = { x: width * .5, y: height * .9 };
  const polygon = (points, fill, stroke = '#42676a', lineWidth = 3) => {
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke();
  };
  const leftTop = { x: width * .08, y: height * .16 };
  const peak = { x: width * .5, y: -.06 * height };
  const rightTop = { x: width * .92, y: height * .16 };
  polygon([left, leftTop, peak, back], '#36585e');
  polygon([back, peak, rightTop, right], '#2f5058');
  polygon([left, back, right, front], '#b4c0b6', '#527076', 5);
  ctx.save(); ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(back.x, back.y); ctx.lineTo(right.x, right.y); ctx.lineTo(front.x, front.y); ctx.closePath(); ctx.clip();
  for (let row = 0; row < 12; row++) for (let col = 0; col < 16; col++) {
    const x = width * .05 + col * width * .06 - row * width * .035;
    const y = height * .23 + row * height * .055 + col * height * .027;
    ctx.fillStyle = (row + col) % 2 ? '#c4ccc0' : '#aebcb4';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width * .06, y + height * .027); ctx.lineTo(x, y + height * .054); ctx.lineTo(x - width * .06, y + height * .027); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  const drawMonitor = (x, y, w, h, accent) => {
    polygon([{ x, y }, { x: x + w, y: y + h * .32 }, { x: x + w, y: y + h * 1.32 }, { x, y: y + h }], '#23464e', '#66888a', 2);
    polygon([{ x: x + w * .1, y: y + h * .1 }, { x: x + w * .87, y: y + h * .34 }, { x: x + w * .87, y: y + h * .88 }, { x: x + w * .1, y: y + h * .65 }], '#13333b', '#8caaa4', 1.5);
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w * .18, y + h * .5); ctx.lineTo(x + w * .36, y + h * .42); ctx.lineTo(x + w * .48, y + h * .54); ctx.lineTo(x + w * .66, y + h * .32); ctx.lineTo(x + w * .8, y + h * .44); ctx.stroke();
  };
  const sunAccent = storm.phase === 'active' ? '#ff7065' : storm.phase === 'warning' ? '#edc45d' : '#70d7c0';
  drawMonitor(width * .23, height * .16, width * .22, height * .16, sunAccent);
  drawMonitor(width * .55, height * .16, width * .22, height * .16, '#e0c77f');
  for (let i = 0; i < 5; i++) {
    const x = width * (.17 + i * .14);
    ctx.fillStyle = '#537980'; ctx.beginPath(); ctx.arc(x, height * .34, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = i === 2 ? '#e4bb70' : '#6dc2a8'; ctx.beginPath(); ctx.arc(x, height * .34, 2, 0, Math.PI * 2); ctx.fill();
  }

  const station = (x, y, scale = 1) => {
    const w = width * .12 * scale, h = height * .075 * scale;
    ctx.fillStyle = '#34484a'; ctx.strokeStyle = '#233b40'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x + w * .38, y + h * .7, w * .25, h * .48, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#82918a'; ctx.beginPath(); ctx.ellipse(x + w * .5, y + h * 1.18, w * .22, h * .12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    polygon([{ x, y }, { x: x + w, y: y + h * .35 }, { x: x + w, y: y + h * .75 }, { x, y: y + h * .4 }], '#547b7b', '#294f56', 2);
    polygon([{ x: x - 3, y: y - 5 }, { x: x + w * .68, y: y + h * .2 - 5 }, { x: x + w * .68, y: y + h * .2 + 4 }, { x: x - 3, y: y + 4 }], '#96c8c0', '#3a6469', 2);
    drawMonitor(x + w * .16, y - h * .55, w * .38, h * .42, '#6dd9c2');
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = ['#e3bf6d', '#70c7b1', '#d27768'][i % 3];
      ctx.beginPath(); ctx.arc(x + w * (.55 + i * .075), y + h * .08, 2.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#45696d'; ctx.fillRect(x + w * .52, y + h * .66, w * .06, h * .34);
  };
  station(width * .16, height * .49, .92);
  station(width * .32, height * .58, 1.05);
  station(width * .53, height * .58, 1.05);
  station(width * .72, height * .49, .92);

  const lockerX = width * .81, lockerY = height * .48, lockerW = width * .09, lockerH = height * .2;
  ctx.fillStyle = '#29474b'; ctx.strokeStyle = '#87aaa0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(lockerX, lockerY, lockerW, lockerH, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e2cd8d'; ctx.fillRect(lockerX + lockerW * .82, lockerY + lockerH * .42, 3, lockerH * .18);
  ctx.fillStyle = '#b8d7c3'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('SUIT BAY', lockerX + lockerW / 2, lockerY + lockerH + 14);
  if (supplies.activity?.type === 'suit') {
    const progress = Math.min(1, (missionTime - supplies.activity.startAt) / supplies.activity.duration);
    drawMeterBar(lockerX + lockerW / 2, lockerY - 10, progress, '#53cbfa');
  }
  if (supplies.feedback?.target === 'suitbay') drawRewardBubble(lockerX + lockerW / 2, lockerY, time);

  drawAstronaut(time);
  if (supplies.feedback?.target === 'astronaut') drawRewardBubble(width * .5, height * .66 - 22, time);
}

function drawShelter(time) {
  ctx.fillStyle = '#202c2d'; ctx.fillRect(0, 0, width, height);
  const polygon = (points, fill, stroke = '#6a766f', lineWidth = 3) => {
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke();
  };
  const left = { x: width * .1, y: height * .42 };
  const back = { x: width * .5, y: height * .18 };
  const right = { x: width * .9, y: height * .42 };
  const front = { x: width * .5, y: height * .82 };
  polygon([{ x: width * .1, y: height * .42 }, { x: width * .1, y: height * .31 }, { x: width * .5, y: height * .04 }, { x: width * .9, y: height * .31 }, { x: width * .9, y: height * .42 }, back], '#555b53');
  polygon([left, back, right, front], '#59655d', '#333f3f', 5);
  ctx.save(); ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(back.x, back.y); ctx.lineTo(right.x, right.y); ctx.lineTo(front.x, front.y); ctx.closePath(); ctx.clip();
  for (let row = 0; row < 9; row++) for (let col = 0; col < 12; col++) {
    const x = width * .08 + col * width * .08 - row * width * .044;
    const y = height * .3 + row * height * .055 + col * height * .036;
    ctx.fillStyle = (row + col) % 2 ? '#68776d' : '#758276';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width * .08, y + height * .036); ctx.lineTo(x, y + height * .072); ctx.lineTo(x - width * .08, y + height * .036); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#383b35'; ctx.strokeStyle = '#8b826e'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(width * .17, height * .41); ctx.quadraticCurveTo(width * .5, height * -.02, width * .83, height * .41); ctx.lineTo(width * .79, height * .45); ctx.quadraticCurveTo(width * .5, height * .08, width * .21, height * .45); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = storm.shieldLevel > 0 ? '#e7c66d' : '#8a8c7e'; ctx.lineWidth = storm.shieldLevel > 0 ? 6 : 3;
  ctx.beginPath(); ctx.moveTo(width * .22, height * .4); ctx.quadraticCurveTo(width * .5, height * .09, width * .78, height * .4); ctx.stroke();
  ctx.restore();
  const lamp = storm.phase === 'active' ? '#f3ba51' : '#83d5ab';
  ctx.fillStyle = '#344444'; ctx.beginPath(); ctx.roundRect(width * .76, height * .49, width * .09, height * .16, 8); ctx.fill();
  ctx.fillStyle = lamp; ctx.shadowColor = lamp; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(width * .805, height * .52, 7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#d7e3d2'; ctx.textAlign = 'center'; ctx.font = '800 12px Manrope, sans-serif';
  ctx.fillText('STORM SHELTER', width * .5, height * .13);
  ctx.fillStyle = storm.shieldLevel > 0 ? '#f1cf71' : '#b7c7bb'; ctx.font = '700 9px "DM Mono", monospace';
  ctx.fillText(storm.shieldLevel > 0 ? 'EXTRA SOIL LAYER' : 'SOIL COVER', width * .5, height * .17);
  drawAstronaut(time);
}

function drawRock(rock) {
  const p = screenPoint(rock.x, rock.y);
  if (p.x < -30 || p.x > width + 30 || p.y < -30 || p.y > height + 30) return;
  const s = rock.size;
  ctx.fillStyle = rock.shade > .5 ? '#625d58' : '#77716a';
  ctx.strokeStyle = '#514a44'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(p.x - s, p.y + s * .12); ctx.lineTo(p.x - s * .45, p.y - s * .45); ctx.lineTo(p.x + s * .05, p.y - s * .62); ctx.lineTo(p.x + s * .7, p.y - s * .15); ctx.lineTo(p.x + s * .52, p.y + s * .35); ctx.lineTo(p.x - s * .5, p.y + s * .48); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#b8ab98'; ctx.globalAlpha = .48;
  ctx.beginPath(); ctx.moveTo(p.x - s * .45, p.y - s * .45); ctx.lineTo(p.x - s * .12, p.y + s * .05); ctx.lineTo(p.x + s * .05, p.y - s * .62); ctx.stroke(); ctx.globalAlpha = 1;
}

function drawRidge(ridge) {
  const p = screenPoint(ridge.x, ridge.y);
  if (p.x < -100 || p.x > width + 100 || p.y < -100 || p.y > height + 100) return;
  const s = ridge.size;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ridge.angle);
  ctx.fillStyle = 'rgba(28, 25, 22, .28)'; ctx.beginPath(); ctx.ellipse(0, 8, s * 1.05, s * .22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#777067'; ctx.strokeStyle = '#514b45'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-s, 6); ctx.quadraticCurveTo(-s * .72, -s * .2, -s * .35, -s * .24); ctx.quadraticCurveTo(0, -s * .56, s * .34, -s * .24); ctx.quadraticCurveTo(s * .75, -s * .18, s, 6); ctx.quadraticCurveTo(0, s * .2, -s, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#c1b49e'; ctx.globalAlpha = .48; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-s * .7, -s * .13); ctx.quadraticCurveTo(-s * .35, -s * .31, 0, -s * .43); ctx.quadraticCurveTo(s * .4, -s * .3, s * .68, -s * .13); ctx.stroke(); ctx.restore();
}

function drawAstronaut(time) {
  const inside = scene === 'room' || scene === 'shelter';
  const p = inside ? { x: width * .5, y: height * .66 } : { x: width / 2, y: height / 2 };
  const scale = inside ? 1.35 : 1.3;
  if (scene === 'room' && !astronaut.suited) {
    ctx.save(); ctx.translate(p.x, p.y + Math.sin(time * .002) * .45); ctx.scale(scale, scale);
    ctx.fillStyle = '#294c4c70'; ctx.beginPath(); ctx.ellipse(0, 17, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#303e4a'; ctx.beginPath(); ctx.roundRect(-7, 0, 6, 14, 2); ctx.roundRect(2, 0, 6, 14, 2); ctx.fill();
    ctx.fillStyle = '#6e827a'; ctx.beginPath(); ctx.roundRect(-10, -13, 20, 18, 6); ctx.fill();
    ctx.fillStyle = '#c7d2bf'; ctx.beginPath(); ctx.arc(0, -17, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#54483d'; ctx.beginPath(); ctx.arc(0, -20, 8, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#263b41'; ctx.beginPath(); ctx.arc(3, -17, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c7d2bf'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-12, 1); ctx.moveTo(8, -8); ctx.lineTo(12, 1); ctx.stroke();
    ctx.restore();
    return;
  }
  const phase = time * .016;
  const working = Boolean(supplies.activity) && scene === 'lunar';
  const bounce = astronaut.moving ? Math.abs(Math.sin(phase)) * 2.4 : working ? Math.abs(Math.sin(phase * .55)) * .8 : Math.sin(time * .002) * .45;
  const stride = astronaut.moving ? Math.sin(phase) * 5 : 0;
  ctx.save(); ctx.translate(p.x, p.y + bounce); ctx.scale(astronaut.facingLeft ? -scale : scale, scale);
  ctx.fillStyle = '#294c4c70'; ctx.beginPath(); ctx.ellipse(0, 17, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#536a61'; ctx.strokeStyle = '#344f50'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.roundRect(-8 + stride, 0, 7, 14, 3); ctx.roundRect(2 - stride, 0, 7, 14, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e9d39a'; ctx.beginPath(); ctx.roundRect(-10 + stride, 11, 9, 4, 2); ctx.roundRect(1 - stride, 11, 9, 4, 2); ctx.fill();
  ctx.fillStyle = '#b8c4b6'; ctx.strokeStyle = '#63786d';
  ctx.beginPath(); ctx.roundRect(-14, -13, 8, 17, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7c9387'; ctx.fillRect(-12, -10, 3, 10);
  for (let meal = 0; meal < supplies.meals; meal++) {
    ctx.fillStyle = '#e3c477'; ctx.fillRect(-13 + (meal % 2) * 4, -8 + Math.floor(meal / 2) * 5, 3, 3);
  }
  if (supplies.carriedSample) {
    ctx.fillStyle = '#ff7666'; ctx.strokeStyle = '#713f35'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, -11); ctx.lineTo(12, -15); ctx.lineTo(16, -13); ctx.lineTo(15, -8); ctx.lineTo(10, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#dae0cf'; ctx.strokeStyle = '#63786d'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-9, -14, 20, 20, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d5c47e'; ctx.fillRect(-7, -5, 15, 4);
  ctx.fillStyle = '#b8c4b6'; ctx.beginPath(); ctx.arc(0, -17, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#254e5a'; ctx.beginPath(); ctx.ellipse(4, -18, 7.2, 5.8, -.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#94c6c0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(4, -18, 6.2, Math.PI * 1.08, Math.PI * 1.8); ctx.stroke();
  ctx.fillStyle = '#e8c977'; ctx.beginPath(); ctx.arc(-7, -19, 1.3, 0, Math.PI * 2); ctx.fill();
  const workReach = working ? Math.sin(phase * .55) * 3 : 0;
  ctx.strokeStyle = '#dce1d1'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-12 - stride * .35, 0); ctx.moveTo(9, -8); ctx.lineTo(12 + stride * .35 - workReach, -3 + workReach); ctx.stroke();
  ctx.fillStyle = '#e6d09a'; ctx.beginPath(); ctx.arc(-12 - stride * .35, 1, 2.2, 0, Math.PI * 2); ctx.arc(12 + stride * .35 - workReach, -3 + workReach, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMinimap() {
  const radar = document.querySelector('#radar');
  const map = radar.getContext('2d');
  const w = radar.width, h = radar.height;
  map.fillStyle = '#4c4945'; map.fillRect(0, 0, w, h);
  const mapPoint = point => ({ x: w / 2 + (point.x - point.y) / worldSize * w * .5, y: h / 2 + (point.x + point.y - worldSize) / worldSize * h * .45 });
  for (const crater of craters) {
    const p = mapPoint(crater);
    map.fillStyle = '#706a63'; map.beginPath(); map.ellipse(p.x, p.y, crater.rx / worldSize * w * .52, crater.ry / worldSize * h * .45, -.12, 0, Math.PI * 2); map.fill();
  }
  const room = mapPoint(controlRoomDoor);
  for (const building of baseBuildings) {
    const p = mapPoint(building);
    map.fillStyle = building.id === 'control' ? '#f4d27f' : building.id === 'greenhouse' ? '#83d19b' : building.id === 'shelter' ? '#d9a65a' : '#c6e0d5';
    map.beginPath(); map.arc(p.x, p.y, building.id === 'control' ? 4 : 3, 0, Math.PI * 2); map.fill();
    map.strokeStyle = '#143638'; map.lineWidth = 1.2; map.stroke();
  }
  for (const site of sampleSites) {
    if (site.collected || supplies.samplesScanned >= requiredSamples) continue;
    const p = mapPoint(site);
    map.fillStyle = '#ff6158'; map.beginPath(); map.arc(p.x, p.y, 4, 0, Math.PI * 2); map.fill();
    map.strokeStyle = '#fff1cf'; map.lineWidth = 1.5; map.stroke();
  }
  const player = scene === 'room' ? room : scene === 'shelter' ? mapPoint({ x: 1470, y: 1540 }) : mapPoint(astronaut);
  map.fillStyle = '#f5f3d9'; map.beginPath(); map.arc(player.x, player.y, 4, 0, Math.PI * 2); map.fill();
  map.strokeStyle = '#183638'; map.lineWidth = 1.5; map.stroke();
}

function updateMissionClock() {
  const date = new Date(missionTime);
  const minute = Math.floor(missionTime / 60000);
  if (minute === lastClockMinute) return;
  lastClockMinute = minute;
  const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(date).toUpperCase();
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minuteText = String(date.getUTCMinutes()).padStart(2, '0');
  document.querySelector('#mission-time').textContent = `${day} ${month} ${date.getUTCFullYear()} · ${hour}:${minuteText} UTC`;
}

function formatGameTimeLeft(milliseconds) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
}

function updateMissionHud() {
  const minutesLeft = Math.max(0, Math.ceil((missionDeadlineAt - missionTime) / 60000));
  const days = Math.floor(minutesLeft / (24 * 60));
  const hours = Math.floor((minutesLeft % (24 * 60)) / 60);
  const minutes = minutesLeft % 60;
  const timeText = days ? `${days}d ${String(hours).padStart(2, '0')}h` : hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
  document.querySelector('#mission-time-left').textContent = timeText;
  document.querySelector('#mission-sample-count').textContent = `${supplies.samplesScanned} / ${requiredSamples}`;
  document.querySelector('#mission-sample-fill').style.width = `${Math.min(100, supplies.samplesScanned / requiredSamples * 100)}%`;
  const eventsPassed = storm.episodes.filter(episode => missionTime >= episode.endAt).length;
  document.querySelector('#mission-event-count').textContent = `${eventsPassed} / ${storm.episodes.length || 2}`;
  const researchState = document.querySelector('#mission-research-state');
  if (supplies.researchComplete && (storm.dataState !== 'ready' || storm.phase === 'passed')) researchState.textContent = 'MISSION COMPLETE';
  else if (supplies.researchComplete) researchState.textContent = 'RESEARCH DONE · STAY ALERT';
  else if (supplies.activity?.type === 'research') researchState.textContent = 'ANALYZING SAMPLES';
  else if (supplies.samplesAtLab >= requiredSamples) researchState.textContent = 'READY TO RESEARCH';
  else if (supplies.carriedSample) researchState.textContent = 'RETURN SAMPLE TO LAB';
  else researchState.textContent = 'TAKE SAMPLES TO THE LAB';
}

async function loadScenarioSEP() {
  storm.dataState = 'loading';
  updateStormHud();
  try {
    const url = new URL('/api/donki/sep', window.location.origin);
    url.search = new URLSearchParams({ startDate: '2012-01-23', endDate: '2012-01-31' });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`DONKI returned HTTP ${response.status}`);
    const records = await response.json();
    if (!Array.isArray(records)) throw new Error('DONKI did not return event records');
    const recordsInOrder = records
      .filter(record => record?.eventTime && !Number.isNaN(Date.parse(record.eventTime)))
      .sort((first, second) => Date.parse(first.eventTime) - Date.parse(second.eventTime));
    const episodes = [];
    for (const record of recordsInOrder) {
      const eventAt = Date.parse(record.eventTime);
      if (eventAt <= missionTime) continue;
      const latestEpisode = episodes.at(-1);
      if (!latestEpisode || eventAt - latestEpisode.lastRecordAt > sepEpisodeGap) {
        episodes.push({ startAt: eventAt, lastRecordAt: eventAt, records: [record] });
      } else {
        latestEpisode.lastRecordAt = eventAt;
        latestEpisode.records.push(record);
      }
    }
    storm.episodes = episodes.map(episode => ({
      ...episode,
      alertAt: episode.startAt - 2 * gameHour,
      endAt: episode.startAt + simulatedStormDuration
    }));
    if (!storm.episodes.length) {
      storm.event = null;
      storm.dataState = 'no-event';
      storm.phase = 'quiet';
      updateStormHud();
      return;
    }
    storm.currentIndex = 0;
    storm.event = storm.episodes[0].records[0];
    storm.startAt = storm.episodes[0].startAt;
    storm.alertAt = storm.episodes[0].alertAt;
    storm.endAt = storm.episodes[0].endAt;
    storm.exposure = 0;
    storm.phase = 'quiet';
    storm.dataState = 'ready';
  } catch {
    storm.event = null;
    storm.dataState = 'offline';
    storm.phase = 'offline';
  }
  updateStormHud();
}

function updateStormState(gameHours) {
  if (storm.dataState !== 'ready' || !storm.episodes.length || !gameStarted) return;
  const previousPhase = storm.phase;
  const previousIndex = storm.currentIndex;
  const nextIndex = storm.episodes.findIndex(episode => missionTime < episode.endAt);
  storm.currentIndex = nextIndex < 0 ? storm.episodes.length - 1 : nextIndex;
  const episode = storm.episodes[storm.currentIndex];
  storm.event = episode.records[0];
  storm.startAt = episode.startAt;
  storm.alertAt = episode.alertAt;
  storm.endAt = episode.endAt;
  if (nextIndex < 0) storm.phase = 'passed';
  else if (missionTime >= episode.startAt) storm.phase = 'active';
  else if (missionTime >= episode.alertAt) storm.phase = 'warning';
  else storm.phase = 'quiet';

  if (storm.phase !== previousPhase || storm.currentIndex !== previousIndex) {
    if (storm.phase === 'warning') setResourceNotice('SOLAR EVENT WARNING · GO TO THE SHELTER', 5000);
    if (storm.phase === 'active') setResourceNotice('SOLAR PARTICLES DETECTED · GET INSIDE', 5000);
    if (previousPhase === 'active' && storm.phase !== 'active') setResourceNotice('SOLAR EVENT PASSED');
  }
  if (storm.phase !== 'active' || gameHours <= 0) return;
  const riskPerHour = scene === 'shelter' ? (storm.shieldLevel > 0 ? 2 : 15) : scene === 'room' ? 25 : 40;
  storm.exposure = Math.min(100, storm.exposure + riskPerHour * gameHours);
  if (storm.exposure >= 100) endMission('radiation');
}

function updateStormHud() {
  const alert = document.querySelector('#storm-alert');
  const meter = document.querySelector('#radiation-panel');
  const phase = storm.phase;
  const showAlert = gameStarted && (phase === 'warning' || phase === 'active');
  alert.hidden = !showAlert;
  alert.classList.toggle('is-active', phase === 'active');
  meter.hidden = !gameStarted || (phase !== 'warning' && phase !== 'active');
  const alertTitle = document.querySelector('#storm-alert-title');
  const alertCountdown = document.querySelector('#storm-alert-countdown');
  const episodeNumber = Math.min(storm.currentIndex + 1, Math.max(1, storm.episodes.length));
  if (phase === 'warning') {
    alertTitle.textContent = 'SOLAR EVENT WARNING';
    alertCountdown.textContent = `EVENT ${episodeNumber} OF ${storm.episodes.length} · IN ${formatGameTimeLeft(storm.startAt - missionTime)} · GO TO SHELTER`;
  } else if (phase === 'active') {
    alertTitle.textContent = 'SOLAR PARTICLES DETECTED';
    alertCountdown.textContent = `RADIATION RISK RISING · ${scene === 'shelter' ? 'IN SHELTER' : scene === 'room' ? 'IN CONTROL ROOM' : 'OUTSIDE'} · ${formatGameTimeLeft(storm.endAt - missionTime)} LEFT`;
  }
  const sunState = document.querySelector('#sun-state');
  const sunCountdown = document.querySelector('#sun-countdown');
  const solarVisual = document.querySelector('.solar-visual');
  const eventTime = document.querySelector('#sun-event-time');
  const instrument = document.querySelector('#sun-instrument');
  const retry = document.querySelector('#retry-sun-data');
  if (storm.dataState === 'loading') {
    sunState.textContent = 'LOADING NASA EVENT'; sunCountdown.textContent = '—';
    eventTime.textContent = 'Checking the January archive…'; instrument.textContent = '';
  } else if (storm.dataState === 'offline') {
    sunState.textContent = 'NASA DATA OFFLINE'; sunCountdown.textContent = 'NO STORM SCHEDULED';
    eventTime.textContent = 'The archive could not be reached.'; instrument.textContent = '';
  } else if (storm.dataState === 'no-event') {
    sunState.textContent = 'NO SEP EVENT'; sunCountdown.textContent = 'NO STORM SCHEDULED';
    eventTime.textContent = 'No event in this scenario window.'; instrument.textContent = '';
  } else {
    const at = new Date(storm.startAt);
    const label = new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }).format(at).toUpperCase();
    const episode = storm.episodes[storm.currentIndex];
    const detectors = [...new Set(episode.records.flatMap(record => (record.instruments || []).map(item => item.displayName).filter(Boolean)))];
    eventTime.textContent = `EVENT ${episodeNumber} OF ${storm.episodes.length} · ${label} UTC`;
    instrument.textContent = detectors.slice(0, 2).join(' · ').slice(0, 54);
    if (phase === 'warning') { sunState.textContent = 'SOLAR EVENT WARNING'; sunCountdown.textContent = `IN ${formatGameTimeLeft(storm.startAt - missionTime)}`; }
    else if (phase === 'active') { sunState.textContent = 'PARTICLES DETECTED'; sunCountdown.textContent = `${formatGameTimeLeft(storm.endAt - missionTime)} LEFT`; }
    else if (phase === 'passed') { sunState.textContent = 'ALL EVENTS PASSED'; sunCountdown.textContent = 'CLEAR'; }
    else if (storm.currentIndex > 0) { sunState.textContent = 'NEXT SOLAR EVENT'; sunCountdown.textContent = `IN ${formatGameTimeLeft(storm.alertAt - missionTime)}`; }
    else { sunState.textContent = 'SUN WATCH'; sunCountdown.textContent = `EVENT IN ${formatGameTimeLeft(storm.alertAt - missionTime)}`; }
  }
  solarVisual.classList.toggle('is-warning', phase === 'warning');
  solarVisual.classList.toggle('is-active', phase === 'active');
  retry.hidden = storm.dataState !== 'offline';
  const shieldState = document.querySelector('#shelter-shield-state');
  const shieldButton = document.querySelector('#reinforce-shelter');
  const shieldNote = document.querySelector('#shield-note');
  const shieldFill = document.querySelector('#shield-work-fill');
  const shielding = supplies.activity?.type === 'shield';
  shieldState.textContent = storm.shieldLevel > 0 ? 'REINFORCED' : shielding ? 'ROVER WORKING' : 'SOIL COVER';
  shieldButton.textContent = storm.shieldLevel > 0 ? 'SHELTER READY' : shielding ? 'ROVER PILING SOIL' : 'ADD SOIL · 18 POWER';
  shieldButton.disabled = scene !== 'room' || storm.shieldLevel > 0 || shielding || supplies.activity !== null || supplies.basePower < 18;
  shieldNote.textContent = storm.shieldLevel > 0 ? 'Soil stays in place. Restart the garden when ready.' : 'Rover uses power; garden pauses while it works.';
  shieldFill.style.width = shielding ? `${Math.min(100, (missionTime - supplies.activity.startAt) / supplies.activity.duration * 100)}%` : storm.shieldLevel > 0 ? '100%' : '0%';
  const riskStatus = document.querySelector('#radiation-risk-status');
  riskStatus.textContent = phase === 'warning' ? 'GO TO THE SHELTER' : scene === 'shelter' ? 'INSIDE SHELTER' : scene === 'room' ? 'INSIDE CONTROL ROOM' : 'OUTSIDE · GET INSIDE';
  meter.classList.toggle('is-active', phase === 'active');
  meter.classList.toggle('is-warning', phase === 'warning');
  document.querySelector('#radiation-risk-value').textContent = `${Math.round(storm.exposure)}%`;
  document.querySelector('#radiation-risk-fill').style.width = `${storm.exposure}%`;
}

function drawStormEffects(time) {
  if (storm.phase !== 'active' || scene !== 'lunar') return;
  ctx.save();
  ctx.fillStyle = 'rgba(190, 64, 45, .105)'; ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 16; i++) {
    const x = ((i * 137 + time * (.018 + (i % 3) * .006)) % (width + 60)) - 30;
    const y = (i * 79 + Math.sin(time * .001 + i) * 24) % (height + 40);
    ctx.strokeStyle = i % 3 ? '#ffc17a9c' : '#ff766cbd'; ctx.lineWidth = i % 3 ? 2 : 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 13, y - 4); ctx.stroke();
  }
  ctx.restore();
}

function updateControlHints() {
  const inside = scene === 'room' || scene === 'shelter';
  document.querySelectorAll('.move-key').forEach(key => { key.hidden = inside; });
  document.querySelector('#control-hint-text').textContent = scene === 'shelter'
    ? 'C eat · E / Esc out'
    : scene === 'room' ? 'F suit · C eat · G garden · E sun watch · Esc out' : 'E use · G garden';
}

function setResourceNotice(message, duration = 2200) {
  const notice = document.querySelector('#resource-notice');
  notice.textContent = message;
  supplies.noticeUntil = performance.now() + duration;
}

function endMission(resource) {
  if (missionEnded) return;
  missionEnded = true;
  gameStarted = false;
  astronaut.moving = false;
  keys.clear();
  supplies.activity = null;
  supplies.feedback = null;
  const title = document.querySelector('#mission-over-title');
  const message = document.querySelector('#mission-over-message');
  const restart = document.querySelector('#restart-game');
  if (resource === 'success') {
    title.textContent = 'MISSION COMPLETE';
    message.textContent = 'The samples were studied before time ran out.';
    restart.textContent = 'PLAY AGAIN';
  } else if (resource === 'deadline') {
    title.textContent = "TIME'S UP";
    message.textContent = 'Return 3 samples to the lab and finish the research.';
    restart.textContent = 'TRY AGAIN';
  } else {
    title.textContent = 'MISSION OVER';
    message.textContent = resource === 'air'
      ? 'Suit air ran out.'
      : resource === 'battery' ? 'Suit battery ran out.' : 'Radiation risk got too high. Head for the shelter sooner next time.';
    restart.textContent = 'TRY AGAIN';
  }
  document.querySelector('#mission-over').hidden = false;
}

function harvestGreenhouse() {
  if (supplies.greenhouseMeals < 1) return setResourceNotice(supplies.greenhouseOn ? 'FOOD IS GROWING' : 'GARDEN IS PAUSED');
  if (supplies.meals >= supplies.maxMeals) return setResourceNotice('PACK IS FULL');
  supplies.greenhouseMeals -= 1;
  supplies.meals += 1;
  supplies.feedback = { text: '+1', target: 'greenhouse', scene: 'lunar', startedAt: performance.now(), color: '#3cae64' };
  document.querySelector('#resource-notice').textContent = '';
  updateSuppliesHud();
}

function toggleGreenhouse(remote = false) {
  if (!remote && scene === 'lunar' && getNearbyStation()?.id !== 'greenhouse') return setResourceNotice('GO TO THE GARDEN');
  if (!remote && scene !== 'lunar' && scene !== 'room') return;
  supplies.greenhouseOn = !supplies.greenhouseOn;
  setResourceNotice(supplies.greenhouseOn ? 'GARDEN ON' : 'GARDEN PAUSED');
  updateSuppliesHud();
}

function beginSampleScan(siteIndex) {
  if (!astronaut.suited) return setResourceNotice('SUIT UP FIRST');
  if (supplies.carriedSample) return setResourceNotice('CARRY ONE SAMPLE AT A TIME');
  if (supplies.samplesScanned >= requiredSamples) return setResourceNotice('3 SAMPLES IS ENOUGH');
  if (supplies.suitEnergy < 8) return setResourceNotice('LOW BATTERY · GO BACK');
  supplies.suitEnergy -= 8;
  supplies.activity = { type: 'scan', siteIndex, startAt: missionTime, duration: gameHour / 2 };
  document.querySelector('#resource-notice').textContent = '';
  updateSuppliesHud();
}

function interactWithLab() {
  if (supplies.carriedSample) {
    supplies.carriedSample = false;
    supplies.samplesAtLab += 1;
    supplies.feedback = { text: '+1', target: 'lab', scene: 'lunar', startedAt: performance.now(), color: '#438fd2' };
    setResourceNotice(`SAMPLE STORED · ${supplies.samplesAtLab}/3`);
    updateSuppliesHud();
    return;
  }
  if (supplies.researchComplete) return setResourceNotice('RESEARCH COMPLETE');
  if (supplies.samplesAtLab < requiredSamples) return setResourceNotice(`NEED ${requiredSamples - supplies.samplesAtLab} MORE SAMPLE${supplies.samplesAtLab === requiredSamples - 1 ? '' : 'S'}`);
  if (supplies.basePower < 15) return setResourceNotice('NEED 15 POWER');
  supplies.basePower -= 15;
  supplies.activity = { type: 'research', startAt: missionTime, duration: 2 * gameHour };
  document.querySelector('#resource-notice').textContent = '';
}

function interactWithShelter() {
  if (!astronaut.suited) return setResourceNotice('SUIT UP FIRST');
  scene = 'shelter';
  astronaut.moving = false;
  keys.clear();
  updateControlHints();
  updateStormHud();
}

function beginShieldReinforcement() {
  if (scene !== 'room') return setResourceNotice('GO TO CONTROL ROOM');
  if (supplies.activity) return setResourceNotice('JOB IN PROGRESS');
  if (storm.shieldLevel > 0) return setResourceNotice('SHELTER READY');
  if (supplies.basePower < 18) return setResourceNotice('NEED 18 POWER');
  supplies.basePower -= 18;
  supplies.greenhouseOn = false;
  supplies.activity = { type: 'shield', startAt: missionTime, duration: gameHour / 2 };
  setResourceNotice('GARDEN PAUSED · ROVER MOVING SOIL');
  updateSuppliesHud();
}

function prepareSuit() {
  if (scene !== 'room') return setResourceNotice('GO INSIDE');
  if (supplies.activity) return setResourceNotice('BUSY!');
  if (astronaut.suited) {
    astronaut.suited = false;
    setResourceNotice('SUIT STORED');
    updateSuppliesHud();
    return;
  }
  const powerCost = 4 + Math.ceil((100 - supplies.suitEnergy) * .25 + (100 - supplies.suitLifeSupport) * .1);
  if (supplies.basePower < powerCost) return setResourceNotice('LOW POWER');
  supplies.basePower -= powerCost;
  supplies.activity = { type: 'suit', startAt: missionTime, duration: gameHour / 2 };
  document.querySelector('#resource-notice').textContent = '';
  updateSuppliesHud();
}

function eatMeal() {
  if (scene !== 'room' && scene !== 'shelter') return setResourceNotice('EAT INSIDE');
  if (supplies.activity?.type === 'suit') return setResourceNotice('WAIT FOR SUIT');
  if (supplies.meals < 1) return setResourceNotice('NO FOOD');
  if (supplies.stamina >= 95) return setResourceNotice('ALREADY RESTED');
  supplies.meals -= 1;
  supplies.stamina = Math.min(100, supplies.stamina + 45);
  supplies.feedback = { text: '+45', target: 'astronaut', scene: 'room', startedAt: performance.now(), color: '#ee5260' };
  document.querySelector('#resource-notice').textContent = '';
  updateSuppliesHud();
}

function finishActivity() {
  const activity = supplies.activity;
  if (!activity) return;
  if (activity.type === 'suit') {
    supplies.suitEnergy = 100;
    supplies.suitLifeSupport = 100;
    astronaut.suited = true;
    supplies.feedback = { text: 'READY!', target: 'suitbay', scene: 'room', startedAt: performance.now(), color: '#b88500' };
  } else if (activity.type === 'scan') {
    const site = sampleSites[activity.siteIndex];
    if (site) {
      site.collected = true;
      supplies.samplesScanned += 1;
      supplies.carriedSample = true;
      supplies.feedback = { text: '+1', target: site.id, scene: 'lunar', startedAt: performance.now(), color: '#d34c45' };
    }
  } else if (activity.type === 'research') {
    supplies.samplesAtLab = 0;
    supplies.researchPoints += 1;
    supplies.researchComplete = true;
    supplies.feedback = { text: '+1', target: 'lab', scene: 'lunar', startedAt: performance.now(), color: '#438fd2' };
  } else if (activity.type === 'shield') {
    storm.shieldLevel = 1;
    supplies.feedback = { text: 'SHIELDED', target: 'shelter', scene: 'lunar', startedAt: performance.now(), color: '#b88500' };
  }
  document.querySelector('#resource-notice').textContent = '';
  supplies.activity = null;
  if (activity.type === 'shield') setResourceNotice('SHELTER REINFORCED');
  updateStormHud();
}

function updateSupplies(dt, time) {
  if (!gameStarted) return;
  if (supplies.feedback && time - supplies.feedback.startedAt >= 1000) supplies.feedback = null;
  const previousMissionTime = missionTime;
  missionTime += dt * gameHour / 5;
  const gameHours = (missionTime - previousMissionTime) / gameHour;
  updateStormState(gameHours);
  if (missionEnded) return;
  if (supplies.researchComplete && (storm.dataState !== 'ready' || storm.phase === 'passed')) {
    endMission('success');
    return;
  }
  if (missionTime >= missionDeadlineAt) {
    endMission('deadline');
    return;
  }
  if (supplies.basePower < 100) {
    supplies.solarProgress += solarPowerPerHour * gameHours;
    const generatedPower = Math.floor(supplies.solarProgress + 1e-9);
    if (generatedPower > 0) {
      const powerGained = Math.min(generatedPower, 100 - supplies.basePower);
      supplies.basePower += powerGained;
      supplies.solarProgress = Math.max(0, supplies.solarProgress - generatedPower);
      if (supplies.basePower >= 100) supplies.solarProgress = 0;
      if (scene === 'lunar') {
        supplies.feedback = { text: `+${powerGained}`, target: 'solar', scene: 'lunar', startedAt: time, color: '#b88500' };
      }
    }
  } else {
    supplies.solarProgress = 0;
  }

  const gardenCanGrow = supplies.greenhouseOn && supplies.greenhouseMeals < supplies.maxGreenhouseMeals && supplies.basePower > 0;
  const powerUse = basePowerUsePerHour + (gardenCanGrow ? greenhousePowerPerHour : 0);
  supplies.basePower = Math.max(0, supplies.basePower - powerUse * gameHours);
  if (gardenCanGrow) {
    supplies.greenhouseProgress += gameHours;
    while (supplies.greenhouseProgress >= greenhouseHoursPerMeal && supplies.greenhouseMeals < supplies.maxGreenhouseMeals) {
      supplies.greenhouseProgress -= greenhouseHoursPerMeal;
      supplies.greenhouseMeals += 1;
      supplies.feedback = { text: '+1', target: 'greenhouse', scene: 'lunar', startedAt: time, color: '#3cae64' };
    }
  }

  if (scene === 'lunar' && astronaut.suited) {
    supplies.suitEnergy = Math.max(0, supplies.suitEnergy - gameHours * 2.5 - (astronaut.moving ? dt * .65 : 0));
    supplies.suitLifeSupport = Math.max(0, supplies.suitLifeSupport - gameHours * 8);
    if (supplies.suitEnergy < 40 && !supplies.warnedBattery) {
      supplies.warnedBattery = true;
      setResourceNotice('LOW BATTERY · GO BACK');
    } else if (supplies.suitEnergy >= 45) {
      supplies.warnedBattery = false;
    }
    if (supplies.suitLifeSupport < 20 && !supplies.warnedLifeSupport) {
      supplies.warnedLifeSupport = true;
      setResourceNotice('LOW AIR · GO BACK');
    } else if (supplies.suitLifeSupport >= 25) {
      supplies.warnedLifeSupport = false;
    }
    if (supplies.suitLifeSupport <= 0) {
      endMission('air');
      return;
    }
    if (supplies.suitEnergy <= 0) {
      endMission('battery');
      return;
    }
  }
  if (astronaut.moving) supplies.stamina = Math.max(0, supplies.stamina - dt * 1.2);
  if (supplies.activity && missionTime >= supplies.activity.startAt + supplies.activity.duration) finishActivity();
  if (time - lastSuppliesUpdate < 120) return;
  lastSuppliesUpdate = time;
  updateSuppliesHud(time);
}

function updateSuppliesHud(time = performance.now()) {
  const basePower = Math.round(supplies.basePower);
  const suitEnergy = Math.round(supplies.suitEnergy);
  const suitLifeSupport = Math.round(supplies.suitLifeSupport);
  const stamina = Math.round(supplies.stamina);
  const powerFill = document.querySelector('#base-power-fill');
  const suitFill = document.querySelector('#suit-energy-fill');
  const lifeSupportFill = document.querySelector('#life-support-fill');
  const staminaFill = document.querySelector('#stamina-fill');
  document.querySelector('#base-power-value').textContent = `${basePower} / 100`;
  document.querySelector('#suit-energy-value').textContent = `${suitEnergy}%`;
  powerFill.style.width = `${supplies.basePower}%`;
  powerFill.classList.toggle('warning', supplies.basePower < 35 && supplies.basePower >= 15);
  powerFill.classList.toggle('critical', supplies.basePower < 15);
  suitFill.style.width = `${supplies.suitEnergy}%`;
  suitFill.classList.toggle('warning', supplies.suitEnergy < 40 && supplies.suitEnergy >= 20);
  suitFill.classList.toggle('critical', supplies.suitEnergy < 20);
  document.querySelector('#life-support-value').textContent = `${suitLifeSupport}%`;
  lifeSupportFill.style.width = `${supplies.suitLifeSupport}%`;
  lifeSupportFill.classList.toggle('warning', supplies.suitLifeSupport < 40 && supplies.suitLifeSupport >= 20);
  lifeSupportFill.classList.toggle('critical', supplies.suitLifeSupport < 20);
  document.querySelector('#stamina-value').textContent = `${stamina}%`;
  staminaFill.style.width = `${supplies.stamina}%`;
  staminaFill.classList.toggle('warning', supplies.stamina < 40 && supplies.stamina >= 20);
  staminaFill.classList.toggle('critical', supplies.stamina < 20);
  document.querySelector('#meal-value').textContent = `${supplies.meals} / ${supplies.maxMeals}`;
  document.querySelectorAll('#meal-pips i').forEach((pip, index) => pip.classList.toggle('empty', index >= supplies.meals));
  document.querySelector('#sample-value').textContent = `${supplies.samplesScanned} / ${requiredSamples}`;
  document.querySelectorAll('#sample-pips i').forEach((pip, index) => pip.classList.toggle('empty', index >= supplies.samplesScanned));
  document.querySelector('#sample-note').textContent = supplies.carriedSample
    ? 'CARRYING ONE'
    : supplies.samplesAtLab > 0 ? `${supplies.samplesAtLab} AT LAB` : supplies.researchComplete ? 'RESEARCH DONE' : 'SCAN RED DOTS';
  document.querySelector('#research-value').textContent = String(supplies.researchPoints);
  const gardenState = document.querySelector('#garden-state');
  const gardenFill = document.querySelector('#garden-progress-fill');
  const gardenToggle = document.querySelector('#garden-toggle');
  const gardenStopped = !supplies.greenhouseOn;
  const gardenFull = supplies.greenhouseMeals >= supplies.maxGreenhouseMeals;
  gardenState.textContent = gardenStopped ? 'PAUSED' : gardenFull ? 'READY' : supplies.basePower <= 0 ? 'NO POWER' : 'GROWING';
  gardenFill.style.width = `${gardenFull ? 100 : supplies.greenhouseProgress / greenhouseHoursPerMeal * 100}%`;
  gardenFill.classList.toggle('paused', gardenStopped || supplies.basePower <= 0);
  document.querySelector('#garden-ready').textContent = `${supplies.greenhouseMeals} READY · +1/4h · −1.5 PWR/h`;
  gardenToggle.textContent = gardenStopped ? 'START' : 'PAUSE';
  gardenToggle.setAttribute('aria-pressed', String(supplies.greenhouseOn));
  updateMissionHud();
  updateStormHud();
  if (time >= supplies.noticeUntil) document.querySelector('#resource-notice').textContent = '';
}

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, .04); lastTime = time;
  updateSupplies(dt, time);
  if (gameStarted) updateMissionClock();
  if (missionEnded) {
    ctx.clearRect(0, 0, width, height);
    if (scene === 'room') drawControlRoom(time);
    else if (scene === 'shelter') drawShelter(time);
    else { drawTerrain(time); drawStormEffects(time); drawAstronaut(time); }
    drawMinimap();
    requestAnimationFrame(frame);
    return;
  }
  if (scene === 'room' || scene === 'shelter') {
    if (scene === 'room') drawControlRoom(time);
    else drawShelter(time);
    drawMinimap();
    requestAnimationFrame(frame);
    return;
  }
  let dx = 0, dy = 0;
  if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
  if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
  if (!astronaut.suited || supplies.activity) { dx = 0; dy = 0; }
  astronaut.moving = dx !== 0 || dy !== 0;
  if (astronaut.moving) {
    const length = Math.hypot(dx, dy); dx /= length; dy /= length;
    const projectedHorizontal = .72 * (dx - dy);
    if (Math.abs(projectedHorizontal) > .01) astronaut.facingLeft = projectedHorizontal < 0;
    const lowBattery = supplies.suitEnergy < 20;
    const tired = supplies.stamina < 20;
    const movementSpeed = lowBattery || tired ? 78 : supplies.suitEnergy < 40 || supplies.stamina < 40 ? 150 : 220;
    astronaut.x = Math.max(90, Math.min(worldSize - 90, astronaut.x + dx * movementSpeed * dt));
    astronaut.y = Math.max(90, Math.min(worldSize - 90, astronaut.y + dy * movementSpeed * dt));
  }
  ctx.clearRect(0, 0, width, height);
  drawTerrain(time); drawStormEffects(time); drawAstronaut(time); drawMinimap();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLElement && event.target.closest('button, a')) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (!gameStarted) {
    if (!document.querySelector('#title-screen').hidden && (key === 'Enter' || key === ' ')) document.querySelector('#start-game').click();
    else if (!openingSequence.hidden && key === 'Escape') beginMission();
    return;
  }
  if (key === 'Escape' && scene === 'room') {
    const panel = document.querySelector('#console-panel');
    if (!panel.hidden) panel.hidden = true;
    else if (supplies.activity) setResourceNotice('JOB IN PROGRESS');
    else if (!astronaut.suited) setResourceNotice('SUIT UP FIRST');
    else {
      scene = 'lunar';
      astronaut.x = controlRoomDoor.x + 120;
      astronaut.y = controlRoomDoor.y + 20;
      updateControlHints();
    }
    return;
  }
  if (key === 'Escape' && scene === 'shelter') {
    scene = 'lunar';
    astronaut.x = 1515;
    astronaut.y = 1530;
    updateControlHints();
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault();
  if (key === 'f' && !event.repeat) {
    prepareSuit();
    updateSuppliesHud();
    return;
  }
  if (key === 'c' && !event.repeat) {
    eatMeal();
    return;
  }
  if (key === 'g' && !event.repeat) {
    toggleGreenhouse();
    return;
  }
  if (key === 'e' && !event.repeat) {
    const panel = document.querySelector('#console-panel');
    if (scene === 'lunar') {
      const station = getNearbyStation();
      if (station?.id === 'control') { scene = 'room'; astronaut.moving = false; updateControlHints(); }
      else if (station?.id === 'greenhouse') harvestGreenhouse();
      else if (station?.id === 'lab') interactWithLab();
      else if (station?.id === 'shelter') interactWithShelter();
      else if (station?.type === 'sample') beginSampleScan(sampleSites.findIndex(site => site.id === station.id));
    } else if (scene === 'room' && panel.hidden) {
      panel.hidden = false;
    } else if (scene === 'room' && !panel.hidden) {
      panel.hidden = true;
    } else if (scene === 'shelter') {
      scene = 'lunar';
      astronaut.x = 1515;
      astronaut.y = 1530;
      updateControlHints();
    }
  }
  keys.add(key);
});
window.addEventListener('keyup', event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', resize);
resize(); requestAnimationFrame(frame);

let introTimeout;
const openingSequence = document.querySelector('#opening-sequence');
function beginMission() {
  if (gameStarted) return;
  clearTimeout(introTimeout);
  openingSequence.hidden = true;
  missionEnded = false;
  document.querySelector('#mission-over').hidden = true;
  gameStarted = true;
  scene = 'room';
  astronaut.x = controlRoomDoor.x;
  astronaut.y = controlRoomDoor.y;
  astronaut.suited = false;
  updateControlHints();
  document.querySelector('.world').classList.add('playing');
  canvas.focus({ preventScroll: true });
  updateMissionClock();
  updateSuppliesHud();
}

document.querySelector('#start-game').addEventListener('click', () => {
  document.querySelector('#title-screen').hidden = true;
  openingSequence.hidden = false;
  requestAnimationFrame(() => openingSequence.classList.add('is-playing'));
  introTimeout = setTimeout(beginMission, 5900);
});

document.querySelector('#restart-game').addEventListener('click', () => window.location.reload());
document.querySelector('#skip-intro').addEventListener('click', beginMission);
openingSequence.addEventListener('animationend', event => {
  if (event.target === openingSequence) beginMission();
});

document.querySelector('#close-console').addEventListener('click', () => { document.querySelector('#console-panel').hidden = true; });
document.querySelector('#garden-toggle').addEventListener('click', () => toggleGreenhouse(true));
document.querySelector('#reinforce-shelter').addEventListener('click', beginShieldReinforcement);
document.querySelector('#retry-sun-data').addEventListener('click', loadScenarioSEP);
loadScenarioSEP();
