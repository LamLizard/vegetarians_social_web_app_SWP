// =====================================================================
//  ÂM LỊCH VIỆT NAM – đổi ngày dương → ngày âm (múi giờ +7).
//  Thuật toán thiên văn công khai của Hồ Ngọc Đức (dùng rộng rãi ở VN).
//  Dùng để nhắc "ngày chay": mùng 1 và rằm (15) mỗi tháng âm.
// =====================================================================

const PI = Math.PI;
const TZ = 7;
const INT = Math.floor;

function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

function newMoonDay(k) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  c1 = c1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  c1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  c1 = c1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  c1 = c1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  c1 = c1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  c1 = c1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return INT(jd1 + c1 - deltat + 0.5 + TZ / 24);
}

function sunLongitude(jdn) {
  const T = (jdn - 2451545.5 - TZ / 24) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * INT(L / (PI * 2));
  return INT((L / PI) * 6);
}

function lunarMonth11(yy) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  const nm = newMoonDay(k);
  return sunLongitude(nm) >= 9 ? newMoonDay(k - 1) : nm;
}

function leapMonthOffset(a11) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last;
  let i = 1;
  let arc = sunLongitude(newMoonDay(k + i));
  do {
    last = arc;
    i += 1;
    arc = sunLongitude(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Ngày dương → ngày âm. @returns {{day:number, month:number, year:number, leap:boolean}} */
export function toLunar(date = new Date()) {
  const dd = date.getDate();
  const mm = date.getMonth() + 1;
  const yy = date.getFullYear();
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = newMoonDay(k);
  let a11 = lunarMonth11(yy);
  let b11 = a11;
  let year;
  if (a11 >= monthStart) {
    year = yy;
    a11 = lunarMonth11(yy - 1);
  } else {
    year = yy + 1;
    b11 = lunarMonth11(yy + 1);
  }
  const day = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let month = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11);
    if (diff >= leapDiff) {
      month = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) year -= 1;
  return { day, month, year, leap };
}

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Ngày âm đó có phải ngày chay (mùng 1 / rằm) không */
export const isVegDay = (lunar) => lunar.day === 1 || lunar.day === 15;

// Các ngày chay lớn trong năm – người Việt hay ăn chay cả nhà
const FESTIVALS = {
  '1/1': 'Tết Nguyên đán',
  '15/1': 'Rằm tháng Giêng',
  '15/4': 'Lễ Phật đản',
  '15/7': 'Rằm tháng Bảy · Vu Lan',
  '15/8': 'Tết Trung thu',
};
export const festivalOf = (lunar) => (lunar.leap ? null : FESTIVALS[`${lunar.day}/${lunar.month}`] ?? null);
export const vegDayName = (lunar) => festivalOf(lunar) ?? (lunar.day === 1 ? `Mùng 1 tháng ${lunar.month}` : `Rằm tháng ${lunar.month}`);

/**
 * Ngày chay gần nhất kể từ hôm nay (tính cả hôm nay).
 * @returns {{date:Date, lunar, inDays:number, name:string}}
 */
export function nextVegDay(from = new Date()) {
  for (let i = 0; i < 32; i += 1) {
    const date = addDays(from, i);
    const lunar = toLunar(date);
    if (isVegDay(lunar)) return { date, lunar, inDays: i, name: vegDayName(lunar) };
  }
  return null;
}

/** "14 tháng 8" / "mùng 3 tháng Giêng" */
export function lunarLabel({ day, month, leap }) {
  const monthName = month === 1 ? 'Giêng' : month === 12 ? 'Chạp' : String(month);
  const dayName = day <= 10 ? `mùng ${day}` : String(day);
  return `${dayName} tháng ${monthName}${leap ? ' (nhuận)' : ''}`;
}

/** Tỉ lệ pha trăng 0 → 1 (0 = trăng non, 0.5 = trăng tròn) theo ngày âm */
export const moonPhase = (lunarDay) => ((lunarDay - 1) % 30) / 29.53;
