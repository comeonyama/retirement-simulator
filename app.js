(() => {
  "use strict";

  const STORAGE_KEY = "retire_sim_v1";
  const NET_PENSION_RATE = 0.815;
  let mode = "nk";
  let chart = null;
  let updateTimer = null;

  const commonFields = [
    {key:"inv",label:"運用資産",unit:"万円",def:300,min:0,max:3000,step:10,dec:0,hintNk:"NISA・iDeCo等",hintKo:"企業型DC（投資信託運用分）・NISA・iDeCo等"},
    {key:"cash",label:"現金等",unit:"万円",def:300,min:0,max:3000,step:10,dec:0,hintNk:"預金・小規模企業共済等",hintKo:"預金・退職金等・企業型DC元本確保型（定期預金・保険）"},
    {key:"age",label:"現在年齢",unit:"歳",def:40,min:30,max:64,step:1,dec:0},
    {key:"ret",label:"リタイア年齢",unit:"歳",def:60,min:60,max:75,step:1,dec:0},
    {key:"life",label:"想定寿命",unit:"歳",def:90,min:80,max:100,step:1,dec:0},
    {key:"sav",label:"年間積立額",unit:"万円",def:120,min:0,max:600,step:10,dec:0,hint:"60歳まで毎年積立"},
    {key:"ra",label:"積立期の運用利率",unit:"%",def:5,min:1,max:10,step:.1,dec:1,hint:"初期値5%の根拠：MSCI ACWI（全世界株式）の長期実績は約8%（USD建て）。円安効果・コストを差し引いた保守的な想定値"},
    {key:"rw",label:"取り崩し期の利率",unit:"%",def:5,min:0,max:8,step:.1,dec:1,hint:"積立期と同率を初期値として設定。取り崩し期もインデックスファンドでの運用継続を想定"},
    {key:"pw",label:"リタイア後の想定収入（月額）",unit:"万円/月",def:20,min:0,max:100,step:.5,dec:1,hint:"フリーランス・パート等"},
    {key:"pwy",label:"リタイア後の就労想定期間",unit:"年",def:5,min:0,max:10,step:1,dec:0,hint:"リタイア後から数えた年数"},
    {key:"lv",label:"月々の生活費",unit:"万円",def:28,min:15,max:60,step:.5,dec:1},
    {key:"cf",label:"住居費（管理費・家賃等）",unit:"万円/月",def:3.5,min:0,max:20,step:.5,dec:1,hint:"持ち家：管理費／賃貸：家賃"},
    {key:"pt",label:"固定資産税（月割）",unit:"万円",def:1,min:0,max:5,step:.1,dec:1,hint:"賃貸の場合は0"},
    {key:"ei",label:"後期高齢者医療保険",unit:"万円/月",def:1,min:0,max:5,step:.1,dec:1}
  ];
  const pensionFields = [
    {key:"pen",label:"年金額・額面",unit:"万円/月",def:6.8,min:0,max:30,step:.5,dec:1,hint:"ねんきんネットの試算値を入力"},
    {key:"ps",label:"年金受給開始年齢",unit:"歳",def:65,min:60,max:75,step:1,dec:0,hint:"繰上げ60〜64歳 / 繰下げ66〜75歳"},
    {key:"pen_self",label:"本人年金・額面",unit:"万円/月",def:15,min:0,max:40,step:.5,dec:1,hint:"ねんきんネットの試算値（本人）"},
    {key:"pen_sp",label:"配偶者年金・額面",unit:"万円/月",def:6.8,min:0,max:30,step:.5,dec:1,hint:"単身の場合は0を入力 / 配偶者あり：国民年金満額は約6.8万円"},
    {key:"ps_ko",label:"年金受給開始年齢",unit:"歳",def:65,min:60,max:75,step:1,dec:0,hint:"繰上げ60〜64歳 / 繰下げ66〜75歳"}
  ];
  const fields = [...commonFields, ...pensionFields];
  const byId = id => document.getElementById(id);
  const displayValue = (field, value) => `${field.dec ? Number(value).toFixed(field.dec) : Math.round(value).toLocaleString("ja-JP")}${field.unit}`;
  const value = key => Number.parseFloat(byId(`rs_t_${key}`)?.value) || 0;
  const formatMoney = amount => `${Math.round(amount).toLocaleString("ja-JP")}万円`;
  const signedMoney = amount => `${amount >= 0 ? "+" : ""}${formatMoney(amount)}`;

  function buildField(field) {
    const host = byId(`rs_f_${field.key}`);
    if (!host) return;
    const hint = field.hint || (mode === "ko" ? field.hintKo : field.hintNk) || "";
    host.innerHTML = `<div class="rs-fld-lbl"><span>${field.label}</span><span class="rs-cur" id="rs_lbl_${field.key}">${displayValue(field, field.def)}</span></div>
      <input type="range" id="rs_r_${field.key}" min="${field.min}" max="${field.max}" step="${field.step}" value="${field.def}" aria-label="${field.label}">
      <input type="number" id="rs_t_${field.key}" min="${field.min}" max="${field.max}" step="${field.step}" value="${field.dec ? field.def.toFixed(field.dec) : field.def}" aria-label="${field.label}（数値）">
      ${hint ? `<div class="rs-hint" id="rs_hint_${field.key}">${hint}</div>` : ""}`;
    const range = byId(`rs_r_${field.key}`);
    const number = byId(`rs_t_${field.key}`);
    const sync = (raw, source) => {
      if (raw === "") return;
      const next = Math.min(field.max, Math.max(field.min, Number(raw)));
      if (source !== range) range.value = next;
      if (source !== number) number.value = field.dec ? next.toFixed(field.dec) : next;
      byId(`rs_lbl_${field.key}`).textContent = displayValue(field, next);
      scheduleUpdate();
    };
    range.addEventListener("input", event => sync(event.target.value, range));
    number.addEventListener("input", event => sync(event.target.value, number));
  }

  function applyMode(nextMode, shouldRun = true) {
    mode = nextMode;
    byId("rs_btn_nk").classList.toggle("active", mode === "nk");
    byId("rs_btn_ko").classList.toggle("active", mode === "ko");
    byId("rs_pen_nk_row").hidden = mode !== "nk";
    byId("rs_pen_ko_row").hidden = mode !== "ko";
    byId("rs_modeDesc").textContent = mode === "nk" ? "フリーランス・自営業者向け" : "会社員向け（単身者は配偶者年金を0に設定してください）";
    ["inv", "cash"].forEach(key => {
      const field = commonFields.find(item => item.key === key);
      const hint = byId(`rs_hint_${key}`);
      if (hint) hint.textContent = mode === "ko" ? field.hintKo : field.hintNk;
    });
    if (shouldRun) { run(); save(); }
  }

  function params() {
    return {
      age:value("age"), retireAge:value("ret"), lifespan:value("life"),
      investAsset:value("inv"), cashAsset:value("cash"), annualSaving:value("sav"),
      rateAccum:value("ra") / 100, rateWithdraw:value("rw") / 100,
      pensionGross:mode === "nk" ? value("pen") : value("pen_self") + value("pen_sp"),
      pensionStart:mode === "nk" ? value("ps") : value("ps_ko"),
      partWork:value("pw"), partWorkYears:value("pwy"), livingCost:value("lv"),
      condoFee:value("cf"), propertyTax:value("pt"), elderInsurance:value("ei")
    };
  }

  function calculateRetirementAssets(p) {
    let invest = p.investAsset;
    const yearsTo60 = Math.max(0, 60 - p.age);
    const yearsAfter60 = Math.max(0, p.retireAge - 60);
    for (let year = 0; year < yearsTo60; year++) invest = invest * (1 + p.rateAccum) + p.annualSaving;
    for (let year = 0; year < yearsAfter60; year++) invest *= 1 + p.rateAccum;
    return {invest, cash:p.cashAsset, total:invest + p.cashAsset};
  }

  function timeline(p) {
    const labels = [];
    const assets = [];
    let invest = p.investAsset;
    let cash = p.cashAsset;
    let depletionAge = null;
    const expenses = p.livingCost + p.condoFee + p.propertyTax + p.elderInsurance;
    const pensionNet = p.pensionGross * NET_PENSION_RATE;
    const monthlyRate = p.rateWithdraw / 12;
    for (let age = p.age; age <= p.lifespan; age++) {
      labels.push(`${age}歳`);
      assets.push(Math.max(0, Math.round(invest + cash)));
      if (age < 60) invest = invest * (1 + p.rateAccum) + p.annualSaving;
      else if (age < p.retireAge) invest *= 1 + p.rateAccum;
      else {
        const pension = age >= p.pensionStart ? pensionNet : 0;
        let monthlyDraw = Math.max(0, expenses - pension);
        if (age < p.retireAge + p.partWorkYears) monthlyDraw = Math.max(0, monthlyDraw - p.partWork);
        for (let month = 0; month < 12; month++) {
          invest = invest * (1 + monthlyRate) - monthlyDraw;
          if (invest < 0) { cash += invest; invest = 0; }
        }
        if (depletionAge === null && invest + cash <= 0) depletionAge = age + 1;
      }
    }
    return {labels, assets, depletionAge};
  }

  function drawChart(p, data) {
    if (chart) chart.destroy();
    chart = new Chart(byId("rs_mc"), {
      type:"line",
      data:{labels:data.labels,datasets:[{label:"総資産推移",data:data.assets,borderColor:"#1d9e75",backgroundColor:"rgba(29,158,117,.08)",fill:true,tension:.35,pointRadius:0,borderWidth:2.5}]},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:150},plugins:{legend:{labels:{color:"#888",boxWidth:20}},tooltip:{callbacks:{label:item=>`総資産: ${Math.round(item.raw).toLocaleString("ja-JP")}万円`}}},scales:{x:{ticks:{maxTicksLimit:14,maxRotation:45},grid:{display:false}},y:{min:0,ticks:{callback:number=>`${Math.round(number / 100) * 100}万`},grid:{color:"rgba(0,0,0,.05)"}}}}
    });
  }

  function run() {
    const p = params();
    const atRetirement = calculateRetirementAssets(p);
    const data = timeline(p);
    const finalAssets = data.assets.at(-1);
    const depleted = data.depletionAge !== null && data.depletionAge <= p.lifespan;
    const okay = finalAssets > 0;
    const verdict = byId("rs_verdict");
    verdict.className = `rs-verdict ${okay ? "ok" : "ng"}`;
    if (okay) {
      byId("rs_vt").textContent = `▲ ${formatMoney(finalAssets)} の余裕があります`;
      byId("rs_vs").textContent = `${p.lifespan}歳時点で ${formatMoney(finalAssets)} の資産が残る見込みです。`;
    } else if (depleted) {
      byId("rs_vt").textContent = `⚠ ${data.depletionAge}歳で資金が枯渇します`;
      byId("rs_vs").textContent = `想定寿命（${p.lifespan}歳）より${p.lifespan - data.depletionAge}年早く資金がゼロになります。`;
    } else {
      byId("rs_vt").textContent = "資産が不足する見込みです";
      byId("rs_vs").textContent = "積立額の増額か支出の見直しを検討してください。";
    }
    byId("rs_kpi0lbl").textContent = `${p.retireAge}歳時点の総資産`;
    byId("rs_k0").textContent = formatMoney(atRetirement.total);
    byId("rs_k0s").textContent = `運用資産 ${formatMoney(atRetirement.invest)} + 現金 ${formatMoney(atRetirement.cash)}`;
    byId("rs_kpi4lbl").textContent = `${p.lifespan}歳時点での過不足額`;
    byId("rs_k4").textContent = depleted ? `${data.depletionAge}歳で枯渇` : signedMoney(finalAssets);
    byId("rs_k4").className = `rs-val ${okay ? "ok" : "ng"}`;
    byId("rs_k4s").textContent = depleted ? `${data.depletionAge}歳時点で資金がゼロになります` : "取り崩し終了時点の残資産";
    const expenses = p.livingCost + p.condoFee + p.propertyTax + p.elderInsurance;
    byId("rs_b0").textContent = `${(p.pensionGross * NET_PENSION_RATE).toFixed(1)}万円`;
    byId("rs_b0d").textContent = mode === "ko" ? `（本人 ${value("pen_self").toFixed(1)}万円 ＋ 配偶者 ${value("pen_sp").toFixed(1)}万円）× 81.5%` : "額面 × 81.5%（所得税・住民税・社会保険料控除後）";
    byId("rs_b1").textContent = `${expenses.toFixed(1)}万円`;
    byId("rs_b1d").textContent = `生活費 ${p.livingCost.toFixed(1)}万円 ＋ 住居費 ${p.condoFee.toFixed(1)}万円 ＋ 固定資産税 ${p.propertyTax.toFixed(1)}万円 ＋ 後期高齢者医療 ${p.elderInsurance.toFixed(1)}万円`;
    const waitMonths = Math.max(0, p.pensionStart - p.retireAge) * 12;
    byId("rs_b2").textContent = waitMonths ? `${waitMonths}ヶ月` : "なし";
    byId("rs_b3").textContent = `${(p.lifespan - p.retireAge) * 12}ヶ月`;
    drawChart(p, data);
  }

  function scheduleUpdate() {
    byId("rs_spinner").classList.add("show");
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => { run(); save(); byId("rs_spinner").classList.remove("show"); }, 300);
  }

  function save() {
    try {
      const data = {mode};
      fields.forEach(field => data[field.key] = byId(`rs_t_${field.key}`)?.value);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!data) return;
      applyMode(data.mode === "ko" ? "ko" : "nk", false);
      fields.forEach(field => {
        if (data[field.key] === undefined || !byId(`rs_t_${field.key}`)) return;
        const next = Math.min(field.max, Math.max(field.min, Number(data[field.key])));
        byId(`rs_t_${field.key}`).value = field.dec ? next.toFixed(field.dec) : next;
        byId(`rs_r_${field.key}`).value = next;
        byId(`rs_lbl_${field.key}`).textContent = displayValue(field, next);
      });
    } catch (_) {}
  }

  function reset() {
    fields.forEach(field => {
      if (!byId(`rs_t_${field.key}`)) return;
      byId(`rs_t_${field.key}`).value = field.dec ? field.def.toFixed(field.dec) : field.def;
      byId(`rs_r_${field.key}`).value = field.def;
      byId(`rs_lbl_${field.key}`).textContent = displayValue(field, field.def);
    });
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    run();
  }

  fields.forEach(buildField);
  byId("rs_btn_nk").addEventListener("click", () => applyMode("nk"));
  byId("rs_btn_ko").addEventListener("click", () => applyMode("ko"));
  byId("rs_reset").addEventListener("click", reset);
  load();
  run();
})();
