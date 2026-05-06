/* ============================================================
   MAPLE MONEY: BUILD YOUR LIFE — script.js
   All game systems in one file. Each section is clearly
   labelled. Systems communicate only through gameState and
   well-defined function calls.
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   1. GAME STATE
   Single source of truth for all numeric values.
   ────────────────────────────────────────────────────────── */
const PLAYER_START_AGE = 18;
const GAME_END_MONTH   = 144;

function playerAge()  { return PLAYER_START_AGE + Math.floor((gameState.month - 1) / 12); }
function ageLabel()   {
  const age = playerAge();
  const mo  = ((gameState.month - 1) % 12) + 1;
  return mo === 1 ? ("Age " + age) : ("Age " + age + ", mo " + mo);
}

const gameState = {
  month:         1,
  cash:          1000,
  netWorth:      1000,
  savings:       0,
  tfsa:          0,
  rrsp:          0,
  fhsa:          0,
  emergencyFund: 0,
  hisa:          0,   // High Interest Savings Account balance
  totalExpenses: 0,
  totalIncome:   0,
  homeEquity:    0,
  homeValue:     0,
};

/* ──────────────────────────────────────────────────────────
   2. TOP-BAR DOM REFERENCES
   ────────────────────────────────────────────────────────── */
const displayMonth    = document.getElementById('display-month');
const displayCash     = document.getElementById('display-cash');
const displayNetworth = document.getElementById('display-networth');
const historyFeed     = document.getElementById('history-feed');
let btnNextMonth    = document.getElementById('btn-next-month');

/* ──────────────────────────────────────────────────────────
   3. HELPERS
   ────────────────────────────────────────────────────────── */

/** Format a number as Canadian currency e.g. $1,200 */
function formatCurrency(amount) {
  const abs = Math.abs(Math.round(amount));
  const str = '$' + abs.toLocaleString('en-CA');
  return amount < 0 ? '-' + str : str;
}

/** Briefly animate a value change with the .updated CSS class */
function animateStat(el) {
  if (!el) return;
  el.classList.remove('updated');
  void el.offsetWidth;
  el.classList.add('updated');
  setTimeout(() => el.classList.remove('updated'), 400);
}

/* ──────────────────────────────────────────────────────────
   4. UPDATE TOP-BAR DASHBOARD
   Net worth is CALCULATED from components every tick:
     netWorth = cash + savings + tfsa + rrsp - studentDebt
   This prevents the double-counting that happened when both
   cash and netWorth were incremented on income receipt.
   ────────────────────────────────────────────────────────── */
function recalcNetWorth() {
  const studentDebt = loanState ? Math.round(loanState.studentDebt || 0) : 0;
  const mortgageDebt = mortgageState ? Math.round(mortgageState.balance || 0) : 0;
  gameState.netWorth = Math.round(
    gameState.cash + gameState.savings + gameState.tfsa + gameState.rrsp + gameState.fhsa
    + gameState.emergencyFund + gameState.hisa + gameState.homeEquity - studentDebt - mortgageDebt
  );
}

function updateDashboard() {
  recalcNetWorth();
  displayMonth.textContent    = ageLabel();
  displayCash.textContent     = formatCurrency(gameState.cash);
  displayNetworth.textContent = formatCurrency(gameState.netWorth);
  animateStat(displayCash);
  animateStat(displayNetworth);
  // Refresh accounts scoreboard
  const el = (id) => document.getElementById(id);
  if (el('display-cash'))    el('display-cash').textContent    = formatCurrency(Math.round(gameState.cash));
  if (el('display-ef'))      el('display-ef').textContent      = formatCurrency(Math.round(gameState.emergencyFund));
  if (el('display-tfsa'))    el('display-tfsa').textContent    = formatCurrency(Math.round(gameState.tfsa));
  if (el('display-rrsp'))    el('display-rrsp').textContent    = formatCurrency(Math.round(gameState.rrsp));
  if (el('display-fhsa'))    el('display-fhsa').textContent    = formatCurrency(Math.round(gameState.fhsa));
  if (el('display-hisa'))    el('display-hisa').textContent    = formatCurrency(Math.round(gameState.hisa));
  if (el('display-networth')) el('display-networth').textContent = formatCurrency(gameState.netWorth);
  // Emergency fund progress bar
  updateEFProgressBar();
  // Income panel
  if (el('display-income'))  el('display-income').textContent  = formatCurrency(incomeState.lastIncome);
  // Housing panel
  if (mortgageState && mortgageState.active) {
    if (el('display-home-value'))   el('display-home-value').textContent   = formatCurrency(Math.round(gameState.homeValue));
    if (el('display-home-equity'))  el('display-home-equity').textContent  = formatCurrency(Math.round(gameState.homeEquity));
    if (el('display-mortgage-bal')) el('display-mortgage-bal').textContent = formatCurrency(Math.round(mortgageState.balance));
    if (el('display-mortgage-pmt')) el('display-mortgage-pmt').textContent = formatCurrency(Math.round(mortgageState.monthlyPayment));
    const housingPanel = el('housing-panel');
    if (housingPanel) housingPanel.classList.remove('hidden');
  }
}

/* ──────────────────────────────────────────────────────────
   5. HISTORY FEED
   Right-column brief log. One entry per month, prepended
   so newest is always at the top.
   ────────────────────────────────────────────────────────── */

/**
 * Add one compact entry to the history feed.
 * @param {object} entry  { month, income, lifeEvent, lifeEffect, cash, netWorth, taxNote }
 */
function addHistoryEntry(entry) {
  // Remove the "no history yet" placeholder on first entry
  const empty = historyFeed.querySelector('.history-empty');
  if (empty) empty.remove();

  const incomeSign = entry.income >= 0 ? '+' : '';
  const effectSign = entry.lifeEffect > 0 ? '+' : '';
  const effectClass = entry.lifeEffect > 0 ? 'pos' : entry.lifeEffect < 0 ? 'neg' : '';

  const div = document.createElement('div');
  div.className = 'history-entry';
  div.innerHTML = `
    <span class="history-entry__month">Month ${entry.month}</span>
    <div class="history-entry__rows">
      <div class="history-entry__row">
        <span class="history-entry__row-label">Income</span>
        <span class="history-entry__row-val history-entry__row-val--pos">${incomeSign}${formatCurrency(entry.income)}</span>
      </div>
      <div class="history-entry__row">
        <span class="history-entry__row-label">Cash</span>
        <span class="history-entry__row-val">${formatCurrency(entry.cash)}</span>
      </div>
      <div class="history-entry__row">
        <span class="history-entry__row-label">Net Worth</span>
        <span class="history-entry__row-val">${formatCurrency(entry.netWorth)}</span>
      </div>
    </div>
    ${entry.lifeEvent ? `<div class="history-entry__event history-entry__event--${effectClass}">${entry.lifeEvent} (${effectSign}${formatCurrency(entry.lifeEffect)})</div>` : ''}
    ${entry.taxNote   ? `<div class="history-entry__event">${entry.taxNote}</div>` : ''}
  `;

  // Prepend — newest at top
  historyFeed.insertBefore(div, historyFeed.firstChild);

  // Record chart point every month
  recordChartPoint();
}

/** Add a tax-year marker row to the history feed */
function addHistoryTaxMarker(yearNum, taxDue, isRefund) {
  const marker = document.createElement('div');
  marker.className = `history-tax-marker${isRefund ? ' history-tax-marker--refund' : ''}`;
  marker.innerHTML = `
    <span>🇨🇦 Year ${yearNum} Tax Filing</span>
    <span>${isRefund ? '+' : ''}${formatCurrency(isRefund ? Math.abs(taxDue) : -taxDue)}</span>
  `;
  historyFeed.insertBefore(marker, historyFeed.firstChild);
}

/* ──────────────────────────────────────────────────────────
   6. LIFE EVENTS
   24 random events: positive, negative, neutral.
   One fires per month; effect applied to cash + netWorth.
   ────────────────────────────────────────────────────────── */
const lifeEvents = [
  // Negative
  { title: 'Car Repair',          icon: '🔧', effect: -500, type: 'negative', ccEligible: true,  body: 'Your car breaks down on the way to work. The mechanic\'s bill hits hard — this is exactly why an emergency fund matters.' },
  { title: 'Rent Increase',       icon: '🏠', effect: -200, type: 'negative', ccEligible: false, body: 'Your landlord raises the rent. Fixed costs going up means your budget needs to adjust somewhere else.' },
  { title: 'Medical Bill',        icon: '🏥', effect: -350, type: 'negative', ccEligible: true,  body: 'An unexpected health expense arrives. Dental, optometry, prescriptions — provincial coverage does not cover everything. Many of these go straight on the credit card.' },
  { title: 'Phone Cracked',       icon: '📱', effect: -250, type: 'negative', ccEligible: true,  body: 'You drop your phone and the screen shatters. Repair or replace — either way it costs you.' },
  { title: 'Parking Ticket',      icon: '🎫', effect:  -80, type: 'negative', ccEligible: true,  body: 'You forgot to check the signs. A small but annoying dent in your cash.' },
  { title: 'Appliance Breakdown', icon: '🫙', effect: -400, type: 'negative', ccEligible: true,  body: 'The fridge stops working. Replacing household appliances is a hidden cost of independent living.' },
  { title: 'Vet Bill',            icon: '🐾', effect: -300, type: 'negative', ccEligible: true,  body: 'Your pet needs a checkup and some unexpected treatment. Pets are a joy — and a real budget line item.' },
  { title: 'Insurance Hike',      icon: '📋', effect: -150, type: 'negative', ccEligible: true,  body: 'Your insurance provider sends a renewal notice with a premium increase. Annual costs creep up every year.' },
  { title: 'Subscription Creep',  icon: '💳', effect: -120, type: 'negative', ccEligible: true,  body: 'You audit your subscriptions and realize you\'ve been paying for three streaming services you forgot about.' },
  { title: 'Wedding Travel',      icon: '✈️', effect: -600, type: 'negative', ccEligible: true,  body: 'A close friend gets married out of province. Travel, a gift, and new outfit — it all adds up fast.' },
  // Positive
  { title: 'Work Bonus',          icon: '🎉', effect: +1000, type: 'positive', body: 'Great performance this quarter earns you a bonus. A perfect opportunity to build your savings or pay down debt.' },
  { title: 'Side Hustle',         icon: '💼', effect: +300,  type: 'positive', body: 'You pick up some freelance work on the weekend. Extra income on the side accelerates every financial goal.' },
  { title: 'Tax Refund',          icon: '📄', effect: +800,  type: 'positive', body: 'The CRA processes your return and a refund lands in your account. Resist the urge to splurge — invest it.' },
  { title: 'Sold Old Stuff',      icon: '📦', effect: +200,  type: 'positive', body: 'You clear out clutter and list items on Facebook Marketplace. Decluttering pays — literally.' },
  { title: 'Birthday Cash',       icon: '🎂', effect: +150,  type: 'positive', body: 'Family sends you some birthday money. Even small windfalls are a chance to top up your savings.' },
  { title: 'Overtime Pay',        icon: '⏰', effect: +450,  type: 'positive', body: 'You pick up extra shifts this month. Time and a half adds up — and goes straight into your pocket.' },
  { title: 'Referral Bonus',      icon: '🤝', effect: +250,  type: 'positive', body: 'A friend signs up using your referral code and you earn a bonus. Your network is worth something.' },
  { title: 'Garage Sale',         icon: '🏷️', effect: +175,  type: 'positive', body: 'You host a garage sale and clear out the basement. One person\'s junk is another\'s treasure.' },
  { title: 'GST/HST Credit',      icon: '🍁', effect: +350,  type: 'positive', body: 'The quarterly GST/HST credit from the CRA arrives. A small but welcome boost from the government.' },
  { title: 'Pet Sitting Gig',     icon: '🐶', effect: +200,  type: 'positive', body: 'You look after a neighbour\'s dog for the weekend. Easy money for doing something you enjoy.' },
  // Neutral
  { title: 'Financial Check-In',  icon: '📊', effect: 0, type: 'neutral', body: 'You review your budget and accounts. Staying informed is the foundation of every solid financial plan.' },
  { title: 'Friend Asks for Money', icon: '🙏', effect: 0, type: 'neutral', body: 'A friend asks if they can borrow money. You politely decline — lending to friends rarely ends well financially.' },
  { title: 'Market News',         icon: '📰', effect: 0, type: 'neutral', body: 'Headlines warn of economic uncertainty. Your diversified investments mean you\'re not overexposed to any one risk.' },
  { title: 'Quiet Month',         icon: '☕', effect: 0, type: 'neutral', body: 'Nothing dramatic happens financially this month. Sometimes steady progress is the best kind of progress.' },
];

/**
 * Pick a random life event using a WEIGHTED pool.
 * Neutral events are 3× more likely than positive or negative
 * to avoid constant financial drama every single month.
 * Additionally there is only a 70% chance any event fires at all —
 * some months are just quiet.
 *
 * Weight table:
 *   neutral  → weight 3  (calm months are common)
 *   positive → weight 1  (windfalls are occasional)
 *   negative → weight 1  (setbacks are occasional)
 *
 * Returns { html, event } — event.effect = 0 for a no-fire month.
 */




/* ──────────────────────────────────────────────────────────
   8. ADVANCE TO THE NEXT MONTH — main game loop
   ────────────────────────────────────────────────────────── */
function advanceMonth() {
  gameState.month += 1;

  // ── END GAME CHECK ──
  if (gameState.month > GAME_END_MONTH) { showEndGameScreen(); return; }

  // ── 1. INCOME (part-time + OSAP) ──
  const justGraduated = checkIncomePhaseTransition();

  // Handle mid-layoff income (already set in resolveAnnualReview, just track months)
  if (jobOfferState.layoffActive && gameState.month % 12 !== 0) {
    jobOfferState.layoffMonthsLeft = Math.max(0, (jobOfferState.layoffMonthsLeft || 0) - 1);
    if (jobOfferState.layoffMonthsLeft <= 0) {
      incomeState.baseIncome = jobOfferState.layoffOriginalIncome;
      incomeState.varianceOverride = STABILITY_VARIANCE[jobOfferState.chosenJob.stability];
      jobOfferState.layoffActive = false;
      updateIncomeDisplay();
    }
  }

  const pay = calculateMonthlyIncome(incomeState.baseIncome);
  incomeState.lastIncome = pay;
  gameState.cash += pay;
  gameState.totalIncome += pay;
  updateIncomeDisplay();

  // OSAP disbursement (in-school only)
  let osapThisMonth = 0;
  if (loanState.inSchool && incomeState.osapMonthly > 0) {
    osapThisMonth = incomeState.osapMonthly;
    const loanAmt = Math.round(osapThisMonth * (1 - incomeState.osapGrantFrac));
    gameState.cash += osapThisMonth;
    if (loanAmt > 0) { loanState.studentDebt = (loanState.studentDebt || 0) + loanAmt; loanState.peakStudentDebt = Math.max(loanState.peakStudentDebt, loanState.studentDebt); }
    updateLoanDisplay();
  }

  // ── 2. MANDATORY EXPENSES ──
  const expenses = expenseState.monthlyTotal;
  gameState.cash -= expenses;
  gameState.totalExpenses += expenses;

  // ── 3. LIFE EVENT — handled by EF/CC system ──
  const lifeEvent = pickLifeEvent();
  const lifeEventResult = handleNegativeEvent(lifeEvent);

  // ── 4. LOAN PROCESSING ──
  processLoanForMonth();
  if (loanState.waitingForChoice) {
    // Tuition prompt shown — store context for resumeMonthAfterTuition
    advanceMonth._pendingContext = { pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated };
    updateDashboard();
    return;
  }

  finishMonth({ pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated });
}

function resumeMonthAfterTuition() {
  const ctx = advanceMonth._pendingContext || { pay: 0, osapThisMonth: 0, expenses: 0, lifeEvent: { effect: 0, title: '', icon: '', type: 'neutral' }, lifeEventResult: { covered: false }, justGraduated: false };
  advanceMonth._pendingContext = null;
  finishMonth(ctx);
}

function finishMonth({ pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated }) {
  lifeEventResult = lifeEventResult || { covered: false };
  // ── 5. INVESTMENT GROWTH ──
  const growth = applyMonthlyGrowth();

  // ── 5a. HISA INTEREST ──
  const hisaInterest = applyHISAInterest();

  // ── 5b. CREDIT CARD — interest + score + offer ──
  applyCCInterest();
  updateCreditScore();
  const ccReward = applyCCRewards();
  if (ccReward > 0) console.log('[CC] Cash-back reward: ' + formatCurrency(ccReward));

  // ── 6. TAX TRACKING ──
  trackMonthlyTaxables(pay, 0);
  let taxResult = null;
  if (gameState.month % 12 === 0) taxResult = processTaxYear();

  // ── 7. ANNUAL CAREER REVIEW ──
  if (gameState.month > 12 && gameState.month % 12 === 0) {
    if (processAnnualCareerProgression) processAnnualCareerProgression();
  }

  // ── 7b. MORTGAGE PROCESSING ──
  processMortgageMonth();
  if (typeof processCarLoanMonth === 'function') processCarLoanMonth();

  // ── 7c. HOUSING OFFER (fires once, ~month 24 of working life) ──
  maybeOfferHousing();

  updateDashboard();

  // ── 7d/7e. YEAR-END COMBINED SCREEN ──
  // When both career review AND year-end reflection fall on the same month,
  // compile them into one screen so neither gets skipped.
  const isYearEnd = gameState.month % 12 === 0 && gameState.month > 0;
  if (isYearEnd && jobOfferState.reviewPending && jobOfferState.accepted) {
    jobOfferState.reviewPending = false;
    const reviewResult = resolveAnnualReview();
    finishMonth._pendingCtx = { pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated, growth, hisaInterest, taxResult };
    showYearEndCombined(reviewResult, taxResult, gameState.month / 12);
    return;
  }

  // ── 7d. ANNUAL REVIEW INTERCEPT (non-year-end months) ──
  if (jobOfferState.reviewPending) {
    jobOfferState.reviewPending = false;
    const reviewResult = resolveAnnualReview();
    finishMonth._pendingCtx = { pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated, growth, hisaInterest, taxResult };
    showAnnualReviewCard(reviewResult);
    return;
  }

  // ── 7e. YEAR-END REFLECTION INTERCEPT ──
  if (isYearEnd && jobOfferState.accepted) {
    finishMonth._pendingCtx = { pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated, growth, hisaInterest, taxResult };
    showYearReflection(gameState.month / 12, taxResult);
    return;
  }

  // ── 7f. SCHOOL YEAR-END (for students who didn't hit tuition intercept this exact month) ──
  if (isYearEnd && loanState.inSchool && !loanState.waitingForChoice) {
    finishMonth._pendingCtx = { pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated, growth, hisaInterest, taxResult };
    showSchoolYearEnd(gameState.month / 12, 0, { pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated });
    return;
  }

  // ── 8. JOB OFFER INTERCEPT — show job screen instead of month card ──
  if (jobOfferState.pendingTransition && !jobOfferState.offered) {
    jobOfferState.pendingTransition = false;
    finishMonth._pendingCtx = { pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated, growth, taxResult };
    showJobOfferScreen();
    return;
  }

  // ── 8b. HOUSING OFFER INTERCEPT ──
  if (housingState_pendingTrigger) {
    housingState_pendingTrigger = false;
    finishMonth._pendingCtx = { pay, osapThisMonth, expenses, lifeEvent, lifeEventResult, justGraduated, growth, taxResult };
    showHousingOfferScreen(finishMonth._pendingCtx);
    return;
  }

  // ── 9. SHOW MONTH CARD ──
  const liveExpenses = expenseState.rent + expenseState.food + expenseState.transport
    + expenseState.phone + expenseState.other + expenseState.loanRepayment + expenseState.mortgagePayment;
  const totalEarned = pay + osapThisMonth;
  // Monthly surplus = what came in this month minus what went out this month.
  // Life event cash hits are included only if they weren't absorbed by EF/CC.
  const lifeEventCashHit = (lifeEventResult && !lifeEventResult.covered && !lifeEventResult.chargedToCC && lifeEvent.effect < 0)
    ? (lifeEventResult.partialCover ? -(Math.abs(lifeEvent.effect) - lifeEventResult.partialCover) : lifeEvent.effect)
    : 0;
  const monthlySurplus = Math.max(0, totalEarned - liveExpenses + lifeEventCashHit);
  const cashBalance    = Math.round(gameState.cash);
  showMonthCard({
    month: gameState.month, pay, osapThisMonth, totalEarned,
    expenses: liveExpenses, expenseBreakdown: { ...expenseState },
    lifeEvent, lifeEventResult, leftover: monthlySurplus, cashBalance,
    growth, hisaInterest, justGraduated, taxResult,
  });

  addHistoryEntry({
    month:      gameState.month,
    income:     totalEarned,
    cash:       gameState.cash,
    netWorth:   gameState.netWorth,
    lifeEvent:  lifeEvent.effect !== 0 ? `${lifeEvent.icon} ${lifeEvent.title}` : '',
    lifeEffect: lifeEvent.effect,
    taxNote:    taxResult ? taxResult.summary : '',
  });

  maybeTriggerTip();
  btnNextMonth.disabled = true;
}

function resumeMonthAfterInterstitial() {
  const ctx = finishMonth._pendingCtx || { pay: 0, osapThisMonth: 0, expenses: 0, lifeEvent: { effect: 0, title: '', icon: '', type: 'neutral' }, justGraduated: false, growth: {tfsa:0,rrsp:0,fhsa:0}, taxResult: null };
  finishMonth._pendingCtx = null;
  const liveExpenses2 = expenseState.rent + expenseState.food + expenseState.transport
    + expenseState.phone + expenseState.other + expenseState.loanRepayment + expenseState.mortgagePayment;
  const totalEarned = ctx.pay + ctx.osapThisMonth;
  const lr2 = ctx.lifeEventResult || { covered: false };
  const lifeEventCashHit2 = (!lr2.covered && !lr2.chargedToCC && ctx.lifeEvent.effect < 0)
    ? (lr2.partialCover ? -(Math.abs(ctx.lifeEvent.effect) - lr2.partialCover) : ctx.lifeEvent.effect)
    : 0;
  const monthlySurplus2 = Math.max(0, totalEarned - liveExpenses2 + lifeEventCashHit2);
  showMonthCard({
    month: gameState.month, pay: ctx.pay, osapThisMonth: ctx.osapThisMonth, totalEarned,
    expenses: liveExpenses2, expenseBreakdown: { ...expenseState },
    lifeEvent: ctx.lifeEvent, lifeEventResult: lr2,
    leftover: monthlySurplus2, cashBalance: Math.round(gameState.cash),
    growth: ctx.growth, hisaInterest: 0, justGraduated: ctx.justGraduated, taxResult: ctx.taxResult,
  });
  addHistoryEntry({
    month:      gameState.month,
    income:     totalEarned,
    cash:       gameState.cash,
    netWorth:   gameState.netWorth,
    lifeEvent:  ctx.lifeEvent.effect !== 0 ? `${ctx.lifeEvent.icon} ${ctx.lifeEvent.title}` : '',
    lifeEffect: ctx.lifeEvent.effect,
    taxNote:    ctx.taxResult ? ctx.taxResult.summary : '',
  });
  maybeTriggerTip();
  btnNextMonth.disabled = true;
}

/* ──────────────────────────────────────────────────────────
   ══════════════════════════════════════════════════════════
   CAREER SELECTION SYSTEM
   ══════════════════════════════════════════════════════════
   ────────────────────────────────────────────────────────── */

const careerData = {
  university: {
    label: 'University', icon: '🎓',
    specialisations: {
      medicine:    { label: 'Medicine (MD)',              icon: '🦺', years: '7-9 years',  tuition: '$80,000-$150,000', income: '$200,000-$350,000/yr', description: 'Undergrad + medical school + residency. The longest and most expensive path, but one of the highest-paid and most respected careers in Canada.' },
      uninursing:  { label: 'Nursing (BScN)',             icon: '🏥', years: '4 years',    tuition: '$28,000-$55,000',  income: '$65,000-$95,000/yr',   description: 'A four-year university nursing degree. Opens doors to hospital leadership, specialization, and higher-paying RN roles than a college diploma.' },
      healthsci:   { label: 'Health Sciences',            icon: '🔬', years: '4 years',    tuition: '$25,000-$50,000',  income: '$50,000-$90,000/yr',   description: 'Flexible degree covering biology, public health, and kinesiology. Feeds into grad school, healthcare management, or research roles.' },
      cs:          { label: 'Computer Science',           icon: '💻', years: '4 years',    tuition: '$25,000-$60,000',  income: '$65,000-$130,000/yr',  description: 'Strong job market, remote-work friendly, and growing fast. Tech skills open doors across every industry in Canada.' },
      engineering: { label: 'Engineering',                icon: '⚙️',  years: '4 years',    tuition: '$30,000-$65,000',  income: '$65,000-$120,000/yr',  description: 'Civil, mechanical, electrical, or software. High demand, strong starting salaries, and a clear licensing pathway to P.Eng.' },
      business:    { label: 'Business / Commerce',        icon: '📊', years: '4 years',    tuition: '$20,000-$55,000',  income: '$50,000-$110,000/yr',  description: 'Versatile degree covering finance, marketing, and management. Career path depends heavily on specialisation and networking.' },
      law:         { label: 'Law (JD)',                   icon: '⚖️',  years: '7 years',    tuition: '$60,000-$110,000', income: '$75,000-$200,000/yr',  description: 'Three years of law school after undergrad. Competitive and expensive, but lawyers are always in demand across corporate, criminal, and family law.' },
      education:   { label: 'Education (B.Ed)',           icon: '🍎', years: '5 years',    tuition: '$30,000-$60,000',  income: '$45,000-$95,000/yr',   description: 'Undergrad + one-year teacher college. Leads to a unionized, pensioned teaching career with summers off and strong job security.' },
      arts:        { label: 'Arts / Humanities',          icon: '🎨', years: '4 years',    tuition: '$20,000-$45,000',  income: '$35,000-$70,000/yr',   description: 'Develops critical thinking, writing, and communication. Income varies widely -- many pursue graduate school or complementary skills.' },
      socialwork:  { label: 'Social Work (BSW)',          icon: '🤝', years: '4 years',    tuition: '$22,000-$45,000',  income: '$48,000-$75,000/yr',   description: 'A degree built on helping people navigate complex systems. High demand in hospitals, schools, and government agencies across Canada.' },
    },
  },
  college: {
    label: 'College', icon: '🏫',
    specialisations: {
      colnursing:  { label: 'Nursing (RPN/RN Diploma)',   icon: '🦺', years: '2-3 years',  tuition: '$8,000-$20,000',   income: '$55,000-$85,000/yr',   description: 'A direct path to registered nursing. High demand across hospitals, long-term care, and community health. Bridging to BScN is always an option.' },
      paramedic:   { label: 'Paramedic / EMS',            icon: '🚑', years: '2 years',    tuition: '$7,000-$16,000',   income: '$55,000-$85,000/yr',   description: 'High-intensity, high-reward frontline healthcare. Provincial licensure required. Strong job stability and union protection in most provinces.' },
      it:          { label: 'IT / Programming',           icon: '🖥️',  years: '2-3 years',  tuition: '$7,000-$18,000',   income: '$50,000-$95,000/yr',   description: 'Shorter path to a tech career. Diplomas pair well with certifications. Many graduates compete directly with university peers.' },
      accounting:  { label: 'Accounting / Finance',       icon: '🧾', years: '2-3 years',  tuition: '$7,000-$16,000',   income: '$45,000-$80,000/yr',   description: 'Bookkeeping, payroll, and financial reporting. A practical business credential with clear demand across every industry.' },
      design:      { label: 'Design / Media',             icon: '🖌️',  years: '2-3 years',  tuition: '$7,000-$16,000',   income: '$38,000-$70,000/yr',   description: 'Creative programs in graphic design, animation, and digital media. Portfolio quality matters as much as the credential.' },
      culinary:    { label: 'Culinary Arts / Hospitality',icon: '🍳', years: '2 years',    tuition: '$6,000-$14,000',   income: '$35,000-$65,000/yr',   description: 'Hands-on training in professional kitchens or hospitality management. Tips and event work can supplement base salary significantly.' },
      police:      { label: 'Police Foundations',         icon: '🚔', years: '2 years',    tuition: '$6,000-$14,000',   income: '$60,000-$95,000/yr',   description: 'Prepares you for a career in policing or public safety. Competitive entry to services, but solid starting salaries and benefits.' },
      ece:         { label: 'Early Childhood Education',  icon: '🧒', years: '2 years',    tuition: '$5,000-$12,000',   income: '$35,000-$55,000/yr',   description: 'Work with young children in daycares, preschools, and kindergartens. Growing demand as subsidized childcare expands across Canada.' },
    },
  },
  trades: {
    label: 'Trades', icon: '🔧',
    specialisations: {
      electrician: { label: 'Electrician',                icon: '⚡', years: '4-5 years (apprenticeship)', tuition: '$3,000-$10,000', income: '$60,000-$100,000/yr', description: 'One of the most in-demand trades in Canada. Earn while you learn through an apprenticeship, then enjoy strong long-term wages.' },
      plumber:     { label: 'Plumber',                    icon: '🪠', years: '4-5 years (apprenticeship)', tuition: '$3,000-$9,000',  income: '$60,000-$105,000/yr', description: 'Plumbers are always in demand. Strong wages, low automation risk, and the opportunity to run your own business.' },
      carpenter:   { label: 'Carpenter',                  icon: '🪚', years: '4 years (apprenticeship)',   tuition: '$2,000-$8,000',  income: '$48,000-$85,000/yr',  description: 'Skilled work in residential and commercial construction. Entrepreneurial carpenters can build their own contracting business.' },
      mechanic:    { label: 'Automotive Mechanic',         icon: '🔩', years: '3-4 years (apprenticeship)', tuition: '$3,000-$8,000',  income: '$45,000-$80,000/yr',  description: 'Automotive and heavy equipment mechanics are vital to the economy. Specialising in EVs or commercial vehicles boosts earning potential.' },
      welder:      { label: 'Welder',                     icon: '🔥', years: '2-3 years (apprenticeship)', tuition: '$2,000-$7,000',  income: '$48,000-$90,000/yr',  description: 'Highly portable skill used in construction, manufacturing, and pipelines. Certified welders can work remotely and command strong hourly rates.' },
      hvac:        { label: 'HVAC Technician',             icon: '❄️',  years: '2-3 years (apprenticeship)', tuition: '$2,500-$7,000',  income: '$50,000-$90,000/yr',  description: 'Heating, ventilation, and air conditioning. Year-round demand, emergency call premiums, and strong growth as buildings modernize.' },
    },
  },
  workforce: {
    label: 'Workforce', icon: '💼',
    specialisations: {
      retail:    { label: 'Retail',                       icon: '🛍️', years: 'No training required', tuition: '$0',        income: '$30,000-$45,000/yr', description: 'Start earning immediately. Entry-level retail builds customer service skills. Advancement to management is possible with experience.' },
      service:   { label: 'Food and Hospitality',         icon: '🍽️', years: 'No training required', tuition: '$0',        income: '$28,000-$50,000/yr', description: 'Restaurants, hospitality, and tourism. Tips can boost take-home pay. A great starting point while exploring other options.' },
      office:    { label: 'Office Administration',        icon: '🏢', years: 'Minimal (on the job)', tuition: '$0-$2,000',  income: '$38,000-$58,000/yr', description: 'Administrative and clerical roles offer stability and a foot in the door at larger organisations. Benefits often included.' },
      warehouse: { label: 'Warehouse and Logistics',      icon: '📦', years: 'No training required', tuition: '$0',        income: '$35,000-$55,000/yr', description: 'Physically demanding but steadily available. Logistics and distribution roles can lead to supervisor or coordinator positions.' },
    },
  },
};

let playerCareerPath = { tier1: null, tier2: null, data: null };

const careerScreen  = document.getElementById('career-screen');
// Career screen is hidden until instructions are dismissed
careerScreen.classList.add('hidden');
const mainGame      = document.getElementById('main-game');
const tier1Grid     = document.getElementById('tier1-grid');
const tier2Wrap     = document.getElementById('tier2-wrap');
const tier2Prompt   = document.getElementById('tier2-prompt');
const tier2Grid     = document.getElementById('tier2-grid');
const careerSummary = document.getElementById('career-summary');
const btnStartLife  = document.getElementById('btn-start-life');
const summaryTitle  = document.getElementById('summary-title');
const summaryYears  = document.getElementById('summary-years');
const summaryTuition= document.getElementById('summary-tuition');
const summaryIncomeEl = document.getElementById('summary-income');
const summaryDesc   = document.getElementById('summary-description');

function buildTier1Buttons() {
  tier1Grid.innerHTML = '';
  Object.entries(careerData).forEach(([key, path]) => {
    const btn = document.createElement('button');
    btn.className = 'career-btn';
    btn.innerHTML = `<span class="career-btn__icon">${path.icon}</span><span class="career-btn__label">${path.label}</span>`;
    btn.addEventListener('click', () => handleTier1Select(key, btn));
    tier1Grid.appendChild(btn);
  });
}

function handleTier1Select(key, btn) {
  playerCareerPath.tier1 = key;
  playerCareerPath.tier2 = null;
  playerCareerPath.data  = null;
  tier1Grid.querySelectorAll('.career-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  careerSummary.classList.add('hidden');
  buildTier2Buttons(key);
  tier2Prompt.textContent = `Choose a ${careerData[key].label} specialisation:`;
  tier2Wrap.classList.remove('hidden');
}

function buildTier2Buttons(tier1Key) {
  tier2Grid.innerHTML = '';
  Object.entries(careerData[tier1Key].specialisations).forEach(([key, spec]) => {
    const btn = document.createElement('button');
    btn.className = 'career-btn';
    btn.innerHTML = `
      <span class="career-btn__badge">${careerData[tier1Key].label}</span>
      <span class="career-btn__icon">${spec.icon}</span>
      <span class="career-btn__label">${spec.label}</span>`;
    btn.addEventListener('click', () => handleTier2Select(key, btn));
    tier2Grid.appendChild(btn);
  });
}

function handleTier2Select(key, btn) {
  const spec = careerData[playerCareerPath.tier1].specialisations[key];
  playerCareerPath.tier2 = key;
  playerCareerPath.data  = spec;
  tier2Grid.querySelectorAll('.career-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  summaryTitle.textContent   = `${spec.icon}  ${spec.label}`;
  summaryYears.textContent   = spec.years;
  summaryTuition.textContent = spec.tuition;
  summaryIncomeEl.textContent= spec.income;
  summaryDesc.textContent    = spec.description;
  careerSummary.classList.remove('hidden');
}

function startLife() {
  document.getElementById('setup-screen').classList.add('hidden');
  mainGame.classList.remove('hidden');
  const badge = document.getElementById('career-badge-icon');
  const name  = document.getElementById('career-badge-name');
  if (badge) badge.textContent = playerCareerPath.data.icon;
  if (name)  name.textContent  = playerCareerPath.data.label;
  applySetupChoices();   // override expenses / income / cash from wizard
  initGame();
  if (typeof initSpeedControl === 'function') initSpeedControl();
  showBudgetChallenge();  // ask student to set savings goal before month 1
}

document.getElementById('btn-start-life').addEventListener('click', startLife);

/* ──────────────────────────────────────────────────────────
   ══════════════════════════════════════════════════════════
   SETUP WIZARD — Life Stage Questionnaire
   3 steps after career selection:
     Step 1: Living Situation
     Step 2: Part-Time Job  (school paths only; skipped for trades/workforce)
     Step 3: Starting Savings
   ══════════════════════════════════════════════════════════
   ────────────────────────────────────────────────────────── */

/* ── SETUP DATA
   Each step has options. Each option defines:
     id          — used to store choice in playerSetup
     icon, label, desc — displayed in the card
     badge       — optional "Recommended" label
     impacts     — small tags summarising financial effect
     effect      — object applied by applySetupChoices()

   effect fields (all optional, applied as overrides):
     rentMultiplier  — multiply base rent by this (0 = free)
     rentFlat        — set rent to a flat amount instead
     foodMultiplier  — multiply base food cost
     transportFlat   — set transport to flat amount
     inSchoolIncome  — override the in-school income (part-time step)
     startingCash    — override gameState.cash on start
     osapAdvance     — one-time cash injection (OSAP move-in bursary)
──────────────────────────────────────────────────────────── */
const setupSteps = [

  /* ── STEP 1: LIVING SITUATION ── */
  {
    id:      'living',
    heading: 'Where will you live?',
    intro:   'Your home situation is your biggest monthly cost. Choose honestly — it shapes everything.',
    options: [
      {
        id:    'home',
        icon:  '🏠',
        label: 'At Home with Parents',
        desc:  'Rent-free. You contribute a bit toward groceries and help around the house.',
        badge: null,
        impacts: [
          { label: 'Rent: $0', type: 'save' },
          { label: 'Food: ~$200/mo', type: 'cost' },
          { label: 'No move-in cost', type: 'save' },
        ],
        effect: { rentFlat: 0, foodMultiplier: 0.45, transportFlat: null, osapAdvance: 0 },
      },
      {
        id:    'residence',
        icon:  '🎓',
        label: 'Campus Residence / Dorm',
        desc:  'All-inclusive student housing. Costs more but everything is covered. Common for first-year university.',
        badge: 'Uni/College',
        impacts: [
          { label: 'Rent: ~$1,000/mo', type: 'cost' },
          { label: 'Food included', type: 'neutral' },
          { label: 'OSAP move-in help', type: 'income' },
        ],
        effect: { rentFlat: 1000, foodMultiplier: 0.3, transportFlat: 50, osapAdvance: 1500 },
      },
      {
        id:    'roommates',
        icon:  '👥',
        label: 'Shared Housing / Roommates',
        desc:  'Split rent with 1–2 others. More independence than home, more affordable than solo renting.',
        badge: 'Popular',
        impacts: [
          { label: 'Rent: ~40% off', type: 'save' },
          { label: 'Full food costs', type: 'cost' },
          { label: 'First & last deposit', type: 'cost' },
        ],
        effect: { rentMultiplier: 0.60, foodMultiplier: 1.0, transportFlat: null, osapAdvance: 0 },
      },
      {
        id:    'solo',
        icon:  '🏢',
        label: 'Renting Independently',
        desc:  'Your own place. Maximum freedom, maximum cost. Requires solid income from day one.',
        badge: null,
        impacts: [
          { label: 'Full rent', type: 'cost' },
          { label: 'Full expenses', type: 'cost' },
          { label: 'First & last required', type: 'cost' },
        ],
        effect: { rentMultiplier: 1.0, foodMultiplier: 1.0, transportFlat: null, osapAdvance: 0 },
      },
    ],
  },

  /* ── STEP 2: OSAP / STUDENT AID (school paths only) ── */
  {
    id:      'osap',
    heading: 'Will you apply for OSAP?',
    intro:   'Ontario Student Assistance Program (OSAP) provides grants and loans to eligible students. Grants are free money — loans must be repaid after graduation.',
    options: [
      {
        id:    'none',
        icon:  '🚫',
        label: 'No OSAP',
        desc:  "You don't qualify or choose not to apply. No extra aid — you're on your own budget.",
        badge: null,
        impacts: [
          { label: 'No monthly aid', type: 'cost' },
          { label: 'No added debt', type: 'save' },
        ],
        effect: { osapMonthly: 0, osapGrantFraction: 0 },
      },
      {
        id:    'grant',
        icon:  '🎁',
        label: 'Grants Only (~$400/mo)',
        desc:  'Low-income household? You may qualify for grants only — free money, no repayment required.',
        badge: null,
        impacts: [
          { label: '+$400/mo', type: 'income' },
          { label: 'No debt added', type: 'save' },
        ],
        effect: { osapMonthly: 400, osapGrantFraction: 1.0 },
      },
      {
        id:    'mixed',
        icon:  '⚖️',
        label: 'Grants + Loans (~$800/mo)',
        desc:  'Typical OSAP package — roughly 60% grant, 40% loan. Common for middle-income families.',
        badge: 'Most Common',
        impacts: [
          { label: '+$800/mo', type: 'income' },
          { label: '~$320/mo adds to debt', type: 'cost' },
        ],
        effect: { osapMonthly: 800, osapGrantFraction: 0.60 },
      },
      {
        id:    'loans',
        icon:  '🏦',
        label: 'Mostly Loans (~$1,100/mo)',
        desc:  'Maximum OSAP for students living away from home. Higher monthly income now, larger debt after.',
        badge: null,
        impacts: [
          { label: '+$1,100/mo', type: 'income' },
          { label: '~$880/mo adds to debt', type: 'cost' },
        ],
        effect: { osapMonthly: 1100, osapGrantFraction: 0.20 },
      },
    ],
  },

  /* ── STEP 3: PART-TIME JOB (school paths only) ── */
  {
    id:      'parttime',
    heading: 'Will you work part-time?',
    intro:   'Ontario minimum wage is $17.20/hr. Working during school adds real income — but costs time and energy.',
    options: [
      {
        id:    'none',
        icon:  '📚',
        label: 'No — Focus on Studies',
        desc:  'All your energy goes to school. No extra income, but your grades may be stronger.',
        badge: null,
        impacts: [
          { label: 'No extra income', type: 'cost' },
          { label: 'Full study focus', type: 'neutral' },
        ],
        effect: { inSchoolIncome: 0 },
      },
      {
        id:    'campus',
        icon:  '🏫',
        label: 'Campus / Office Work',
        desc:  '~12 hrs/week on campus. Flexible, close by. $17–19/hr × 12 hrs × 4.3 wks = ~$900/mo.',
        badge: null,
        impacts: [
          { label: '~12 hrs/wk @ $17–19/hr', type: 'neutral' },
          { label: '+$900/mo take-home', type: 'income' },
        ],
        effect: { inSchoolIncome: 900 },
      },
      {
        id:    'retail',
        icon:  '🛒',
        label: 'Retail / Service',
        desc:  '~15 hrs/week evenings & weekends. $17–18/hr × 15 hrs × 4.3 wks = ~$1,050/mo.',
        badge: 'Most Common',
        impacts: [
          { label: '~15 hrs/wk @ $17–18/hr', type: 'neutral' },
          { label: '+$1,050/mo take-home', type: 'income' },
        ],
        effect: { inSchoolIncome: 1050 },
      },
      {
        id:    'gig',
        icon:  '🚗',
        label: 'Delivery / Gig Work',
        desc:  'Set your own hours. ~$18–22/hr effective. Hustle more = earn more. ~$850/mo average.',
        badge: null,
        impacts: [
          { label: 'Flexible hrs @ $18–22/hr', type: 'neutral' },
          { label: '+$850/mo avg take-home', type: 'income' },
        ],
        effect: { inSchoolIncome: 850 },
      },
    ],
  },

  /* ── STEP T: TRANSPORT ── */
  {
    id:      'transport',
    heading: 'How will you get around?',
    intro:   'Transport is a fixed monthly cost. Cars offer freedom but add gas, insurance, and payments. Transit is cheaper but less flexible.',
    options: [
      {
        id:    'family-car',
        icon:  '🚗',
        label: 'Use the Family Car',
        desc:  "Your parents let you borrow their car. No payment, but you cover gas and your share of insurance.",
        badge: 'Most Affordable',
        impacts: [
          { label: 'No car payment', type: 'save' },
          { label: 'Gas + insurance: ~$250/mo', type: 'cost' },
        ],
        effect: { transportFlat: 250, carType: 'family' },
      },
      {
        id:    'used-car',
        icon:  '🚙',
        label: 'Buy a Used Car',
        desc:  'Finance a reliable used car. Monthly payment plus gas and insurance. More freedom, more cost.',
        badge: null,
        impacts: [
          { label: 'Payment ~$280/mo', type: 'cost' },
          { label: 'Gas + insurance ~$220/mo', type: 'cost' },
          { label: 'Total ~$500/mo', type: 'cost' },
        ],
        effect: { transportFlat: 500, carType: 'used', carPayment: 280, carGasInsurance: 220 },
      },
      {
        id:    'transit',
        icon:  '🚌',
        label: 'Public Transit',
        desc:  'Monthly bus or subway pass. Cheapest option — no insurance, no gas, no surprises.',
        badge: null,
        impacts: [
          { label: 'Transit pass: ~$130/mo', type: 'cost' },
          { label: 'No car costs', type: 'save' },
        ],
        effect: { transportFlat: 130, carType: 'transit' },
      },
      {
        id:    'bike',
        icon:  '🚲',
        label: 'Bike / Walk',
        desc:  'Zero monthly cost if you already own a bike. Works best in urban areas near your school or work.',
        badge: null,
        impacts: [
          { label: 'Minimal cost: ~$20/mo', type: 'save' },
          { label: 'Weather dependent', type: 'neutral' },
        ],
        effect: { transportFlat: 20, carType: 'bike' },
      },
    ],
  },

  /* ── STEP P: PHONE PLAN ── */
  {
    id:      'phone',
    heading: 'Which phone plan will you get?',
    intro:   'Your phone plan is a fixed monthly bill. Canada has some of the highest wireless costs in the world — choose carefully.',
    options: [
      {
        id:    'basic',
        icon:  '📵',
        label: 'Basic / Budget Plan',
        desc:  'Low data, talk & text only. Works for light users. Providers like Chatr, Public Mobile, Lucky.',
        badge: 'Cheapest',
        impacts: [
          { label: '~$30/mo', type: 'save' },
          { label: 'Limited data (2–5GB)', type: 'neutral' },
        ],
        effect: { phoneFlat: 30 },
      },
      {
        id:    'mid',
        icon:  '📱',
        label: 'Mid-Range Plan',
        desc:  'Decent data, reliable network. Good balance of cost and usability for most people.',
        badge: 'Most Common',
        impacts: [
          { label: '~$55/mo', type: 'neutral' },
          { label: '15–30GB data', type: 'neutral' },
        ],
        effect: { phoneFlat: 55 },
      },
      {
        id:    'premium',
        icon:  '📲',
        label: 'Premium Plan',
        desc:  'Unlimited data, top network. Rogers, Bell, or Telus flagship. Great coverage, steep price.',
        badge: null,
        impacts: [
          { label: '~$85/mo', type: 'cost' },
          { label: 'Unlimited data', type: 'income' },
        ],
        effect: { phoneFlat: 85 },
      },
      {
        id:    'family',
        icon:  '👨‍👩‍👧',
        label: "On Parents' Family Plan",
        desc:  "Your parents add you to their existing plan. You chip in a small amount each month.",
        badge: null,
        impacts: [
          { label: '~$20/mo your share', type: 'save' },
          { label: 'Good coverage', type: 'neutral' },
        ],
        effect: { phoneFlat: 20 },
      },
    ],
  },

  /* ── STEP S: STARTING SAVINGS ── */
  {
    id:      'savings',
    heading: 'How much did you save up?',
    intro:   'Did you work through high school? Have a summer job nest egg? This is where you start.',
    options: [
      {
        id:    'broke',
        icon:  '💸',
        label: 'Spent It All',
        desc:  'You enjoyed your summers. No regrets — but the bank account is thin.',
        badge: null,
        impacts: [
          { label: 'Start: $300', type: 'cost' },
        ],
        effect: { startingCash: 300 },
      },
      {
        id:    'some',
        icon:  '🐷',
        label: 'Some Savings',
        desc:  'You worked a bit and kept most of it. A decent cushion for the first few months.',
        badge: 'Average',
        impacts: [
          { label: 'Start: $2,000', type: 'neutral' },
        ],
        effect: { startingCash: 2000 },
      },
      {
        id:    'good',
        icon:  '💰',
        label: 'Good Saver',
        desc:  'You worked consistently through high school and stashed most of it away.',
        badge: null,
        impacts: [
          { label: 'Start: $5,000', type: 'save' },
        ],
        effect: { startingCash: 5000 },
      },
      {
        id:    'strong',
        icon:  '🏦',
        label: 'Strong Foundation',
        desc:  'Part-time job all through high school, birthday money, never spent much. Solid start.',
        badge: null,
        impacts: [
          { label: 'Start: $10,000', type: 'save' },
        ],
        effect: { startingCash: 10000 },
      },
    ],
  },
];

/* ── PLAYER SETUP — stores choices from all wizard steps ── */
const playerSetup = {
  living:    null,
  osap:      null,
  parttime:  null,
  transport: null,
  phone:     null,
  savings:   null,
  effects:   {},
  interests: [],   // array of interest ids chosen by player
};

/* ── WIZARD STATE ── */
const wizardState = {
  currentStep: 0,           // index into activeSteps[]
  activeSteps: [],          // steps array (step 2 may be excluded for trades/workforce)
  selectedOption: null,     // currently highlighted option on this step
};

/* ── WIZARD DOM REFS ── */
const setupScreen   = document.getElementById('setup-screen');
const setupHeading  = document.getElementById('setup-heading');
const setupIntro    = document.getElementById('setup-intro');
const setupOptions  = document.getElementById('setup-options');
const setupPreview  = document.getElementById('setup-preview');
const btnSetupBack  = document.getElementById('btn-setup-back');
const btnSetupNext  = document.getElementById('btn-setup-next');
const btnStartGame  = document.getElementById('btn-start-life');

/* ── Transition from career screen to wizard ── */
document.getElementById('btn-to-setup').addEventListener('click', () => {
  document.getElementById('career-screen').classList.add('hidden');
  launchSetupWizard();
});

/* ══════════════════════════════════════════════════════════
   INTERESTS — lifestyle interest options players can pick
   Each interest maps to want items and monthly lifestyle costs.
   ══════════════════════════════════════════════════════════ */
const INTERESTS_LIST = [
  { id: 'dining',    icon: '🍽️',  label: 'Dining Out',       monthlyCost: 120, wantTags: ['pizza','sushi','food','dining'] },
  { id: 'coffee',    icon: '☕',  label: 'Coffee & Cafés',    monthlyCost: 85,  wantTags: ['coffee'] },
  { id: 'travel',    icon: '✈️',  label: 'Travel',            monthlyCost: 150, wantTags: ['travel','trip','getaway','camping'] },
  { id: 'fitness',   icon: '🏋️', label: 'Fitness & Sports',  monthlyCost: 60,  wantTags: ['gym','fitness','sport','sports'] },
  { id: 'gaming',    icon: '🎮',  label: 'Gaming',            monthlyCost: 50,  wantTags: ['game','gaming','video'] },
  { id: 'fashion',   icon: '👟',  label: 'Fashion & Style',   monthlyCost: 100, wantTags: ['sneaker','wardrobe','clothing','fashion'] },
  { id: 'music',     icon: '🎵',  label: 'Music & Concerts',  monthlyCost: 80,  wantTags: ['concert','music','headphone','audio'] },
  { id: 'streaming', icon: '📺',  label: 'Streaming & Media', monthlyCost: 30,  wantTags: ['stream','tv','netflix','media'] },
  { id: 'outdoors',  icon: '🏕️', label: 'Outdoors & Camping', monthlyCost: 60, wantTags: ['camp','outdoor','hiking','nature','theme'] },
  { id: 'wellness',  icon: '💆',  label: 'Wellness & Spa',    monthlyCost: 70,  wantTags: ['massage','spa','wellness','selfcare'] },
  { id: 'learning',  icon: '📚',  label: 'Books & Learning',  monthlyCost: 40,  wantTags: ['book','course','learning','education'] },
  { id: 'social',    icon: '🎳',  label: 'Social Activities', monthlyCost: 75,  wantTags: ['bowling','social','activities','weekend','escape'] },
  { id: 'tech',      icon: '⌚',  label: 'Tech & Gadgets',    monthlyCost: 60,  wantTags: ['smartwatch','tech','gadget','headphone','wireless'] },
  { id: 'homedecor', icon: '🪴',  label: 'Home Décor',        monthlyCost: 50,  wantTags: ['decor','home','garden','plant'] },
];

/* Map want items to interest tags for filtering */
function tagWantItem(item) {
  const text = (item.title + ' ' + item.body).toLowerCase();
  return INTERESTS_LIST.filter(interest =>
    interest.wantTags.some(tag => text.includes(tag))
  ).map(i => i.id);
}

/* Pick 2–3 want items based on player interests (or random if no match) */
function pickWantItemForInterests() {
  if (gameState.month < 1) return null;
  const interests = playerSetup.interests || [];

  // Build a pool: interest-matched items first, then all items as fallback
  const matching = WANT_ITEMS.filter(w => {
    const tags = tagWantItem(w);
    return interests.length > 0 && tags.some(t => interests.includes(t));
  });
  const pool = matching.length >= 2 ? matching : WANT_ITEMS;

  // Pick 2 or 3 unique items
  const count = Math.random() < 0.5 ? 2 : 3;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));
  return picked.length > 0 ? picked : null;
}

/* ══════════════════════════════════════════════════════════
   INTERESTS SETUP STEP — shown after savings step
   ══════════════════════════════════════════════════════════ */
const INTERESTS_SETUP_STEP = {
  id:      'interests',
  heading: 'What do you enjoy?',
  intro:   "Choose your lifestyle interests. These shape the financial decisions you'll face each month — and show up in your Lifestyle tab.",
  options: [], // not used — custom render
};

function renderInterestsStep() {
  const setupHeading = document.getElementById('setup-heading');
  const setupIntro   = document.getElementById('setup-intro');
  const setupOptions = document.getElementById('setup-options');
  const setupPreview = document.getElementById('setup-preview');
  const btnSetupNext = document.getElementById('btn-setup-next');
  const btnSetupBack = document.getElementById('btn-setup-back');
  const btnStartGame = document.getElementById('btn-start-life');

  setupHeading.textContent = INTERESTS_SETUP_STEP.heading;
  setupIntro.textContent   = INTERESTS_SETUP_STEP.intro;
  setupPreview.classList.add('hidden');

  setupOptions.innerHTML = `
    <div class="interests-setup">
      <div class="interests-grid" id="interests-grid">
        ${INTERESTS_LIST.map(i => `
          <button class="interest-chip${(playerSetup.interests||[]).includes(i.id) ? ' selected' : ''}" data-interest="${i.id}">
            <span class="interest-chip__icon">${i.icon}</span>
            <span>${i.label}</span>
            <span class="interest-chip__check">✓</span>
          </button>`).join('')}
      </div>
      <div class="interests-hint">Pick 1–5 interests (choose at least 1 to continue)</div>
    </div>`;

  // Toggle selection
  setupOptions.querySelectorAll('.interest-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.interest;
      const idx = (playerSetup.interests||[]).indexOf(id);
      if (idx === -1) {
        if ((playerSetup.interests||[]).length >= 5) return; // cap at 5
        playerSetup.interests.push(id);
        chip.classList.add('selected');
      } else {
        playerSetup.interests.splice(idx, 1);
        chip.classList.remove('selected');
      }
      // Enable continue when at least 1 selected
      const hasAny = playerSetup.interests.length > 0;
      btnSetupNext && (btnSetupNext.disabled = !hasAny);
      btnStartGame && (btnStartGame.disabled = !hasAny);
    });
  });

  const hasAny = (playerSetup.interests||[]).length > 0;
  if (btnSetupNext)  { btnSetupNext.classList.remove('hidden');  btnSetupNext.disabled = !hasAny; }
  if (btnSetupBack)  { btnSetupBack.classList.remove('hidden'); }
  if (btnStartGame)  { btnStartGame.classList.add('hidden'); }

  // Check if this is last step — if so show Start Life instead of Next
  const totalSteps = wizardState.activeSteps.length;
  const isLast     = wizardState.currentStep === totalSteps - 1;
  if (isLast) {
    btnSetupNext && btnSetupNext.classList.add('hidden');
    if (btnStartGame) {
      btnStartGame.classList.remove('hidden');
      btnStartGame.disabled = !hasAny;
    }
  }

  // Progress indicator
  const progressContainer = document.getElementById('setup-progress');
  if (progressContainer) {
    progressContainer.innerHTML = wizardState.activeSteps.map((step, i) => {
      const done    = i < wizardState.currentStep;
      const current = i === wizardState.currentStep;
      const lineHTML = i < wizardState.activeSteps.length - 1
        ? `<div class="setup-progress__line${done ? ' setup-progress__line--done' : ''}"></div>`
        : '';
      return `
        <div class="setup-progress__step${current ? ' setup-progress__step--active' : done ? ' setup-progress__step--done' : ''}" data-step="${i+1}">
          <span class="setup-progress__num">${done ? '✓' : i+1}</span>
          <span class="setup-progress__label">${step.heading ? step.heading.split(' ')[0] : step.id}</span>
        </div>${lineHTML}`;
    }).join('');
  }
}

/* ──────────────────────────────────────────────────────────
   WIZARD: launchSetupWizard()
   Decides which steps to show (skip Part-Time for trades/
   workforce since they already earn), then renders step 1.
──────────────────────────────────────────────────────────── */
function launchSetupWizard() {
  const tier1 = playerCareerPath.tier1;
  const isSchoolPath = (tier1 === 'university' || tier1 === 'college');

  // Steps by id for clarity
  const stepMap = {};
  setupSteps.forEach(s => { stepMap[s.id] = s; });

  // School: Living → OSAP → Part-Time → Transport → Phone → Savings → Interests
  // Trades/Workforce: Living → Transport → Phone → Savings → Interests
  wizardState.activeSteps = isSchoolPath
    ? [stepMap.living, stepMap.osap, stepMap.parttime, stepMap.transport, stepMap.phone, stepMap.savings, INTERESTS_SETUP_STEP]
    : [stepMap.living, stepMap.transport, stepMap.phone, stepMap.savings, INTERESTS_SETUP_STEP];

  wizardState.currentStep = 0;
  wizardState.selectedOption = null;

  setupScreen.classList.remove('hidden');
  renderWizardStep(0);
}

/* ──────────────────────────────────────────────────────────
   WIZARD: renderWizardStep(index)
   Renders the option cards and updates the progress indicator
   for the given step index.
──────────────────────────────────────────────────────────── */
function renderWizardStep(index) {
  const step = wizardState.activeSteps[index];
  const totalSteps = wizardState.activeSteps.length;

  // ── INTERESTS STEP — custom render ──
  if (step && step.id === 'interests') {
    renderInterestsStep();
    return;
  }

  // Heading + intro
  setupHeading.textContent = step.heading;
  setupIntro.textContent   = step.intro;

  // Rebuild progress indicator dynamically from activeSteps
  const stepLabels = { living: 'Living', osap: 'OSAP', parttime: 'Work', transport: 'Transport', phone: 'Phone', savings: 'Savings' };
  const progressContainer = document.getElementById('setup-progress');
  progressContainer.innerHTML = wizardState.activeSteps.map((step, i) => {
    const stateClass = i < index ? 'setup-progress__step--done'
                     : i === index ? 'setup-progress__step--active' : '';
    const lineHTML = i < wizardState.activeSteps.length - 1
      ? `<div class="setup-progress__line${i < index ? ' setup-progress__line--done' : ''}"></div>` : '';
    return `<div class="setup-progress__step ${stateClass}" data-step="${i+1}">
      <span class="setup-progress__num">${i+1}</span>
      <span class="setup-progress__label">${stepLabels[step.id] || step.id}</span>
    </div>${lineHTML}`;
  }).join('');

  // Hide preview until an option is selected
  setupPreview.classList.add('hidden');

  // Render option cards
  setupOptions.innerHTML = '';
  step.options.forEach(opt => {
    // Family car is only available if the player is living at home
    const isFamilyCar = (step.id === 'transport' && opt.id === 'family-car');
    const livingAtHome = playerSetup.living === 'home';
    const unavailable  = isFamilyCar && !livingAtHome;

    const btn = document.createElement('button');
    btn.className = 'setup-option-btn';
    btn.dataset.optId = opt.id;
    if (unavailable) btn.classList.add('setup-option-btn--unavailable');

    // Check if this option was already chosen (Back navigation re-selects)
    const alreadyChosen = playerSetup[step.id] === opt.id;
    if (alreadyChosen && !unavailable) btn.classList.add('selected');

    const badgeHTML = opt.badge
      ? `<span class="setup-option-btn__badge">${opt.badge}</span>` : '';

    const unavailableNote = unavailable
      ? `<span class="setup-option-btn__unavailable">Only available if living at home</span>` : '';

    const tagsHTML = opt.impacts.map(t =>
      `<span class="setup-impact-tag setup-impact-tag--${t.type}">${t.label}</span>`
    ).join('');

    btn.innerHTML = `
      ${badgeHTML}
      <span class="setup-option-btn__icon">${opt.icon}</span>
      <span class="setup-option-btn__label">${opt.label}</span>
      <span class="setup-option-btn__desc">${opt.desc}</span>
      ${unavailableNote}
      <div class="setup-option-btn__impact">${tagsHTML}</div>`;

    if (!unavailable) {
      btn.addEventListener('click', () => handleSetupOptionSelect(step, opt, btn));
    }
    setupOptions.appendChild(btn);
  });

  // Navigation buttons
  btnSetupBack.classList.toggle('hidden', index === 0);
  btnSetupNext.classList.remove('hidden');
  btnStartGame.classList.add('hidden');

  // On the last step, swap Next for Start Life
  if (index === totalSteps - 1) {
    btnSetupNext.classList.add('hidden');
    btnStartGame.classList.remove('hidden');
    btnStartGame.disabled = !playerSetup[step.id]; // disabled until chosen
  } else {
    btnSetupNext.disabled = !playerSetup[step.id]; // disabled until chosen
  }

  // Restore preview if option already selected (Back navigation)
  if (playerSetup[step.id]) {
    const chosen = step.options.find(o => o.id === playerSetup[step.id]);
    if (chosen) renderSetupPreview(chosen);
  }
}

/* ──────────────────────────────────────────────────────────
   WIZARD: handleSetupOptionSelect(step, opt, btnEl)
   Records the player's choice and updates the preview panel.
──────────────────────────────────────────────────────────── */
function handleSetupOptionSelect(step, opt, btnEl) {
  // Highlight selected card
  setupOptions.querySelectorAll('.setup-option-btn').forEach(b => b.classList.remove('selected'));
  btnEl.classList.add('selected');

  // Store choice
  playerSetup[step.id] = opt.id;

  // Unlock Next / Start Life
  const isLast = wizardState.currentStep === wizardState.activeSteps.length - 1;
  if (isLast) {
    btnStartGame.disabled = false;
  } else {
    btnSetupNext.disabled = false;
  }

  // Show cash flow preview
  renderSetupPreview(opt);
}

/* ──────────────────────────────────────────────────────────
   WIZARD: renderSetupPreview(opt)
   Shows a projected monthly breakdown based on the chosen
   option combined with whatever is already selected.
──────────────────────────────────────────────────────────── */
function renderSetupPreview(opt) {
  // Build a merged effects object from ALL choices made so far in the wizard,
  // plus the option the player is currently hovering/selecting on this step.
  // This means the preview always reflects the full picture, not just this card.
  const mergedEffects = {};

  // First, fold in all effects from steps that have already been answered
  wizardState.activeSteps.forEach(step => {
    const chosenId = playerSetup[step.id];
    if (!chosenId) return;
    const chosen = step.options.find(o => o.id === chosenId);
    if (chosen && chosen.effect) Object.assign(mergedEffects, chosen.effect);
  });

  // Then overlay the option currently being previewed (may overwrite a step's value
  // if the player is re-selecting on the same step — that's correct behaviour)
  Object.assign(mergedEffects, opt.effect);

  // Estimate expenses from base career config + living overrides
  const baseCfg  = expenseConfig[playerCareerPath.tier2] || { rent: 1000, food: 400, transport: 120, other: 130 };
  const rent      = mergedEffects.rentFlat !== undefined
    ? mergedEffects.rentFlat
    : Math.round(baseCfg.rent * (mergedEffects.rentMultiplier ?? 1));
  const food      = Math.round(baseCfg.food * (mergedEffects.foodMultiplier ?? 1));
  const transport = mergedEffects.transportFlat !== undefined
    ? mergedEffects.transportFlat
    : baseCfg.transport;
  const other     = baseCfg.other;
  const phone     = mergedEffects.phoneFlat ?? 55;  // default mid-range if not yet chosen
  const totalExp  = rent + food + transport + phone + other;

  // Estimate income:
  // - School paths: use the part-time choice (inSchoolIncome) if set, otherwise $0
  // - Trades/Workforce: use the full working income from incomeConfig
  const baseCfgIncome = incomeConfig[playerCareerPath.tier2] || { inSchool: 0, working: 3000 };
  const isSchool      = (playerCareerPath.tier1 === 'university' || playerCareerPath.tier1 === 'college');
  // For school paths, inSchoolIncome must come from an explicit part-time choice;
  // if that step hasn't been reached yet, default to 0 (not the incomeConfig value,
  // which was the bug — incomeConfig.inSchool had non-zero values that snuck in)
  const partTimeIncome = mergedEffects.inSchoolIncome ?? 0;
  const osapIncome     = mergedEffects.osapMonthly    ?? 0;
  const estIncome = isSchool
    ? partTimeIncome + osapIncome
    : baseCfgIncome.working;

  // Net monthly
  const net = estIncome - totalExp;
  const netClass = net >= 0 ? 'green' : 'red';
  const netSign  = net >= 0 ? '+' : '';

  // Build income rows — break out part-time and OSAP when in school
  let incomeRowsHTML = '';
  if (isSchool) {
    if (partTimeIncome > 0) {
      incomeRowsHTML += `<div class="setup-preview__item">
        <span class="setup-preview__item-label">Part-Time Pay</span>
        <span class="setup-preview__item-val setup-preview__item-val--amber">+${formatCurrency(partTimeIncome)}</span>
      </div>`;
    }
    if (osapIncome > 0) {
      const grantFrac  = mergedEffects.osapGrantFraction ?? 0;
      const grantAmt   = Math.round(osapIncome * grantFrac);
      const loanAmt    = osapIncome - grantAmt;
      const osapDetail = loanAmt > 0 ? ` (${formatCurrency(grantAmt)} grant + ${formatCurrency(loanAmt)} loan)` : ` (all grant)`;
      incomeRowsHTML += `<div class="setup-preview__item">
        <span class="setup-preview__item-label">OSAP${osapDetail}</span>
        <span class="setup-preview__item-val setup-preview__item-val--amber">+${formatCurrency(osapIncome)}</span>
      </div>`;
    }
    if (partTimeIncome === 0 && osapIncome === 0) {
      incomeRowsHTML += `<div class="setup-preview__item">
        <span class="setup-preview__item-label">Income</span>
        <span class="setup-preview__item-val setup-preview__item-val--amber">+${formatCurrency(0)}</span>
      </div>`;
    }
  } else {
    incomeRowsHTML = `<div class="setup-preview__item">
      <span class="setup-preview__item-label">Income</span>
      <span class="setup-preview__item-val setup-preview__item-val--amber">+${formatCurrency(estIncome)}</span>
    </div>`;
  }

  setupPreview.classList.remove('hidden');
  setupPreview.innerHTML = `
    <span class="setup-preview__title">Projected Monthly Cash Flow</span>
    <div class="setup-preview__rows">
      ${incomeRowsHTML}
      <div class="setup-preview__item">
        <span class="setup-preview__item-label">Expenses</span>
        <span class="setup-preview__item-val setup-preview__item-val--red">-${formatCurrency(totalExp)}</span>
      </div>
      <div class="setup-preview__item">
        <span class="setup-preview__item-label">Net / Month</span>
        <span class="setup-preview__item-val setup-preview__item-val--${netClass}">${netSign}${formatCurrency(net)}</span>
      </div>
    </div>`;
}

/* ──────────────────────────────────────────────────────────
   WIZARD NAV: Next button
──────────────────────────────────────────────────────────── */
btnSetupNext.addEventListener('click', () => {
  wizardState.currentStep++;
  wizardState.selectedOption = null;
  renderWizardStep(wizardState.currentStep);
});

/* ──────────────────────────────────────────────────────────
   WIZARD NAV: Back button
──────────────────────────────────────────────────────────── */
btnSetupBack.addEventListener('click', () => {
  wizardState.currentStep--;
  renderWizardStep(wizardState.currentStep);
});

/* ──────────────────────────────────────────────────────────
   SETUP: applySetupChoices()
   Called by startLife() — merges all chosen effects into
   the actual game state before initGame() runs.

   Applies:
     1. Starting cash (from savings choice)
     2. Rent/food/transport overrides (from living choice)
     3. OSAP monthly aid + debt tracking (from osap choice)
     4. In-school income override (from part-time choice)
     5. One-time OSAP move-in advance (if living=residence)
──────────────────────────────────────────────────────────── */
function applySetupChoices() {
  // Merge all effect objects from chosen options
  const effects = {};
  wizardState.activeSteps.forEach(step => {
    const chosenId = playerSetup[step.id];
    if (!chosenId) return;
    const opt = step.options.find(o => o.id === chosenId);
    if (opt && opt.effect) Object.assign(effects, opt.effect);
  });
  playerSetup.effects = effects;

  // ── 1. Starting cash ──
  if (effects.startingCash !== undefined) {
    gameState.cash = effects.startingCash;
  }

  // ── 2. OSAP move-in advance (one-time, for residence students) ──
  if (effects.osapAdvance && effects.osapAdvance > 0) {
    gameState.cash += effects.osapAdvance;
    // Add to loan debt — it's borrowed money, not a gift
    loanState.studentDebt = (loanState.studentDebt || 0) + effects.osapAdvance;
    loanState.peakStudentDebt = Math.max(loanState.peakStudentDebt, loanState.studentDebt);
    console.log(`[Setup] OSAP move-in advance: ${formatCurrency(effects.osapAdvance)} added to cash + debt`);
  }

  // ── 3. OSAP monthly disbursement (in-school only) ──
  incomeState.osapMonthly   = effects.osapMonthly   ?? 0;
  incomeState.osapGrantFrac = effects.osapGrantFraction ?? 0;
  // Refresh loan panel immediately so OSAP rows show from day 1
  if (loanState.active) updateLoanDisplay();

  // ── 4. Override expense config based on living choice ──
  // We read base config then apply multipliers/flats from the effects object.
  // This modifies expenseState directly before initExpenseSystem() uses it,
  // so we do it AFTER initExpenseSystem() sets base values.
  // The override is applied as a post-init patch.
  const baseCfg = expenseConfig[playerCareerPath.tier2] || { rent: 1000, food: 400, transport: 120, other: 130 };

  if (effects.rentFlat !== undefined) {
    expenseState.rent = effects.rentFlat;
  } else if (effects.rentMultiplier !== undefined) {
    expenseState.rent = Math.round(baseCfg.rent * effects.rentMultiplier);
  }

  if (effects.foodMultiplier !== undefined) {
    expenseState.food = Math.round(baseCfg.food * effects.foodMultiplier);
  }

  if (effects.transportFlat !== undefined) {
    expenseState.transport = effects.transportFlat;
  }

  // Phone plan
  if (effects.phoneFlat !== undefined) {
    expenseState.phone = effects.phoneFlat;
  }

  // Store car type for life-stage updates and Rent Increase filtering
  if (effects.carType !== undefined) {
    playerSetup.carType = effects.carType;
  }

  // Recalculate total after overrides (phone is now a separate line from other)
  expenseState.monthlyTotal = expenseState.rent + expenseState.food + expenseState.transport + expenseState.phone + expenseState.other;

  // Refresh all expense display elements with new values
  const el = (id) => document.getElementById(id);
  if (el('display-exp-rent'))      el('display-exp-rent').textContent      = formatCurrency(expenseState.rent);
  if (el('row-exp-rent'))          el('row-exp-rent').classList.toggle('hidden', expenseState.rent === 0);
  if (el('display-exp-food'))      el('display-exp-food').textContent      = formatCurrency(expenseState.food);
  if (el('display-exp-transport')) el('display-exp-transport').textContent = formatCurrency(expenseState.transport);
  if (el('display-exp-phone'))     el('display-exp-phone').textContent     = formatCurrency(expenseState.phone);
  if (el('display-expenses'))      el('display-expenses').textContent      = formatCurrency(expenseState.monthlyTotal);

  // ── 5. Override in-school income (part-time job choice) ──
  if (effects.inSchoolIncome !== undefined && incomeState.config) {
    // Only override if currently in school phase
    const isSchoolPhase = (incomeState.phase === 'training' || incomeState.phase === 'none');
    if (isSchoolPhase) {
      incomeState.baseIncome = effects.inSchoolIncome;
      incomeState.lastIncome = effects.inSchoolIncome;
      updateIncomeDisplay();
    }
  }

  // Refresh starting net worth and dashboard
  updateDashboard();

  console.log(
    `[Setup] Applied — Cash: ${formatCurrency(gameState.cash)} | ` +
    `Rent: ${formatCurrency(expenseState.rent)} | ` +
    `Monthly costs: ${formatCurrency(expenseState.monthlyTotal)} | ` +
    `Income: ${formatCurrency(incomeState.lastIncome)}`
  );
}

/* END OF SETUP WIZARD
──────────────────────────────────────────────────────────── */


function initCareerScreen() {
  buildTier1Buttons();
}
initCareerScreen();

/* ──────────────────────────────────────────────────────────
   ══════════════════════════════════════════════════════════
   STUDENT LOAN SYSTEM (OSAP-style)
   ══════════════════════════════════════════════════════════
   ────────────────────────────────────────────────────────── */

const loanConfig = {
  medicine:    { yearlyTuition: 18000, yearsInSchool: 8 },
  uninursing:  { yearlyTuition:  9000, yearsInSchool: 4 },
  healthsci:   { yearlyTuition:  8000, yearsInSchool: 4 },
  cs:          { yearlyTuition:  8000, yearsInSchool: 4 },
  engineering: { yearlyTuition:  9500, yearsInSchool: 4 },
  business:    { yearlyTuition:  7500, yearsInSchool: 4 },
  law:         { yearlyTuition: 14000, yearsInSchool: 7 },
  education:   { yearlyTuition:  7000, yearsInSchool: 5 },
  arts:        { yearlyTuition:  6500, yearsInSchool: 4 },
  socialwork:  { yearlyTuition:  6500, yearsInSchool: 4 },
  colnursing:  { yearlyTuition:  5000, yearsInSchool: 3 },
  paramedic:   { yearlyTuition:  4500, yearsInSchool: 2 },
  it:          { yearlyTuition:  4500, yearsInSchool: 2 },
  accounting:  { yearlyTuition:  4000, yearsInSchool: 2 },
  design:      { yearlyTuition:  4000, yearsInSchool: 2 },
  culinary:    { yearlyTuition:  3500, yearsInSchool: 2 },
  police:      { yearlyTuition:  3500, yearsInSchool: 2 },
  ece:         { yearlyTuition:  3000, yearsInSchool: 2 },
  // Trades: yearlyTuition=0 means no tuition prompt — just tracks apprenticeship years
  electrician: { yearlyTuition: 0, yearsInSchool: 4 },
  plumber:     { yearlyTuition: 0, yearsInSchool: 4 },
  carpenter:   { yearlyTuition: 0, yearsInSchool: 4 },
  mechanic:    { yearlyTuition: 0, yearsInSchool: 3 },
  welder:      { yearlyTuition: 0, yearsInSchool: 3 },
  hvac:        { yearlyTuition: 0, yearsInSchool: 3 },
  // Workforce: starts working immediately, no training period
  retail: null, service: null, office: null, warehouse: null,
};

const INTEREST_RATE  = 0.05;   // 5% yearly interest post-graduation
const REPAYMENT_RATE = 0.10;   // 10% of monthly income as repayment

const loanState = {
  active:           false,
  studentDebt:      0,
  peakStudentDebt:  0,   // highest balance ever reached (used for end-game grading)
  yearlyTuition:    0,
  yearsInSchool:    0,
  currentYear:      1,
  inSchool:         true,
  monthlyIncome:    0,
  monthlyPayment:   0,
  debtCleared:      false,
  waitingForChoice: false,
};

const loanPanel         = document.getElementById('loan-panel');
const displayDebt       = document.getElementById('display-debt');
const displayLoanStatus = document.getElementById('display-loan-status');
const rowRepayment      = document.getElementById('row-repayment');
const displayRepayment  = document.getElementById('display-repayment');

function updateLoanDisplay() {
  displayDebt.textContent = formatCurrency(Math.round(loanState.studentDebt));
  if (loanState.inSchool) {
    displayLoanStatus.textContent = 'In School (No Payments)';
  } else if (loanState.debtCleared) {
    displayLoanStatus.textContent = 'Debt Free! 🎉';
  } else {
    displayLoanStatus.textContent = 'Repayment Phase';
  }
  if (!loanState.inSchool && !loanState.debtCleared) {
    rowRepayment.classList.remove('hidden');
    displayRepayment.textContent = formatCurrency(Math.round(loanState.monthlyPayment));
  }

  // OSAP rows — show while in school with OSAP selected
  const rowOsapMonthly = document.getElementById('row-osap-monthly');
  const rowOsapLoan    = document.getElementById('row-osap-loan');
  const dispOsapMo     = document.getElementById('display-osap-monthly');
  const dispOsapLoan   = document.getElementById('display-osap-loan');
  if (rowOsapMonthly && incomeState.osapMonthly > 0 && loanState.inSchool) {
    const loanAmt = Math.round(incomeState.osapMonthly * (1 - incomeState.osapGrantFrac));
    rowOsapMonthly.classList.remove('hidden');
    dispOsapMo.textContent = formatCurrency(incomeState.osapMonthly);
    if (loanAmt > 0) {
      rowOsapLoan.classList.remove('hidden');
      dispOsapLoan.textContent = `+${formatCurrency(loanAmt)}/mo to debt`;
    } else {
      rowOsapLoan.classList.add('hidden');
    }
  } else if (rowOsapMonthly) {
    rowOsapMonthly.classList.add('hidden');
    if (rowOsapLoan) rowOsapLoan.classList.add('hidden');
  }
}

function deriveMonthlyIncome() {
  const str = playerCareerPath.data.income.replace(/\$/g,'').replace(/,/g,'').split(/[–-]/)[0].trim();
  return Math.round((parseInt(str, 10) || 40000) / 12);
}

function initLoanSystem() {
  const config = loanConfig[playerCareerPath.tier2];
  if (!config) { loanState.active = false; loanState.inSchool = false; return; }
  loanState.active        = true;
  loanState.yearlyTuition = config.yearlyTuition;
  loanState.yearsInSchool = config.yearsInSchool;
  loanState.currentYear   = 1;
  loanState.inSchool      = true;
  loanState.studentDebt   = 0;
  loanState.debtCleared   = false;
  loanState.monthlyIncome = deriveMonthlyIncome();
  loanState.monthlyPayment = Math.round(loanState.monthlyIncome * REPAYMENT_RATE);
  // Only show loan panel for paths with actual tuition/debt
  if (config.yearlyTuition > 0) {
    loanPanel.classList.remove('hidden');
    updateLoanDisplay();
  }
}


/* Capture the original month-card HTML once so we can restore it after tuition overwrites it */
const _monthCardTemplate = document.getElementById('month-card').innerHTML;

/* Inject content into the centre month card (replaces old contentArea) */
function setMonthCardContent(html) {
  const card = document.getElementById('month-card');
  document.getElementById('welcome-card').classList.add('hidden');
  card.classList.remove('hidden');
  card.innerHTML = html;
}

/* Restore the original month-card DOM structure (needed after tuition prompt overwrites it) */
function restoreMonthCard() {
  const card = document.getElementById('month-card');
  card.innerHTML = _monthCardTemplate;
  document.getElementById('alloc-ef').addEventListener('input', updateAllocRemainder);
  document.getElementById('alloc-hisa').addEventListener('input', updateAllocRemainder);
  document.getElementById('alloc-tfsa').addEventListener('input', updateAllocRemainder);
  document.getElementById('alloc-rrsp').addEventListener('input', updateAllocRemainder);
  document.getElementById('alloc-fhsa').addEventListener('input', updateAllocRemainder);
  if (typeof initAutoContribPanel === 'function') initAutoContribPanel();
  if (typeof updateAutoContribBadge === 'function') updateAutoContribBadge();

  // Re-wire risk toggle buttons
  document.querySelectorAll('.risk-toggle-btns').forEach(group => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.risk-btn');
      if (!btn) return;
      const account = group.dataset.account;
      const type    = btn.dataset.type;
      investState[account + 'Choice'] = type;
      group.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('risk-btn--active'));
      btn.classList.add('risk-btn--active');
    });
  });
  // Restore the current risk button active states
  ['tfsa','rrsp','fhsa'].forEach(function(acc) {
    const group = document.querySelector('.risk-toggle-btns[data-account="' + acc + '"]');
    if (!group) return;
    group.querySelectorAll('.risk-btn').forEach(function(b) {
      b.classList.toggle('risk-btn--active', b.dataset.type === investState[acc + 'Choice']);
    });
  });
}
function showTuitionPrompt() {
  window._ffInterrupted = true;  // pause fast-forward
  loanState.waitingForChoice = true;

  const amount    = loanState.yearlyTuition;
  const canAfford = gameState.cash >= amount;
  const payClass  = canAfford ? '' : 'tuition-choice-btn--disabled';
  const payNote   = canAfford
    ? `Costs ${formatCurrency(amount)} — paid from cash now.`
    : `Only ${formatCurrency(gameState.cash)} available — not enough.`;

  setMonthCardContent(`
    <div class="tuition-prompt">
      <div class="tuition-prompt__badge">📚 Month ${gameState.month} · Tuition Due · School Year ${loanState.currentYear} of ${loanState.yearsInSchool}</div>
      <div class="tuition-prompt__amount">${formatCurrency(amount)}</div>
      <p class="tuition-prompt__body">Your annual tuition is due before classes start. Pay out-of-pocket now, or take a student loan — no payments until after graduation (5% interest).</p>
      <div class="tuition-choices">
        <button class="tuition-choice-btn tuition-choice-btn--pay ${payClass}" id="btn-pay-now">
          <span class="tuition-choice-btn__icon">💵</span>
          <span class="tuition-choice-btn__label">Pay Now</span>
          <span class="tuition-choice-btn__note">${payNote}</span>
        </button>
        <button class="tuition-choice-btn tuition-choice-btn--loan" id="btn-take-loan">
          <span class="tuition-choice-btn__icon">🏦</span>
          <span class="tuition-choice-btn__label">Take Loan</span>
          <span class="tuition-choice-btn__note">Adds ${formatCurrency(amount)} to debt.</span>
        </button>
      </div>
      <div class="tuition-confirm hidden" id="tuition-confirm-wrap">
        <p class="tuition-confirm__summary" id="tuition-confirm-summary"></p>
        <button class="btn-confirm-month" id="btn-confirm-tuition">Confirm Choice ✓</button>
      </div>
    </div>`);

  let pendingChoice = null;

  function selectTuitionOption(choice) {
    pendingChoice = choice;
    // Highlight selected
    document.querySelectorAll('.tuition-choice-btn').forEach(b => b.classList.remove('tuition-choice-btn--selected'));
    const selected = choice === 'pay' ? document.getElementById('btn-pay-now') : document.getElementById('btn-take-loan');
    if (selected) selected.classList.add('tuition-choice-btn--selected');
    // Show confirm section
    const wrap = document.getElementById('tuition-confirm-wrap');
    const summary = document.getElementById('tuition-confirm-summary');
    wrap.classList.remove('hidden');
    summary.textContent = choice === 'pay'
      ? `You will pay ${formatCurrency(amount)} from your cash balance.`
      : `${formatCurrency(amount)} will be added to your student loan.`;
  }

  if (canAfford) {
    document.getElementById('btn-pay-now').addEventListener('click', () => selectTuitionOption('pay'));
  }
  document.getElementById('btn-take-loan').addEventListener('click', () => selectTuitionOption('loan'));
  document.getElementById('btn-confirm-tuition').addEventListener('click', () => {
    if (!pendingChoice) return;
    // Disable confirm button immediately to prevent double-click
    document.getElementById('btn-confirm-tuition').disabled = true;
    handleTuitionChoice(pendingChoice);
  });
}

function handleTuitionChoice(choice) {
  const amount = loanState.yearlyTuition;
  if (choice === 'pay') {
    gameState.cash -= amount;
  } else {
    loanState.studentDebt += amount;
    loanState.peakStudentDebt = Math.max(loanState.peakStudentDebt, loanState.studentDebt);
  }
  loanState.waitingForChoice = false;
  // If this was the final year's tuition, graduate immediately
  if (loanState.finalYearTuition) {
    loanState.finalYearTuition = false;
    loanState.inSchool = false;
    updateLoanDisplay();
    // Re-evaluate graduation transition so justGraduated is true this month
    const justGraduated = checkIncomePhaseTransition();
    if (advanceMonth._pendingContext) {
      advanceMonth._pendingContext.justGraduated = justGraduated;
    }
  }
  updateDashboard();
  // Resume the month after tuition — skip loan processing (already done)
  resumeMonthAfterTuition();
}
function applyYearlyInterest() {
  if (loanState.studentDebt <= 0) return;
  // interest = studentDebt × INTEREST_RATE
  const interest = loanState.studentDebt * INTEREST_RATE;
  loanState.studentDebt += interest;
  loanState.peakStudentDebt = Math.max(loanState.peakStudentDebt, loanState.studentDebt);
  // net worth recalculated automatically via recalcNetWorth (debt grew)
}

function applyMonthlyRepayment() {
  if (loanState.studentDebt <= 0 || loanState.debtCleared) return '';
  const payment = Math.min(Math.round(loanState.monthlyPayment), Math.round(loanState.studentDebt));
  // payment = monthlyIncome × REPAYMENT_RATE (capped at remaining debt)
  loanState.studentDebt -= payment;
  gameState.cash        -= payment;
  expenseState.loanRepayment = payment;  // track for centre card display
  // net worth recalculated by recalcNetWorth (debt went down = NW improves)
  updateLoanDisplay();

  if (loanState.studentDebt <= 0) {
    loanState.studentDebt = 0;
    loanState.debtCleared = true;
    rowRepayment.classList.add('hidden');
    updateLoanDisplay();
    return `<div class="feed-card feed-card--debtfree">
      <span style="font-size:2rem">🎉</span>
      <span class="feed-card__title">Student Debt Cleared!</span>
      <p class="feed-card__body">Final payment of ${formatCurrency(payment)} sent. That ${formatCurrency(payment)}/month is now yours to keep.</p>
    </div>`;
  }

  return `<div class="feed-card feed-card--repayment">
    <span class="feed-card__badge">Loan Repayment</span>
    <span class="feed-card__title">💳 ${formatCurrency(payment)} sent to student loan</span>
    <p class="feed-card__body">Remaining debt: ${formatCurrency(Math.round(loanState.studentDebt))}</p>
  </div>`;
}

function processLoanForMonth() {
  expenseState.loanRepayment = 0;  // reset each month before recalculating
  if (!loanState.active) return '';
  if (loanState.debtCleared) return '';
  const month = gameState.month;

  if (loanState.inSchool) {
    const isYearBoundary = (month - 1) % 12 === 0;
    if (isYearBoundary) {
      const isTrades = loanState.yearlyTuition === 0;
      if (loanState.currentYear < loanState.yearsInSchool) {
        // Mid-program: show tuition (or silently advance for trades)
        if (!isTrades) { showTuitionPrompt(); }
        loanState.currentYear++;
        if (isTrades) return '';  // no interrupt for trades — continue month normally
        return '';
      } else if (loanState.currentYear === loanState.yearsInSchool) {
        // Final year: show tuition (or for trades, mark for graduation)
        if (!isTrades) {
          showTuitionPrompt();
          loanState.currentYear++;
          loanState.finalYearTuition = true;
        } else {
          loanState.currentYear++;
          loanState.finalYearTuition = true;
          // Immediately graduate for trades (no tuition confirmation needed)
          loanState.finalYearTuition = false;
          loanState.inSchool = false;
          updateLoanDisplay();
        }
        return '';
      } else {
        // Past final year — graduate now
        loanState.inSchool = false;
        updateLoanDisplay();
      }
    } else {
      return '';
    }
  }

  // Repayment phase
  const isAnniversary = month > 1 && (month - 1) % 12 === 0;
  if (isAnniversary && loanState.studentDebt > 0) {
    applyYearlyInterest();
    updateDashboard();
  }
  return applyMonthlyRepayment();
}

/* ──────────────────────────────────────────────────────────
   ══════════════════════════════════════════════════════════
   MANDATORY EXPENSES SYSTEM (Phase B)
   Every month, fixed living costs are auto-deducted from
   cash BEFORE the player sees the budget panel. This creates
   real tension — you must cover rent and food before you
   can save or invest.

   Expenses are split into three categories that mirror the
   budget: Needs (rent + food), Transport, and Other (phone,
   utilities). The player can see these in the feed so they
   understand where money goes.

   Costs scale by career path to reflect real-world living:
   a physician earns more but also lives in a city with
   higher rent; a warehouse worker earns less but has lower
   fixed costs.

   ANNUAL SALARY RAISE (Phase B)
   Every 12 months, incomeState.baseIncome grows by
   ANNUAL_RAISE_RATE (2.5%). This rewards long-term play
   and reflects real career progression.

   CASH FLOOR (Phase B)
   If cash drops below CASH_FLOOR (-$500), Next Month is
   blocked with an overdraft warning until the player
   acknowledges they are in financial trouble.
   ══════════════════════════════════════════════════════════
   ────────────────────────────────────────────────────────── */

/* ── EXPENSE CONFIG
   Monthly mandatory costs per career key.
   rent      = monthly rent ($)
   food      = groceries + dining basics ($)
   transport = transit / car costs ($)
   other     = phone + utilities ($)

   Total = rent + food + transport + other
   All figures are approximate 2024 Canadian averages.
──────────────────────────────────────────────────────────── */
const expenseConfig = {
  medicine:    { rent: 1400, food: 380, transport: 100, other: 70 },
  uninursing:  { rent: 1300, food: 360, transport: 90,  other: 65 },
  healthsci:   { rent: 1200, food: 340, transport: 90,  other: 65 },
  cs:          { rent: 1300, food: 340, transport: 90,  other: 65 },
  engineering: { rent: 1300, food: 360, transport: 90,  other: 65 },
  business:    { rent: 1300, food: 340, transport: 90,  other: 65 },
  law:         { rent: 1400, food: 380, transport: 100, other: 70 },
  education:   { rent: 1200, food: 340, transport: 90,  other: 65 },
  arts:        { rent: 1100, food: 320, transport: 85,  other: 60 },
  socialwork:  { rent: 1100, food: 320, transport: 85,  other: 60 },
  colnursing:  { rent: 1200, food: 340, transport: 90,  other: 60 },
  paramedic:   { rent: 1100, food: 340, transport: 100, other: 60 },
  it:          { rent: 1200, food: 330, transport: 85,  other: 60 },
  accounting:  { rent: 1100, food: 330, transport: 85,  other: 60 },
  design:      { rent: 1100, food: 320, transport: 85,  other: 60 },
  culinary:    { rent: 1000, food: 380, transport: 100, other: 60 },
  police:      { rent: 1200, food: 340, transport: 100, other: 65 },
  ece:         { rent: 1000, food: 320, transport: 90,  other: 60 },
  electrician: { rent: 1100, food: 420, transport: 180, other: 75 },
  plumber:     { rent: 1100, food: 420, transport: 180, other: 75 },
  carpenter:   { rent: 1000, food: 400, transport: 170, other: 70 },
  mechanic:    { rent: 1000, food: 400, transport: 160, other: 70 },
  welder:      { rent: 1000, food: 420, transport: 170, other: 70 },
  hvac:        { rent: 1000, food: 400, transport: 160, other: 70 },
  retail:      { rent:  900, food: 380, transport: 100, other: 65 },
  service:     { rent:  900, food: 380, transport: 100, other: 65 },
  office:      { rent: 1100, food: 390, transport: 120, other: 70 },
  warehouse:   { rent: 1000, food: 400, transport: 160, other: 65 },
};

/* Constants */
const ANNUAL_RAISE_RATE = 0.025;  // 2.5% salary raise per year
const CASH_FLOOR        = -500;   // overdraft limit before game blocks

/* ── EXPENSE STATE ── */
const expenseState = {
  monthlyTotal:   0,   // total mandatory deduction this month ($)
  rent:           0,
  food:           0,
  transport:      0,
  phone:          0,   // chosen phone plan (from wizard)
  other:          0,   // utilities only (phone broken out separately)
  loanRepayment:  0,   // student loan payment this month (set by applyMonthlyRepayment)
  mortgagePayment:0,   // mortgage payment this month (set by processMortgageMonth)
};

/* ──────────────────────────────────────────────────────────
   EXPENSES: updateExpensesForLifeStage()
   Called when the player transitions life stages:
     - Graduation / start of working life
     - Home purchase (moving out of parents)
   Recalculates food and transport from the base career config,
   overriding whatever wizard multipliers were applied at setup.
──────────────────────────────────────────────────────────── */
function updateExpensesForLifeStage(trigger) {
  const cfg = expenseConfig[playerCareerPath.tier2];
  if (!cfg) return;

  if (trigger === 'graduation') {
    // If player was living at home (food multiplier 0.45), upgrade to full food costs
    const wasAtHome = playerSetup.living === 'home';
    if (wasAtHome) {
      expenseState.food = cfg.food;  // full adult food costs
      expenseState.transport = cfg.transport;  // also upgrade transport
    }
    // Recalculate total (rent stays whatever it was — they may still be at home)
    expenseState.monthlyTotal = expenseState.rent + expenseState.food + expenseState.transport + expenseState.phone + expenseState.other;
    // Update sidebar display
    const el = (id) => document.getElementById(id);
    if (el('display-exp-food'))      el('display-exp-food').textContent      = formatCurrency(expenseState.food);
    if (el('display-exp-transport')) el('display-exp-transport').textContent = formatCurrency(expenseState.transport);
    if (el('display-expenses'))      el('display-expenses').textContent      = formatCurrency(expenseState.monthlyTotal);
    // Phone stays unchanged on graduation
  }

  if (trigger === 'home-purchase') {
    // Moving into owned home — full food costs if they weren't already
    expenseState.food = cfg.food;
    // Transport stays the same (no car system yet)
    // Rent is zeroed by processMortgageMonth
    expenseState.monthlyTotal = expenseState.food + expenseState.transport + expenseState.phone + expenseState.other + (mortgageState.monthlyPayment || 0);
    const el = (id) => document.getElementById(id);
    if (el('display-exp-food'))  el('display-exp-food').textContent  = formatCurrency(expenseState.food);
    if (el('display-expenses'))  el('display-expenses').textContent  = formatCurrency(expenseState.monthlyTotal);
  }
}

/* ──────────────────────────────────────────────────────────
   EXPENSES: initExpenseSystem()
   Reads per-career config and stores base monthly amounts.
──────────────────────────────────────────────────────────── */
function initExpenseSystem() {
  const cfg = expenseConfig[playerCareerPath.tier2];
  if (!cfg) return;
  expenseState.rent      = cfg.rent;
  expenseState.food      = cfg.food;
  expenseState.transport = cfg.transport;
  expenseState.other     = cfg.other;

  // Re-apply living/setup overrides so wizard choices are not clobbered by base config
  const effects = playerSetup.effects || {};
  if (effects.rentFlat !== undefined) {
    expenseState.rent = effects.rentFlat;
  } else if (effects.rentMultiplier !== undefined) {
    expenseState.rent = Math.round(cfg.rent * effects.rentMultiplier);
  }
  if (effects.foodMultiplier !== undefined) {
    expenseState.food = Math.round(cfg.food * effects.foodMultiplier);
  }
  if (effects.transportFlat !== undefined) {
    expenseState.transport = effects.transportFlat;
  }

  // Phone plan from wizard
  if ((playerSetup.effects || {}).phoneFlat !== undefined) {
    expenseState.phone = playerSetup.effects.phoneFlat;
  }

  expenseState.monthlyTotal = expenseState.rent + expenseState.food + expenseState.transport + expenseState.phone + expenseState.other;

  // Populate the left-column expenses panel
  const el = (id) => document.getElementById(id);
  if (el('display-exp-rent'))      el('display-exp-rent').textContent      = formatCurrency(expenseState.rent);
  if (el('row-exp-rent'))          el('row-exp-rent').classList.toggle('hidden', expenseState.rent === 0);
  if (el('display-exp-food'))      el('display-exp-food').textContent      = formatCurrency(expenseState.food);
  if (el('display-exp-transport')) el('display-exp-transport').textContent = formatCurrency(expenseState.transport);
  if (el('display-exp-phone'))     el('display-exp-phone').textContent     = formatCurrency(expenseState.phone);
  if (el('display-exp-other'))     el('display-exp-other').textContent     = formatCurrency(expenseState.other);
  if (el('display-expenses'))      el('display-expenses').textContent      = formatCurrency(expenseState.monthlyTotal);

  // Topbar pill

  console.log(`[Expenses] Monthly fixed costs: ${formatCurrency(expenseState.monthlyTotal)}`);
}



/* ──────────────────────────────────────────────────────────
   SALARY RAISE: applyAnnualRaise()
   Called at months 24, 36, 48 … (every 12 months AFTER the
   first year). Grows baseIncome by ANNUAL_RAISE_RATE.

   Formula:
     newBase = oldBase × (1 + ANNUAL_RAISE_RATE)
   Example: $4,800 × 1.025 = $4,920/mo (+$120)
──────────────────────────────────────────────────────────── */
function applyAnnualRaise() {
  // Only apply once the player is in their working phase
  if (incomeState.phase !== 'working') return '';
  if (incomeState.baseIncome <= 0) return '';

  const oldBase = incomeState.baseIncome;
  // newBase = oldBase × (1 + ANNUAL_RAISE_RATE)
  incomeState.baseIncome = Math.round(oldBase * (1 + ANNUAL_RAISE_RATE));
  const raise = incomeState.baseIncome - oldBase;

  console.log(`[Raise] Year ${Math.floor(gameState.month/12)}: ${formatCurrency(oldBase)} → ${formatCurrency(incomeState.baseIncome)} (+${formatCurrency(raise)}/mo)`);

  return `
    <div class="feed-card feed-card--raise">
      <span class="feed-card__badge">Annual Review · Year ${Math.floor(gameState.month/12)}</span>
      <span class="feed-card__title">🎉 Salary Raise!</span>
      <p class="feed-card__body">
        Performance review complete. Your monthly base pay increases by ${formatCurrency(raise)}
        to <strong>${formatCurrency(incomeState.baseIncome)}/mo</strong>.
        That\'s ${formatCurrency(raise * 12)} more per year.
      </p>
    </div>`;
}



/* END OF EXPENSES / RAISE / OVERDRAFT SYSTEMS
──────────────────────────────────────────────────────────── */


const incomeConfig = {
  medicine:    { inSchool:    0, working: 14000, inSchoolLabel: 'Medical School', workingLabel: 'Physician',        inSchoolPhase: 'none',     workingPhase: 'working' },
  uninursing:  { inSchool:  700, working:  4800, inSchoolLabel: 'Clinical Year',  workingLabel: 'RN (BScN)',        inSchoolPhase: 'training', workingPhase: 'working' },
  healthsci:   { inSchool:  600, working:  3600, inSchoolLabel: 'Part-Time',      workingLabel: 'Health Sci.',      inSchoolPhase: 'training', workingPhase: 'working' },
  cs:          { inSchool:  600, working:  4800, inSchoolLabel: 'Part-Time',      workingLabel: 'Software Dev',     inSchoolPhase: 'training', workingPhase: 'working' },
  engineering: { inSchool:  650, working:  5200, inSchoolLabel: 'Part-Time',      workingLabel: 'Engineer',         inSchoolPhase: 'training', workingPhase: 'working' },
  business:    { inSchool:  600, working:  3800, inSchoolLabel: 'Part-Time',      workingLabel: 'Business Role',    inSchoolPhase: 'training', workingPhase: 'working' },
  law:         { inSchool:  500, working:  6200, inSchoolLabel: 'Law School',     workingLabel: 'Lawyer',           inSchoolPhase: 'training', workingPhase: 'working' },
  education:   { inSchool:  600, working:  4000, inSchoolLabel: 'Practicum',      workingLabel: 'Teacher',          inSchoolPhase: 'training', workingPhase: 'working' },
  arts:        { inSchool:  600, working:  2500, inSchoolLabel: 'Part-Time',      workingLabel: 'Arts Career',      inSchoolPhase: 'training', workingPhase: 'working' },
  socialwork:  { inSchool:  600, working:  3200, inSchoolLabel: 'Placement',      workingLabel: 'Social Worker',    inSchoolPhase: 'training', workingPhase: 'working' },
  colnursing:  { inSchool:  700, working:  4200, inSchoolLabel: 'Clinical',       workingLabel: 'RPN/RN',           inSchoolPhase: 'training', workingPhase: 'working' },
  paramedic:   { inSchool:  700, working:  4000, inSchoolLabel: 'Practicum',      workingLabel: 'Paramedic',        inSchoolPhase: 'training', workingPhase: 'working' },
  it:          { inSchool:  700, working:  3600, inSchoolLabel: 'Part-Time',      workingLabel: 'IT Specialist',    inSchoolPhase: 'training', workingPhase: 'working' },
  accounting:  { inSchool:  650, working:  3400, inSchoolLabel: 'Part-Time',      workingLabel: 'Accountant',       inSchoolPhase: 'training', workingPhase: 'working' },
  design:      { inSchool:  600, working:  2800, inSchoolLabel: 'Freelance',      workingLabel: 'Designer',         inSchoolPhase: 'training', workingPhase: 'working' },
  culinary:    { inSchool:  700, working:  2600, inSchoolLabel: 'Kitchen Work',   workingLabel: 'Chef/Cook',        inSchoolPhase: 'training', workingPhase: 'working' },
  police:      { inSchool:  700, working:  4500, inSchoolLabel: 'Part-Time',      workingLabel: 'Officer',          inSchoolPhase: 'training', workingPhase: 'working' },
  ece:         { inSchool:  650, working:  2600, inSchoolLabel: 'Placement',      workingLabel: 'ECE Worker',       inSchoolPhase: 'training', workingPhase: 'working' },
  electrician: { inSchool: 2800, working:  5200, inSchoolLabel: 'Apprentice',     workingLabel: 'Journeyman Elec.', inSchoolPhase: 'training', workingPhase: 'working' },
  plumber:     { inSchool: 2800, working:  5400, inSchoolLabel: 'Apprentice',     workingLabel: 'Journeyman Plmb.', inSchoolPhase: 'training', workingPhase: 'working' },
  carpenter:   { inSchool: 2400, working:  4200, inSchoolLabel: 'Apprentice',     workingLabel: 'Journeyman Carp.', inSchoolPhase: 'training', workingPhase: 'working' },
  mechanic:    { inSchool: 2400, working:  4000, inSchoolLabel: 'Apprentice',     workingLabel: 'Journeyman Mech.', inSchoolPhase: 'training', workingPhase: 'working' },
  welder:      { inSchool: 2300, working:  4200, inSchoolLabel: 'Apprentice',     workingLabel: 'Cert. Welder',     inSchoolPhase: 'training', workingPhase: 'working' },
  hvac:        { inSchool: 2200, working:  4000, inSchoolLabel: 'Apprentice',     workingLabel: 'HVAC Tech',        inSchoolPhase: 'training', workingPhase: 'working' },
  retail:      { inSchool: 2400, working:  2400, inSchoolLabel: 'Working',        workingLabel: 'Retail',           inSchoolPhase: 'working',  workingPhase: 'working' },
  service:     { inSchool: 2300, working:  2300, inSchoolLabel: 'Working',        workingLabel: 'Food and Hosp.',   inSchoolPhase: 'working',  workingPhase: 'working' },
  office:      { inSchool: 3000, working:  3000, inSchoolLabel: 'Working',        workingLabel: 'Office Admin',     inSchoolPhase: 'working',  workingPhase: 'working' },
  warehouse:   { inSchool: 2800, working:  2800, inSchoolLabel: 'Working',        workingLabel: 'Warehouse',        inSchoolPhase: 'working',  workingPhase: 'working' },
};

const INCOME_VARIANCE = 0.10;   // ±10% random swing per month

const incomeState = {
  baseIncome:      0,
  lastIncome:      0,
  phase:           'none',
  phaseLabel:      '',
  config:          null,
  osapMonthly:     0,    // monthly OSAP disbursement (in-school only)
  osapGrantFrac:   0,    // fraction that is grant (rest adds to debt)
};

function updateIncomeDisplay() {
  const _incEl = document.getElementById('display-income');
  if (_incEl) _incEl.textContent = formatCurrency(incomeState.lastIncome);
  // Update left sidebar income panel
  const el = (id) => document.getElementById(id);
  if (el('label-income-job'))   el('label-income-job').textContent   = incomeState.phaseLabel || 'Pay';
  if (el('display-income-job')) el('display-income-job').textContent = formatCurrency(incomeState.baseIncome);
  // OSAP row on sidebar
  if (incomeState.osapMonthly > 0 && loanState.inSchool) {
    if (el('row-income-osap'))     el('row-income-osap').classList.remove('hidden');
    if (el('display-income-osap')) el('display-income-osap').textContent = formatCurrency(incomeState.osapMonthly);
    if (el('display-income'))      el('display-income').textContent = formatCurrency(incomeState.baseIncome + incomeState.osapMonthly);
  } else {
    if (el('row-income-osap')) el('row-income-osap').classList.add('hidden');
  }
  const phase = document.getElementById('career-badge-phase');
  if (phase) phase.textContent = incomeState.phaseLabel;
}

// base ± INCOME_VARIANCE% (or job-stability override)
function calculateMonthlyIncome(base) {
  if (base <= 0) return 0;
  const variance = incomeState.varianceOverride || INCOME_VARIANCE;
  const swing = base * variance;
  return Math.round(base - swing + Math.random() * swing * 2);
}

function checkIncomePhaseTransition() {
  if (!loanState.active) return false;
  if (incomeState.baseIncome === incomeState.config.working) return false;
  if (!loanState.inSchool) {
    // Instead of auto-switching, trigger the job offer screen
    if (!jobOfferState.offered && !jobOfferState.accepted) {
      jobOfferState.pendingTransition = true;
    } else if (jobOfferState.accepted) {
      // Apply the chosen job's income
      incomeState.baseIncome = jobOfferState.chosenJob.salary;
      incomeState.phase      = 'working';
      incomeState.phaseLabel = jobOfferState.chosenJob.title;
      updateIncomeDisplay();
    }
    return true;
  }
  return false;
}



function initIncomeSystem() {
  const config = incomeConfig[playerCareerPath.tier2];
  if (!config) return;
  incomeState.config = config;
  const startsWorking = (playerCareerPath.tier1 === 'workforce');
  incomeState.baseIncome   = startsWorking ? config.working        : config.inSchool;
  incomeState.phase        = startsWorking ? config.workingPhase   : config.inSchoolPhase;
  incomeState.phaseLabel   = startsWorking ? config.workingLabel   : config.inSchoolLabel;
  incomeState.osapMonthly  = 0;  // set by applySetupChoices after init
  incomeState.osapGrantFrac = 0;

  // Re-apply part-time income override from wizard so initGame() doesn't clobber it
  const effects = playerSetup.effects || {};
  if (!startsWorking && effects.inSchoolIncome !== undefined) {
    incomeState.baseIncome = effects.inSchoolIncome;
  }

  incomeState.lastIncome   = calculateMonthlyIncome(incomeState.baseIncome);
  updateIncomeDisplay();
}

/* ──────────────────────────────────────────────────────────
   ══════════════════════════════════════════════════════════
   BUDGET SYSTEM — number inputs
   ══════════════════════════════════════════════════════════
   ────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────
   MONTH CARD SYSTEM
   Single card per month: earned / owed / leftover / allocate
──────────────────────────────────────────────────────────── */

// ── Account limits ──────────────────────────────────────────
const TFSA_ANNUAL_LIMIT   = 7000;   // 2024 Canadian contribution room
const FHSA_ANNUAL_LIMIT   = 8000;
const FHSA_LIFETIME_LIMIT = 40000;

// ── Investment type definitions ──────────────────────────────
const INVEST_TYPES = {
  index:  { label: 'Index Fund', icon: '📊', color: '#27ae60', minAnnual:  6, maxAnnual: 10 },
  stocks: { label: 'Stocks',     icon: '📈', color: '#2980b9', minAnnual:-15, maxAnnual: 20 },
  crypto: { label: 'Crypto',     icon: '₿',  color: '#f39c12', minAnnual:-40, maxAnnual: 60 },
};

// ── Holdings model ───────────────────────────────────────────
// Each account holds sub-buckets per investment type.
// holdings.tfsa.index = { contributed: 0, balance: 0 }
const portfolioState = {
  holdings: {
    tfsa: { index: { contributed: 0, balance: 0 }, stocks: { contributed: 0, balance: 0 }, crypto: { contributed: 0, balance: 0 } },
    rrsp: { index: { contributed: 0, balance: 0 }, stocks: { contributed: 0, balance: 0 }, crypto: { contributed: 0, balance: 0 } },
    fhsa: { index: { contributed: 0, balance: 0 }, stocks: { contributed: 0, balance: 0 }, crypto: { contributed: 0, balance: 0 } },
  },
  // Contribution room tracking
  tfsaYearContrib: 0,   // resets each in-game year
  fhsaYearContrib: 0,
  fhsaTotalContrib: 0,  // lifetime total contributed (never resets; used for $40k cap)
  // Monthly growth log: [{ month, tfsa, rrsp, fhsa }]
  growthLog: [],
  // Active type selection per account (for new contributions)
  tfsaChoice: 'index',
  rrspChoice: 'index',
  fhsaChoice: 'index',
  // Last month gains (for month card display)
  lastGain: { tfsa: 0, rrsp: 0, fhsa: 0 },
};

// Legacy allocState for leftover tracking
const allocState = {
  leftover: 0,
  get fhsaYearContrib() { return portfolioState.fhsaYearContrib; },
};

// Legacy investState shim so existing risk-toggle wiring still works
const investState = {
  get tfsaChoice() { return portfolioState.tfsaChoice; },
  set tfsaChoice(v) { portfolioState.tfsaChoice = v; },
  get rrspChoice() { return portfolioState.rrspChoice; },
  set rrspChoice(v) { portfolioState.rrspChoice = v; },
  get fhsaChoice() { return portfolioState.fhsaChoice; },
  set fhsaChoice(v) { portfolioState.fhsaChoice = v; },
  lastTfsaGain: 0, lastRrspGain: 0, lastFhsaGain: 0,
};

function randomRate(minAnnual, maxAnnual) {
  return (minAnnual + Math.random() * (maxAnnual - minAnnual)) / 100 / 12;
}

/* Grow every holding bucket independently, then sync gameState totals */
function applyMonthlyGrowth() {
  const growth = { tfsa: 0, rrsp: 0, fhsa: 0 };

  ['tfsa', 'rrsp', 'fhsa'].forEach(acc => {
    if (acc === 'fhsa' && window._fhsaClosed) return;
    Object.keys(INVEST_TYPES).forEach(type => {
      const holding = portfolioState.holdings[acc][type];
      if (holding.balance <= 0) return;
      const t = INVEST_TYPES[type];
      const r = randomRate(t.minAnnual, t.maxAnnual);
      const gain = holding.balance * r;
      holding.balance += gain;
      growth[acc] += gain;
    });
  });

  // Sync gameState totals from holdings
  syncGameStateFromHoldings();

  portfolioState.lastGain = { ...growth };
  investState.lastTfsaGain = growth.tfsa;
  investState.lastRrspGain = growth.rrsp;
  investState.lastFhsaGain = growth.fhsa;

  // Log growth for portfolio history
  portfolioState.growthLog.push({
    month: gameState.month,
    tfsa: Math.round(growth.tfsa),
    rrsp: Math.round(growth.rrsp),
    fhsa: Math.round(growth.fhsa),
  });

  return growth;
}

/* Sum all holdings into gameState account totals */
function syncGameStateFromHoldings() {
  ['tfsa', 'rrsp', 'fhsa'].forEach(acc => {
    gameState[acc] = Object.values(portfolioState.holdings[acc])
      .reduce((sum, h) => sum + h.balance, 0);
  });
}

/* Close FHSA: zero holdings, transfer remainder to RRSP */
function closeFhsaHoldings() {
  const rem = Object.values(portfolioState.holdings.fhsa).reduce((s,h)=>s+h.balance,0);
  if (rem > 0) depositToHolding('rrsp', portfolioState.rrspChoice, rem);
  Object.keys(portfolioState.holdings.fhsa).forEach(t => {
    portfolioState.holdings.fhsa[t].balance=0;
    portfolioState.holdings.fhsa[t].contributed=0;
  });
  window._fhsaClosed = true;
  syncGameStateFromHoldings();
}

/* Deposit into a specific account + type holding */
function depositToHolding(acc, type, amount) {
  if (amount <= 0) return;
  portfolioState.holdings[acc][type].contributed += amount;
  portfolioState.holdings[acc][type].balance     += amount;
  syncGameStateFromHoldings();
}

/* Total contributed across all holdings in an account */
function totalContributed(acc) {
  return Object.values(portfolioState.holdings[acc])
    .reduce((sum, h) => sum + h.contributed, 0);
}

/* Total balance across all holdings in an account */
function totalBalance(acc) {
  return Object.values(portfolioState.holdings[acc])
    .reduce((sum, h) => sum + h.balance, 0);
}

/* pickLifeEvent — returns event object, does NOT apply it (caller does) */
function pickLifeEvent() {
  if (Math.random() > 0.70) return { effect: 0, title: '', icon: '', type: 'neutral' };
  // Filter events that don't apply to the player's situation
  const livingAtHome = playerSetup.living === 'home';
  const weightedPool = [];
  lifeEvents.forEach((ev, i) => {
    // Skip Rent Increase if player lives at home (no landlord)
    if (livingAtHome && ev.title === 'Rent Increase') return;
    const w = ev.type === 'neutral' ? 3 : 1;
    for (let j = 0; j < w; j++) weightedPool.push(i);
  });
  return lifeEvents[weightedPool[Math.floor(Math.random() * weightedPool.length)]];
}

/* showMonthCard — renders the single monthly card and wires the allocator */
function showMonthCard(d) {
  const card = document.getElementById('month-card');
  document.getElementById('welcome-card').classList.add('hidden');
  card.classList.remove('hidden');

  // If tuition prompt replaced the card's inner HTML, restore it first
  if (!document.getElementById('btn-confirm-month')) {
    restoreMonthCard();
  }

  // Remove any dynamically injected banners/notes from the previous month
  // (ef-covered-note, cc-charged-note, cc-offer-banner, cc-confirm-note)
  card.querySelectorAll(
    '.ef-covered-note, .cc-charged-note, .cc-offer-banner, .cc-confirm-note, .month-card__tax-note, .wants-card'
  ).forEach(el => el.remove());

  // Reset confirm button and rewire listener fresh each month
  const confirmBtn = document.getElementById('btn-confirm-month');
  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Save Allocations ✓';
  const freshBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(freshBtn, confirmBtn);
  freshBtn.addEventListener('click', confirmMonth);

  // Wire inline Next Month button
  const inlineNext = document.getElementById('btn-next-inline');
  if (inlineNext) {
    inlineNext.disabled = true;
    const freshNext = inlineNext.cloneNode(true);
    inlineNext.parentNode.replaceChild(freshNext, inlineNext);
    freshNext.addEventListener('click', () => btnNextMonth.click());
  }
  document.getElementById('month-card-label').textContent = 'Month ' + d.month + ' · ' + ageLabel();

  // Life event callout
  const eventEl = document.getElementById('month-card-event');
  if (d.lifeEvent.effect !== 0) {
    const sign = d.lifeEvent.effect > 0 ? '+' : '';
    eventEl.textContent = `${d.lifeEvent.icon} ${d.lifeEvent.title}: ${sign}${formatCurrency(d.lifeEvent.effect)}`;
    eventEl.className = 'month-card__event month-card__event--' + d.lifeEvent.type;
    eventEl.classList.remove('hidden');
  } else {
    eventEl.classList.add('hidden');
  }

  // Earned section
  const phaseLabel = incomeState.phaseLabel || 'Pay';
  document.getElementById('mrow-job-label').textContent = phaseLabel;
  document.getElementById('mrow-job-val').textContent   = formatCurrency(d.pay);
  const osapRow = document.getElementById('mrow-osap');
  if (d.osapThisMonth > 0) {
    document.getElementById('mrow-osap-val').textContent = formatCurrency(d.osapThisMonth);
    osapRow.classList.remove('hidden');
  } else {
    osapRow.classList.add('hidden');
  }
  document.getElementById('mrow-earned-total').textContent = formatCurrency(d.totalEarned);

  // Owed section
  const b = d.expenseBreakdown;
  const rentRow = document.getElementById('mrow-rent');
  if (b.rent > 0) {
    document.getElementById('mrow-rent-val').textContent = formatCurrency(b.rent);
    rentRow.classList.remove('hidden');
  } else {
    rentRow.classList.add('hidden');
  }
  document.getElementById('mrow-food-val').textContent      = formatCurrency(b.food);
  document.getElementById('mrow-transport-val').textContent = formatCurrency(b.transport);
  document.getElementById('mrow-phone-val').textContent     = formatCurrency(b.phone);
  document.getElementById('mrow-other-val').textContent     = formatCurrency(b.other);

  // Loan repayment row
  const loanRow = document.getElementById('mrow-loan-repayment');
  if (b.loanRepayment > 0) {
    document.getElementById('mrow-loan-repayment-val').textContent = formatCurrency(b.loanRepayment);
    loanRow.classList.remove('hidden');
  } else {
    loanRow.classList.add('hidden');
  }

  // Mortgage row
  const mortgageRow = document.getElementById('mrow-mortgage-pmt');
  if (b.mortgagePayment > 0) {
    document.getElementById('mrow-mortgage-pmt-val').textContent = formatCurrency(b.mortgagePayment);
    mortgageRow.classList.remove('hidden');
  } else {
    mortgageRow.classList.add('hidden');
  }

  document.getElementById('mrow-owed-total').textContent    = formatCurrency(d.expenses);

  // Leftover banner — monthly surplus only
  document.getElementById('mrow-leftover').textContent = formatCurrency(d.leftover);
  allocState.leftover = d.leftover;

  // Cash balance display
  const cashBalEl = document.getElementById('mrow-cash-balance');
  if (cashBalEl) cashBalEl.textContent = formatCurrency(d.cashBalance || 0);

  document.getElementById('alloc-ef').value   = autoContrib.ef   || 0;
  document.getElementById('alloc-hisa').value = autoContrib.hisa || 0;
  document.getElementById('alloc-tfsa').value = autoContrib.tfsa || 0;
  document.getElementById('alloc-rrsp').value = autoContrib.rrsp || 0;
  document.getElementById('alloc-fhsa').value = window._fhsaClosed ? 0 : (autoContrib.fhsa || 0);
  updateAllocRemainder();
  if (window._fhsaClosed) {
    const fg = document.getElementById('alloc-fhsa')?.closest('.alloc-group'); if (fg) fg.style.display='none';
    const afr = document.getElementById('auto-fhsa-row'); if (afr) afr.style.display='none';
    autoContrib.fhsa = 0;
  }

  // Investment growth
  const growthSection = document.getElementById('growth-section');
  const hisaGain = d.hisaInterest || 0;
  const anyGrowth = Math.abs(d.growth.tfsa) + Math.abs(d.growth.rrsp) + Math.abs(d.growth.fhsa) + Math.abs(hisaGain) > 0.5;
  if (anyGrowth) {
    growthSection.classList.remove('hidden');
    showGrowthRow('growth-hisa-row', 'growth-hisa-val', hisaGain, '🏦 HISA');
    showGrowthRow('growth-tfsa-row', 'growth-tfsa-val', d.growth.tfsa, '🌿 TFSA');
    showGrowthRow('growth-rrsp-row', 'growth-rrsp-val', d.growth.rrsp, '🏔️ RRSP');
    showGrowthRow('growth-fhsa-row', 'growth-fhsa-val', d.growth.fhsa, '🏠 FHSA');
  } else {
    growthSection.classList.add('hidden');
  }

  // Tax result if it fired this month
  // (shown as part of event callout — we simply append a note to the card header)
  if (d.taxResult) {
    const taxNote = document.createElement('div');
    taxNote.className = 'month-card__tax-note';
    taxNote.textContent = d.taxResult.summary;
    card.querySelector('.month-card__header').appendChild(taxNote);
  }

  // Credit card offer + statement
  maybeTriggerCCOffer();
  showCCStatementSection(d);
  if (!creditState.statementDue) maybeShowCashCrisis();

  // Wants vs Needs card
  if (!window._ffSkipWants) {
    _wantThisMonth = pickWantItem();
    if (_wantThisMonth) injectWantsCard(_wantThisMonth, card);
  }

  // Emergency fund event callout overlay
  if (d.lifeEventResult && d.lifeEventResult.covered) {
    const efNote = document.createElement('div');
    efNote.className = 'ef-covered-note';
    efNote.textContent = `🛡️ Emergency fund covered the ${formatCurrency(d.lifeEventResult.cost)} ${d.lifeEvent.title} — no cash impact!`;
    card.insertBefore(efNote, card.firstChild);
  } else if (d.lifeEventResult && d.lifeEventResult.chargedToCC) {
    const ccNote = document.createElement('div');
    ccNote.className = 'cc-charged-note';
    ccNote.textContent = `💳 ${formatCurrency(d.lifeEventResult.ccAmount)} of the ${d.lifeEvent.title} was charged to your credit card.`;
    card.insertBefore(ccNote, card.firstChild);
  }

  // Scroll card into view
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showGrowthRow(rowId, valId, gain, label) {
  const row = document.getElementById(rowId);
  const val = document.getElementById(valId);
  if (Math.abs(gain) < 0.5) { row.classList.add('hidden'); return; }
  row.classList.remove('hidden');
  const sign = gain >= 0 ? '+' : '';
  val.textContent = sign + formatCurrency(Math.round(gain));
  val.className = 'month-row__val ' + (gain >= 0 ? 'month-row__val--green' : 'month-row__val--red');
}

function updateAllocRemainder() {
  const ef   = Math.max(0, parseInt(document.getElementById('alloc-ef').value)   || 0);
  const hisa = Math.max(0, parseInt(document.getElementById('alloc-hisa').value)  || 0);
  const tfsa = Math.max(0, parseInt(document.getElementById('alloc-tfsa').value) || 0);
  const rrsp = Math.max(0, parseInt(document.getElementById('alloc-rrsp').value) || 0);
  const fhsa = Math.max(0, parseInt(document.getElementById('alloc-fhsa').value) || 0);
  const total = ef + hisa + tfsa + rrsp + fhsa;
  // Cap against full cash balance — surplus is informational, cash is the real limit
  const cashAvailable = Math.round(gameState.cash);
  const remaining = cashAvailable - total;
  document.getElementById('alloc-cash-remainder').textContent = formatCurrency(Math.max(0, remaining));

  // Show TFSA room hint
  const tfsaRoom = Math.max(0, TFSA_ANNUAL_LIMIT - portfolioState.tfsaYearContrib);
  const tfsaHint = document.getElementById('alloc-tfsa-hint');
  if (tfsaHint) {
    tfsaHint.textContent = tfsaRoom > 0
      ? `${formatCurrency(tfsaRoom)} room left this year`
      : '⚠️ Annual limit reached';
    tfsaHint.style.color = tfsaRoom === 0 ? 'var(--clr-red)' : '';
  }

  // Show FHSA room hint
  const fhsaRoom = Math.min(
    FHSA_ANNUAL_LIMIT  - portfolioState.fhsaYearContrib,
    FHSA_LIFETIME_LIMIT - portfolioState.fhsaTotalContrib
  );
  const fhsaHint = document.getElementById('alloc-fhsa-hint');
  if (fhsaHint) {
    fhsaHint.textContent = fhsaRoom > 0
      ? `${formatCurrency(Math.max(0,fhsaRoom))} room · $40k lifetime cap`
      : '⚠️ Limit reached';
    fhsaHint.style.color = fhsaRoom <= 0 ? 'var(--clr-red)' : '';
  }

  const warning = document.getElementById('alloc-warning');
  const confirmBtn = document.getElementById('btn-confirm-month');
  const overCash  = total > Math.round(gameState.cash);
  const overTfsa  = tfsa > tfsaRoom;
  if (overCash || overTfsa) {
    warning.classList.remove('hidden');
    warning.textContent = overCash
      ? '⚠️ Over your cash balance — reduce to continue.'
      : `⚠️ TFSA contribution exceeds your ${formatCurrency(tfsaRoom)} annual room.`;
    confirmBtn.disabled = true;
  } else {
    warning.classList.add('hidden');
    confirmBtn.disabled = false;
  }
}

function confirmMonth(e) {
  const ef   = Math.max(0, parseInt(document.getElementById('alloc-ef').value)   || 0);
  const hisa = Math.max(0, parseInt(document.getElementById('alloc-hisa').value)  || 0);
  let   tfsa = Math.max(0, parseInt(document.getElementById('alloc-tfsa').value) || 0);
  const rrsp = Math.max(0, parseInt(document.getElementById('alloc-rrsp').value) || 0);
  let   fhsa = Math.max(0, parseInt(document.getElementById('alloc-fhsa').value) || 0);

  // Enforce TFSA annual limit
  const tfsaRoom = Math.max(0, TFSA_ANNUAL_LIMIT - portfolioState.tfsaYearContrib);
  tfsa = Math.min(tfsa, tfsaRoom);

  // Enforce FHSA limits
  const fhsaRoom = Math.min(
    FHSA_ANNUAL_LIMIT  - portfolioState.fhsaYearContrib,
    FHSA_LIFETIME_LIMIT - portfolioState.fhsaTotalContrib
  );
  fhsa = Math.min(fhsa, Math.max(0, fhsaRoom));

  // Clamp to actual cash balance
  const totalAlloc = ef + hisa + tfsa + rrsp + fhsa;
  const scale = totalAlloc > gameState.cash && totalAlloc > 0 ? gameState.cash / totalAlloc : 1;

  const efFinal   = Math.round(ef   * scale);
  const hisaFinal = Math.round(hisa * scale);
  const tfsaFinal = Math.round(tfsa * scale);
  const rrspFinal = Math.round(rrsp * scale);
  const fhsaFinal = Math.round(fhsa * scale);

  const totalAlloc2 = efFinal + hisaFinal + tfsaFinal + rrspFinal + fhsaFinal;
  gameState.emergencyFund += efFinal;
  gameState.hisa          += hisaFinal;
  if (tfsaFinal > 0) depositToHolding('tfsa', portfolioState.tfsaChoice, tfsaFinal);
  if (rrspFinal > 0) depositToHolding('rrsp', portfolioState.rrspChoice, rrspFinal);
  if (fhsaFinal > 0) depositToHolding('fhsa', portfolioState.fhsaChoice, fhsaFinal);
  gameState.cash -= (efFinal + hisaFinal + tfsaFinal + rrspFinal + fhsaFinal);

  // Track how much was saved this year (for year-end reflection)
  const totalSavedThisMonth = efFinal + hisaFinal + tfsaFinal + rrspFinal + fhsaFinal;
  if (typeof trackYearlyInvested === 'function') trackYearlyInvested(totalSavedThisMonth);

  // Reset year contribution counters at the START of a new year (month 1, 13, 25, ...)
  // so contributions made in month 12 (final month of the year) are still counted correctly.
  if ((gameState.month - 1) % 12 === 0) {
    portfolioState.tfsaYearContrib = 0;
    portfolioState.fhsaYearContrib = 0;
  }

  portfolioState.tfsaYearContrib += tfsaFinal;
  portfolioState.fhsaYearContrib += fhsaFinal;
  portfolioState.fhsaTotalContrib += fhsaFinal;

  if (rrspFinal > 0) trackMonthlyTaxables(0, rrspFinal);

  updateDashboard();
  updateAccountsDisplay();

  const btn = document.getElementById('btn-confirm-month');
  if (btn) { btn.disabled = true; btn.textContent = '✓ Saved'; }
  btnNextMonth.disabled = false;
  const inlineNext2 = document.getElementById('btn-next-inline');
  if (inlineNext2) inlineNext2.disabled = false;
}

function updateAccountsDisplay() {
  const el = (id) => document.getElementById(id);
  if (el('display-ef'))   el('display-ef').textContent   = formatCurrency(Math.round(gameState.emergencyFund));
  if (el('display-hisa')) el('display-hisa').textContent = formatCurrency(Math.round(gameState.hisa));
  if (el('display-tfsa')) el('display-tfsa').textContent = formatCurrency(Math.round(gameState.tfsa));
  if (el('display-rrsp')) el('display-rrsp').textContent = formatCurrency(Math.round(gameState.rrsp));
  if (el('display-fhsa')) el('display-fhsa').textContent = formatCurrency(Math.round(gameState.fhsa));
}

function initInvestSystem() {
  // Reset all holdings
  ['tfsa','rrsp','fhsa'].forEach(acc => {
    Object.keys(INVEST_TYPES).forEach(type => {
      portfolioState.holdings[acc][type] = { contributed: 0, balance: 0 };
    });
  });
  portfolioState.tfsaYearContrib  = 0;
  portfolioState.fhsaYearContrib  = 0;
  portfolioState.fhsaTotalContrib = 0;
  portfolioState.tfsaChoice = 'index';
  portfolioState.rrspChoice = 'index';
  portfolioState.fhsaChoice = 'index';
  portfolioState.lastGain   = { tfsa: 0, rrsp: 0, fhsa: 0 };
  portfolioState.growthLog  = [];
  investState.lastTfsaGain  = 0;
  investState.lastRrspGain  = 0;
  investState.lastFhsaGain  = 0;
  updateAccountsDisplay();
}

// Wire allocator inputs and confirm button
document.getElementById('alloc-ef').addEventListener('input', updateAllocRemainder);
document.getElementById('alloc-hisa').addEventListener('input', updateAllocRemainder);
document.getElementById('alloc-tfsa').addEventListener('input', updateAllocRemainder);
document.getElementById('alloc-rrsp').addEventListener('input', updateAllocRemainder);
document.getElementById('alloc-fhsa').addEventListener('input', updateAllocRemainder);



/* ── RISK TOGGLE BUTTONS ── */
document.querySelectorAll('.risk-toggle-btns').forEach(group => {
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('.risk-btn');
    if (!btn) return;
    const account = group.dataset.account;  // 'tfsa' | 'rrsp' | 'fhsa'
    const type    = btn.dataset.type;        // 'index' | 'stocks' | 'crypto'
    // Update investState
    investState[`${account}Choice`] = type;
    // Update button styles
    group.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('risk-btn--active'));
    btn.classList.add('risk-btn--active');
    console.log(`[Risk] ${account.toUpperCase()} → ${type}`);
  });
});


/* ──────────────────────────────────────────────────────────
   ══════════════════════════════════════════════════════════
   TAX SYSTEM — Canadian-style, fires every 12 months
   ══════════════════════════════════════════════════════════

   TRIGGER: gameState.month % 12 === 0
   Month 12  → Year 1 filing ✅
   Month 24  → Year 2 filing ✅
   Month 13  → no filing     ❌

   FORMULAS:
     taxableIncome = max(0, grossIncome - rrspDeductions)
     taxOwed       = taxableIncome × TAX_RATE (20%)
     taxPrepaid    = grossIncome × TAX_RATE × 0.5  (50% withheld)
     taxDue        = taxOwed - taxPrepaid
     cash         -= taxDue  (positive = owe more; negative = refund)
   ────────────────────────────────────────────────────────── */

const TAX_RATE = 0.20;

const taxState = {
  yearGrossIncome:  0,
  yearRrspContribs: 0,
  lastTaxDue:       0,
  totalTaxPaid:     0,
};

function trackMonthlyTaxables(income, rrspContrib) {
  taxState.yearGrossIncome  += income;
  taxState.yearRrspContribs += rrspContrib;
}

/**
 * Process annual tax filing.
 * Returns { html: string, summary: string }
 */
function processTaxYear() {
  const gross   = Math.round(taxState.yearGrossIncome);
  const rrspDed = Math.round(taxState.yearRrspContribs);
  const taxable = Math.max(0, gross - rrspDed);
  // taxOwed = taxable × TAX_RATE
  const taxOwed = Math.round(taxable * TAX_RATE);
  // prepaid = 85% of taxOwed — simulates payroll withholding.
  // This means reconciliation is a small top-up or small refund,
  // not a large surprise. 85% chosen so RRSP users reliably get
  // a refund while non-RRSP users owe a modest amount.
  const prepaid = Math.round(taxOwed * 0.85);
  // taxDue = balance owed after accounting for prepaid amounts
  const taxDue  = taxOwed - prepaid;
  const isRefund = taxDue < 0;

  // Apply to cash (net worth recalculated by recalcNetWorth)
  gameState.cash -= taxDue;

  if (taxDue > 0) taxState.totalTaxPaid += taxDue;
  taxState.lastTaxDue = taxDue;

  const yearNum = Math.floor(gameState.month / 12);

  // Reset accumulators for next year
  taxState.yearGrossIncome  = 0;
  taxState.yearRrspContribs = 0;

  const rrspRow = rrspDed > 0
    ? `<div class="tax-row"><span>🏔️ RRSP Deduction</span><span class="tax-row__val tax-row__val--saving">-${formatCurrency(rrspDed)}</span></div>`
    : `<div class="tax-row"><span>🏔️ RRSP Deduction</span><span class="tax-row__val tax-row__val--zero">None</span></div>`;

  const rrspTip = rrspDed > 0
    ? `RRSP contributions saved you ${formatCurrency(Math.round(rrspDed * TAX_RATE))} in taxes this year.`
    : `Contributing to your RRSP would have reduced your taxable income.`;

  const netLabel  = isRefund ? 'Refund' : 'Balance Due';
  const netClass  = isRefund ? 'tax-row__val--green' : 'tax-row__val--red';
  const netAmt    = isRefund ? `+${formatCurrency(Math.abs(taxDue))}` : formatCurrency(-Math.abs(taxDue));
  const cardClass = isRefund ? 'feed-card--tax-refund' : 'feed-card--tax-due';
  const cardTitle = isRefund ? '🇨🇦 Tax Refund Received' : '🇨🇦 Tax Bill Due';

  const html = `
    <div class="feed-card ${cardClass}">
      <span class="feed-card__badge">Annual Tax Filing · Year ${yearNum}</span>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span class="feed-card__title">${cardTitle}</span>
        <span style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:${isRefund ? 'var(--clr-green)' : 'var(--clr-red)'};">${netAmt}</span>
      </div>
      <div class="tax-breakdown">
        <div class="tax-row"><span>💰 Gross Income</span><span class="tax-row__val">${formatCurrency(gross)}</span></div>
        ${rrspRow}
        <div class="tax-row tax-row--divider"><span>Taxable Income</span><span class="tax-row__val">${formatCurrency(taxable)}</span></div>
        <div class="tax-row"><span>Tax at ${(TAX_RATE*100).toFixed(0)}%</span><span class="tax-row__val">${formatCurrency(taxOwed)}</span></div>
        <div class="tax-row"><span>Tax Prepaid</span><span class="tax-row__val tax-row__val--saving">-${formatCurrency(prepaid)}</span></div>
        <div class="tax-row tax-row--highlight"><span>${netLabel}</span><span class="tax-row__val ${netClass}">${netAmt}</span></div>
      </div>
      <p class="tax-tip">💡 ${rrspTip}</p>
    </div>`;

  const summary = `${isRefund ? '🇨🇦 Tax refund' : '🇨🇦 Tax paid'}: ${formatCurrency(Math.abs(taxDue))}`;
  addHistoryTaxMarker(yearNum, taxDue, isRefund);

  console.log(`[Tax] Year ${yearNum} — Gross:${formatCurrency(gross)} RRSP:-${formatCurrency(rrspDed)} Taxable:${formatCurrency(taxable)} Owed:${formatCurrency(taxOwed)} Prepaid:${formatCurrency(prepaid)} ${isRefund?'Refund':'Due'}:${formatCurrency(Math.abs(taxDue))}`);

  return { html, summary };
}

function initTaxSystem() {
  taxState.yearGrossIncome  = 0;
  taxState.yearRrspContribs = 0;
  taxState.lastTaxDue       = 0;
  taxState.totalTaxPaid     = 0;
}

/* ──────────────────────────────────────────────────────────
   ══════════════════════════════════════════════════════════
   HOT TIP SYSTEM
   A bank of 30 financial literacy tips. One fires randomly
   roughly every 3 months (33% chance each month after the
   first). The toast auto-dismisses after 8 seconds or when
   the player clicks ✕. Each tip can only show once per
   session (no repeats until all tips are exhausted).
   ══════════════════════════════════════════════════════════
   ────────────────────────────────────────────────────────── */

/* ── TIP BANK ── */
const hotTips = [
  // Investments
  { icon: '🌿', text: 'TFSA gains are completely tax-free — you keep every dollar your investments earn.' },
  { icon: '🏔️', text: 'RRSP contributions reduce your taxable income, which lowers your annual tax bill.' },
  { icon: '📊', text: 'Index funds spread risk across hundreds of companies — lower risk, steady growth.' },
  { icon: '📈', text: 'Stocks can lose value in the short term. Only invest money you won\'t need soon.' },
  { icon: '₿',  text: 'Crypto is high-risk and highly volatile. Never invest more than you can afford to lose.' },
  { icon: '⏰', text: 'The earlier you invest, the more time compound growth has to work in your favour.' },
  { icon: '🎯', text: 'Diversifying between Index Funds, Stocks, and safer assets reduces your overall risk.' },

  // Debt & Loans
  { icon: '🎓', text: 'Student loans accumulate 5% annual interest after graduation — pay them down early if you can.' },
  { icon: '💸', text: 'Paying tuition from cash saves you years of interest — but only if your emergency fund is intact.' },
  { icon: '🏦', text: 'Carrying debt reduces your net worth. Each payment you make improves your financial position.' },
  { icon: '📉', text: 'Interest on debt is money working against you. Interest on savings is money working for you.' },

  // Budgeting
  { icon: '🏠', text: 'Needs like rent and food should ideally stay under 50% of your take-home income.' },
  { icon: '🎮', text: 'Wants are not the enemy — but unchecked discretionary spending is the most common budget leak.' },
  { icon: '💎', text: 'Pay yourself first: allocate to savings before deciding what\'s left to spend.' },
  { icon: '📋', text: 'A budget isn\'t about restriction — it\'s about telling your money where to go instead of wondering where it went.' },
  { icon: '🧮', text: 'Even saving $100/month adds up to $1,200 per year — and that\'s before investment growth.' },

  // Emergency fund
  { icon: '🛡️', text: 'Financial experts recommend keeping 3–6 months of expenses in an emergency fund.' },
  { icon: '🔧', text: 'Unexpected expenses — car repairs, medical bills — happen to everyone. An emergency fund makes them manageable.' },
  { icon: '☂️', text: 'Your savings account is your financial umbrella. Build it before you need it.' },

  // Tax
  { icon: '🇨🇦', text: 'The CRA taxes income — but RRSP contributions come off the top before tax is calculated.' },
  { icon: '📄', text: 'A tax refund isn\'t a bonus — it\'s money you overpaid. Investing your refund is a smart move.' },
  { icon: '📊', text: 'The more you contribute to your RRSP this year, the smaller your tax bill next spring.' },

  // Income & Career
  { icon: '💼', text: 'A side hustle adds income and reduces your dependence on a single employer.' },
  { icon: '🎓', text: 'Higher education costs more upfront, but typically leads to significantly higher lifetime earnings.' },
  { icon: '🔨', text: 'Trades apprentices earn while they learn — often with lower debt than university graduates.' },
  { icon: '🏢', text: 'Workplace benefits like pension matching are part of your total compensation — factor them in.' },

  // Net worth
  { icon: '📈', text: 'Net worth = assets minus liabilities. Growing savings and shrinking debt both improve it.' },
  { icon: '🌱', text: 'Small consistent actions — saving monthly, repaying debt — compound into significant wealth over time.' },
  { icon: '💡', text: 'Financial literacy is a skill. The more you understand money, the more control you have over it.' },
  { icon: '🍁', text: 'Canada\'s registered accounts (TFSA, RRSP) are powerful tools — most Canadians underuse them.' },
];

/* ── TIP STATE ── */
const tipState = {
  remaining:     [],    // tip indices not yet shown this session
  dismissTimer:  null,  // auto-dismiss timeout reference
};

/* ── TIP DOM REFERENCES ── */
const tipToast = document.getElementById('tip-toast');
const tipText  = document.getElementById('tip-text');
const tipClose = document.getElementById('tip-close');

/* ──────────────────────────────────────────────────────────
   TIP: showTip(tip)
   Populates the toast with the given tip and slides it in.
   Auto-dismisses after 8 seconds.
──────────────────────────────────────────────────────────── */
function showTip(tip) {
  // Clear any running dismiss timer
  if (tipState.dismissTimer) clearTimeout(tipState.dismissTimer);

  // Set content
  tipText.textContent = `${tip.icon}  ${tip.text}`;

  // Slide in
  tipToast.classList.add('tip-toast--visible');

  // Auto-dismiss after 8 seconds
  tipState.dismissTimer = setTimeout(dismissTip, 8000);
}

/* ──────────────────────────────────────────────────────────
   TIP: dismissTip()
   Slides the toast out and clears the timer.
──────────────────────────────────────────────────────────── */
function dismissTip() {
  tipToast.classList.remove('tip-toast--visible');
  if (tipState.dismissTimer) {
    clearTimeout(tipState.dismissTimer);
    tipState.dismissTimer = null;
  }
}

/* ──────────────────────────────────────────────────────────
   TIP: maybeTriggerTip()
   Called each month. 33% chance of showing a tip.
   Skips month 1 to avoid overwhelming the player at start.
   Uses a shuffle-bag approach so no tip repeats until all
   have been shown (then the bag refills).

   Probability formula:
     Math.random() < TIP_CHANCE  →  show a tip
     TIP_CHANCE = 0.33 (roughly once every 3 months)
──────────────────────────────────────────────────────────── */
const TIP_CHANCE = 0.33;

function maybeTriggerTip() {
  // Don't show on month 1 (player is getting oriented)
  if (gameState.month <= 1) return;

  // Roll for tip
  if (Math.random() >= TIP_CHANCE) return;

  // Refill the bag if exhausted
  if (tipState.remaining.length === 0) {
    tipState.remaining = hotTips.map((_, i) => i);
  }

  // Pick a random index from the remaining pool
  const poolIndex = Math.floor(Math.random() * tipState.remaining.length);
  const tipIndex  = tipState.remaining.splice(poolIndex, 1)[0];

  showTip(hotTips[tipIndex]);
  console.log(`[Hot Tip] "${hotTips[tipIndex].text.slice(0, 50)}…"`);
}

/* ── Close button listener ── */
tipClose.addEventListener('click', dismissTip);

/* END OF HOT TIP SYSTEM
──────────────────────────────────────────────────────────── */



/* ══════════════════════════════════════════════════════════════════
   JOB OFFER SYSTEM
   Fires once on graduation. Player picks from 3-4 career-specific
   job offers with different salary, stability, and bonus traits.
   ══════════════════════════════════════════════════════════════════ */

const jobOfferState = {
  offered:            false,
  accepted:           false,
  pendingTransition:  false,
  chosenJob:          null,
  monthsAtJob:        0,
  promotionEligible:  false,
  yearsWorked:        0,
  reviewPending:      false,   // annual review interstitial flag
  layoffActive:       false,   // player is in a layoff income penalty
  layoffMonthsLeft:   0,       // months remaining at reduced income
  layoffOriginalIncome: 0,     // income before layoff to restore
};

/* Per-career job offer tables */
const jobOffers = {
  premed:   [
    { id: 'gp',        title: 'Family Doctor (GP)',    icon: '🩺', salary: 7200,  stability: 'high',   bonusChance: 0.10, desc: 'Steady clinic work. Strong income, predictable hours, loyal patients. The backbone of Canadian healthcare.' },
    { id: 'specialist',title: 'Hospital Specialist',   icon: '🏥', salary: 9500,  stability: 'high',   bonusChance: 0.20, desc: 'Higher pay, longer residency. Demanding schedule but top-tier compensation and career prestige.' },
    { id: 'locum',     title: 'Locum / Contract Doc',  icon: '🚑', salary: 8500,  stability: 'medium', bonusChance: 0.05, desc: 'Fill-in physician across clinics and hospitals. Variable schedule — high freedom, less predictability.' },
  ],
  cs:       [
    { id: 'startup',   title: 'Startup Engineer',      icon: '🚀', salary: 6200,  stability: 'low',    bonusChance: 0.35, desc: 'Equity and upside potential. Fast-moving, high risk of layoff, but big wins if the company takes off.' },
    { id: 'tech',      title: 'Tech Company (Mid)',     icon: '💻', salary: 5500,  stability: 'medium', bonusChance: 0.25, desc: 'Solid salary, good benefits, RRSP matching. Strong growth trajectory with performance reviews.' },
    { id: 'gov',       title: 'Government IT',         icon: '🏛️', salary: 4400,  stability: 'high',   bonusChance: 0.05, desc: 'Defined pension, job security, work-life balance. Lower ceiling but bulletproof stability.' },
    { id: 'freelance', title: 'Freelance / Consulting', icon: '🧑‍💻', salary: 5800,  stability: 'low',    bonusChance: 0.15, desc: 'Set your own rates. High income variance — feast and famine months. No benefits, full tax burden.' },
  ],
  business: [
    { id: 'finance',   title: 'Finance Analyst',       icon: '📊', salary: 4200,  stability: 'medium', bonusChance: 0.30, desc: 'Bay Street adjacent. High bonus potential, demanding hours, clear path to senior roles.' },
    { id: 'marketing', title: 'Marketing Manager',     icon: '📣', salary: 3600,  stability: 'medium', bonusChance: 0.15, desc: 'Creative and strategic. Mid-range salary with commission potential and brand-building opportunities.' },
    { id: 'startup',   title: 'Operations at Startup', icon: '⚙️', salary: 3800,  stability: 'low',    bonusChance: 0.25, desc: 'Wear every hat. Hectic but educational. Equity upside if the bet pays off.' },
    { id: 'gov',       title: 'Policy / Public Service',icon: '🏛️', salary: 3200,  stability: 'high',   bonusChance: 0.05, desc: 'Defined pension, excellent benefits, meaningful work. Slower income growth but rock-solid security.' },
  ],
  arts:     [
    { id: 'media',     title: 'Media / Journalism',    icon: '📰', salary: 2600,  stability: 'low',    bonusChance: 0.10, desc: 'Competitive and passion-driven. Variable pay, contract work is common. Rewarding if you love the craft.' },
    { id: 'ngo',       title: 'Non-Profit / NGO',      icon: '🤝', salary: 2800,  stability: 'medium', bonusChance: 0.05, desc: 'Mission-driven work. Modest salary but strong sense of purpose and work-life balance.' },
    { id: 'education', title: 'Teacher / Educator',    icon: '🍎', salary: 3200,  stability: 'high',   bonusChance: 0.05, desc: 'Summers off, defined pension, genuine impact. Salary climbs slowly but reliably with seniority.' },
    { id: 'comms',     title: 'Corporate Comms / PR',  icon: '💬', salary: 3400,  stability: 'medium', bonusChance: 0.15, desc: 'Writing and strategy for businesses. Better pay than media with more stability and growth room.' },
  ],
  nursing:  [
    { id: 'hospital',  title: 'Hospital RN',           icon: '🏥', salary: 4800,  stability: 'high',   bonusChance: 0.10, desc: 'Core nursing work. Shift premiums, overtime available, strong union protection and benefits.' },
    { id: 'ltc',       title: 'Long-Term Care',        icon: '🧓', salary: 4200,  stability: 'high',   bonusChance: 0.05, desc: 'Steady, meaningful work with vulnerable patients. Good benefits, less acute stress than ER.' },
    { id: 'travel',    title: 'Travel Nurse',          icon: '✈️', salary: 5400,  stability: 'low',    bonusChance: 0.10, desc: 'Short-term contracts across Canada. Top pay and housing allowances, but no long-term security.' },
  ],
  it:       [
    { id: 'sysadmin',  title: 'Systems Administrator', icon: '🖥️', salary: 3800,  stability: 'high',   bonusChance: 0.10, desc: 'Keep the lights on. Stable, in-demand, often comes with good benefits and overtime opportunities.' },
    { id: 'dev',       title: 'Junior Developer',      icon: '👨‍💻', salary: 4000,  stability: 'medium', bonusChance: 0.20, desc: 'Get your foot in the door. Upside potential with experience; fast-growing field across all sectors.' },
    { id: 'support',   title: 'IT Support / Helpdesk', icon: '🛠️', salary: 3200,  stability: 'high',   bonusChance: 0.05, desc: 'Entry-level but stable. Good experience base for moving into higher IT roles.' },
  ],
  design:   [
    { id: 'agency',    title: 'Design Agency',         icon: '🎨', salary: 3000,  stability: 'medium', bonusChance: 0.15, desc: 'Fast-paced client work. Portfolio grows quickly. Competitive but rewarding if you thrive under pressure.' },
    { id: 'inhouse',   title: 'In-House Designer',     icon: '🖌️', salary: 3200,  stability: 'high',   bonusChance: 0.10, desc: 'One brand, deep work. More stability, steady hours, and a clear sense of ownership.' },
    { id: 'freelance', title: 'Freelance Designer',    icon: '💡', salary: 2800,  stability: 'low',    bonusChance: 0.10, desc: 'Work for yourself. High freedom, variable income, and the need to hustle for every project.' },
  ],
  police:   [
    { id: 'municipal', title: 'Municipal Police',      icon: '🚔', salary: 4800,  stability: 'high',   bonusChance: 0.10, desc: 'Local policing. Defined pension, overtime premiums, shift differentials. Demanding but financially rewarding.' },
    { id: 'opp',       title: 'OPP / Provincial',      icon: '🚁', salary: 5200,  stability: 'high',   bonusChance: 0.10, desc: 'Provincial policing across Ontario. Top salary band, excellent benefits, and career variety.' },
    { id: 'security',  title: 'Private Security/Corp', icon: '🔒', salary: 3600,  stability: 'medium', bonusChance: 0.05, desc: 'Lower barrier to entry, stepping stone to sworn officer roles. Steady income while building experience.' },
  ],
  electrician: [
    { id: 'contractor',title: 'Electrical Contractor', icon: '⚡', salary: 5400,  stability: 'medium', bonusChance: 0.20, desc: 'Independent contractor work. Strong hourly rate and project bonuses. Income varies with demand.' },
    { id: 'industrial',title: 'Industrial Electrician',icon: '🏭', salary: 5800,  stability: 'high',   bonusChance: 0.10, desc: 'Plant and factory work. Steady shifts, overtime available, union-negotiated wages and pension.' },
    { id: 'residential',title:'Residential Journeyman',icon: '🏠', salary: 4800,  stability: 'high',   bonusChance: 0.10, desc: 'New builds and renovations. Consistent demand in the housing market, good work-life balance.' },
  ],
  carpenter: [
    { id: 'framing',   title: 'Framing Carpenter',     icon: '🪚', salary: 4400,  stability: 'medium', bonusChance: 0.15, desc: 'Core construction work. Fast-paced, physical, high demand on active build sites.' },
    { id: 'finishing', title: 'Finishing Carpenter',   icon: '✨', salary: 4800,  stability: 'high',   bonusChance: 0.10, desc: 'Trim, cabinets, custom millwork. Higher skill, higher pay, more stable year-round demand.' },
    { id: 'selfemploy',title: 'Self-Employed Contractor',icon:'🔨', salary: 5000,  stability: 'low',    bonusChance: 0.20, desc: 'Your own business. High upside when busy, dry spells in off-seasons. Total freedom.' },
  ],
  plumber:  [
    { id: 'service',   title: 'Service Plumber',       icon: '🔧', salary: 5200,  stability: 'high',   bonusChance: 0.15, desc: 'Residential and commercial service calls. High demand, good hourly, emergency call premiums.' },
    { id: 'industrial',title: 'Industrial Plumber',    icon: '🏭', salary: 5600,  stability: 'high',   bonusChance: 0.10, desc: 'Large-scale plant and facility work. Steady shifts, union wages, strong pension contributions.' },
    { id: 'own',       title: 'Own Plumbing Business', icon: '💼', salary: 6000,  stability: 'low',    bonusChance: 0.25, desc: 'Highest earning potential but you manage everything — marketing, invoices, and slow months.' },
  ],
  mechanic: [
    { id: 'dealer',    title: 'Dealership Technician', icon: '🏎️', salary: 4000,  stability: 'high',   bonusChance: 0.15, desc: 'Flat-rate pay at an OEM dealer. Consistent work, manufacturer training, benefits package.' },
    { id: 'independent',title:'Independent Shop',      icon: '🔩', salary: 3800,  stability: 'medium', bonusChance: 0.10, desc: 'Neighbourhood garage. Good variety of work, loyal clientele, flexible hours.' },
    { id: 'heavy',     title: 'Heavy Equipment Tech',  icon: '🚛', salary: 5000,  stability: 'high',   bonusChance: 0.10, desc: 'Mining, forestry, and construction equipment. Top-paying mechanic specialty, often remote or fly-in.' },
  ],
  retail:   [
    { id: 'supervisor',title: 'Shift Supervisor',      icon: '🏷️', salary: 2600,  stability: 'high',   bonusChance: 0.05, desc: 'Step up from floor staff. Small pay bump, leadership experience, path to store management.' },
    { id: 'buyer',     title: 'Retail Buyer / Planner',icon: '📦', salary: 3200,  stability: 'medium', bonusChance: 0.15, desc: 'Behind-the-scenes merchandise planning. Office-based, career growth, better compensation.' },
    { id: 'manager',   title: 'Store Manager',         icon: '🏪', salary: 3600,  stability: 'high',   bonusChance: 0.20, desc: 'Run the whole operation. Bonus tied to store performance, full benefits, genuine leadership role.' },
  ],
  service:  [
    { id: 'fooh',      title: 'Front-of-House Manager',icon: '🍽️', salary: 2800,  stability: 'medium', bonusChance: 0.15, desc: 'Tips plus salary. Busy nights, great people skills, path to GM or hospitality management.' },
    { id: 'corporate', title: 'Corporate Catering',    icon: '🍱', salary: 3200,  stability: 'high',   bonusChance: 0.10, desc: 'Weekday business catering. Predictable hours, better pay, no late nights.' },
    { id: 'hotel',     title: 'Hotel Operations',      icon: '🏨', salary: 3000,  stability: 'high',   bonusChance: 0.10, desc: 'Front desk to management track. Growing hospitality sector, travel perks, benefits.' },
  ],
  office:   [
    { id: 'admin',     title: 'Office Administrator',  icon: '🗂️', salary: 3000,  stability: 'high',   bonusChance: 0.05, desc: 'The glue of any organisation. Steady hours, full benefits, reliable year-end review.' },
    { id: 'coordinator',title:'Project Coordinator',   icon: '📋', salary: 3400,  stability: 'high',   bonusChance: 0.10, desc: 'Manage timelines and people. Path to PM roles. Strong demand across every sector.' },
    { id: 'sales',     title: 'Inside Sales Rep',      icon: '📞', salary: 3200,  stability: 'medium', bonusChance: 0.30, desc: 'Base plus commission. Uncapped earnings if you hit targets. High variance month-to-month.' },
  ],
  warehouse:[
    { id: 'lead',      title: 'Warehouse Lead Hand',   icon: '📦', salary: 2900,  stability: 'high',   bonusChance: 0.08, desc: 'Supervise a small crew. Small bump in pay, leadership experience, path to supervisor.' },
    { id: 'logistics', title: 'Logistics Coordinator', icon: '🚛', salary: 3400,  stability: 'high',   bonusChance: 0.10, desc: 'Move from the floor to the office. Plan shipments, manage vendors, strong growth path.' },
    { id: 'driver',    title: 'Commercial Driver',     icon: '🚚', salary: 3600,  stability: 'medium', bonusChance: 0.10, desc: 'Class A or DZ licence opens doors. Good hourly, overtime available, independence on the road.' },
  ],
  // New university programs
  medicine: [
    { id: 'family',     title: 'Family Physician',       icon: '🩺', salary: 12000, stability: 'high',   bonusChance: 0.10, desc: 'Stable clinic work, loyal patients. The most needed specialty in Canada.' },
    { id: 'specialist', title: 'Hospital Specialist',    icon: '🏥', salary: 16000, stability: 'high',   bonusChance: 0.15, desc: 'Cardiology, surgery, radiology. Highest pay, most demanding training.' },
    { id: 'locum',      title: 'Locum Physician',        icon: '🚑', salary: 14000, stability: 'medium', bonusChance: 0.08, desc: 'Fill-in work across clinics. High hourly rate, flexible schedule.' },
  ],
  uninursing: [
    { id: 'hospital',   title: 'Hospital RN (BScN)',     icon: '🏥', salary: 5200,  stability: 'high',   bonusChance: 0.10, desc: 'Acute care with shift premiums and overtime available.' },
    { id: 'np',         title: 'Nurse Practitioner',     icon: '🩺', salary: 6800,  stability: 'high',   bonusChance: 0.08, desc: 'Advanced practice with prescribing authority. Growing demand across Canada.' },
    { id: 'travel',     title: 'Travel Nurse',           icon: '✈️', salary: 6200,  stability: 'low',    bonusChance: 0.10, desc: 'Contract nursing across Canada. Top pay with housing allowances.' },
  ],
  healthsci: [
    { id: 'research',   title: 'Health Research Coord',  icon: '🔬', salary: 3400,  stability: 'high',   bonusChance: 0.08, desc: 'Clinical trials and public health research. Pathway to graduate school.' },
    { id: 'admin',      title: 'Health Admin / Policy',  icon: '📋', salary: 3600,  stability: 'high',   bonusChance: 0.08, desc: 'Hospital and government health management roles.' },
    { id: 'kinesio',    title: 'Kinesiologist / Rehab',  icon: '🏃', salary: 3200,  stability: 'medium', bonusChance: 0.10, desc: 'Exercise science and rehabilitation. Private clinics and corporate wellness.' },
  ],
  engineering: [
    { id: 'consulting', title: 'Engineering Consultant', icon: '⚙️', salary: 5800,  stability: 'medium', bonusChance: 0.20, desc: 'Project-based work with variety. Strong billing rates and broad career exposure.' },
    { id: 'government', title: 'Government Engineer',    icon: '🏛️', salary: 5000,  stability: 'high',   bonusChance: 0.05, desc: 'Infrastructure and public works. Pension, stability, and P.Eng pathway.' },
    { id: 'tech',       title: 'Software / Systems Eng', icon: '💻', salary: 6000,  stability: 'medium', bonusChance: 0.25, desc: 'Cross-discipline tech roles in high demand. Strong remote work options.' },
  ],
  law: [
    { id: 'corporate',  title: 'Corporate Lawyer',       icon: '⚖️', salary: 8000,  stability: 'medium', bonusChance: 0.30, desc: 'Bay Street or regional firms. High pressure, high pay, clear partnership track.' },
    { id: 'crown',      title: 'Crown / Public Sector',  icon: '🏛️', salary: 5500,  stability: 'high',   bonusChance: 0.05, desc: 'Crown attorney or government legal. Work-life balance and pension.' },
    { id: 'family_law', title: 'Family / Criminal Law',  icon: '👨‍⚖️', salary: 5000,  stability: 'medium', bonusChance: 0.15, desc: 'Community-facing law. Meaningful work, moderate income, often self-employed.' },
  ],
  education: [
    { id: 'elementary', title: 'Elementary Teacher',     icon: '🍎', salary: 4000,  stability: 'high',   bonusChance: 0.05, desc: 'K-8 teaching. Union protection, pension, summers off, strong job security.' },
    { id: 'secondary',  title: 'Secondary Teacher',      icon: '📚', salary: 4200,  stability: 'high',   bonusChance: 0.05, desc: 'High school teaching. Subject specialization and extracurricular coaching roles.' },
    { id: 'spec_ed',    title: 'Special Education',      icon: '🌟', salary: 4400,  stability: 'high',   bonusChance: 0.05, desc: 'High demand and often premium pay. Deeply impactful work with students who need extra support.' },
  ],
  socialwork: [
    { id: 'children',   title: 'Child Welfare Worker',   icon: '🧒', salary: 3200,  stability: 'high',   bonusChance: 0.05, desc: 'CAS and child protection. Emotionally demanding but critically important.' },
    { id: 'hospital',   title: 'Hospital Social Worker', icon: '🏥', salary: 3600,  stability: 'high',   bonusChance: 0.05, desc: 'Supporting patients and families through health crises. Strong demand.' },
    { id: 'community',  title: 'Community Worker / NGO', icon: '🤝', salary: 2900,  stability: 'medium', bonusChance: 0.05, desc: 'Non-profit and community health work. Purpose-driven with modest pay.' },
  ],
  // New college programs
  colnursing: [
    { id: 'hospital',   title: 'Hospital RPN/RN',        icon: '🏥', salary: 4400,  stability: 'high',   bonusChance: 0.10, desc: 'Core nursing on hospital floors. Shift premiums and overtime available.' },
    { id: 'ltc',        title: 'Long-Term Care RPN',     icon: '🧓', salary: 3900,  stability: 'high',   bonusChance: 0.05, desc: 'Resident-focused care. Steady hours and strong union protection.' },
    { id: 'agency',     title: 'Travel / Agency Nurse',  icon: '✈️', salary: 5200,  stability: 'low',    bonusChance: 0.10, desc: 'Short contracts across Ontario or Canada. Top pay with housing support.' },
  ],
  paramedic: [
    { id: 'primary',    title: 'Primary Care Paramedic', icon: '🚑', salary: 3800,  stability: 'high',   bonusChance: 0.10, desc: 'Front-line emergency response. Shift work, union wages, overtime available.' },
    { id: 'advanced',   title: 'Advanced Care Para.',    icon: '💊', salary: 4600,  stability: 'high',   bonusChance: 0.10, desc: 'Higher acuity interventions. Additional training required, higher pay.' },
    { id: 'dispatcher', title: 'EMS Dispatcher / Coord', icon: '📡', salary: 3400,  stability: 'high',   bonusChance: 0.05, desc: 'Coordination role with regular hours. Less physically demanding.' },
  ],
  accounting: [
    { id: 'bookkeeper', title: 'Bookkeeper / Payroll',   icon: '🧾', salary: 3000,  stability: 'high',   bonusChance: 0.05, desc: 'In-demand across every business. Steady, predictable work.' },
    { id: 'cpa_path',   title: 'CPA Articling Student',  icon: '📊', salary: 3400,  stability: 'high',   bonusChance: 0.15, desc: 'Path to full CPA designation. Salary grows significantly after certification.' },
    { id: 'tax_prep',   title: 'Tax Preparer / Firm',    icon: '📋', salary: 2800,  stability: 'medium', bonusChance: 0.10, desc: 'Seasonal peaks but year-round work. Good foot in the door for finance.' },
  ],
  culinary: [
    { id: 'line_cook',  title: 'Line Cook',              icon: '🍳', salary: 2400,  stability: 'medium', bonusChance: 0.10, desc: 'Fast-paced kitchen work. Long hours but tips and overtime help.' },
    { id: 'sous_chef',  title: 'Sous Chef',              icon: '👨‍🍳', salary: 3200,  stability: 'medium', bonusChance: 0.15, desc: 'Second in command of a kitchen. Strong leadership experience.' },
    { id: 'catering',   title: 'Corporate Catering',     icon: '🍱', salary: 2900,  stability: 'high',   bonusChance: 0.10, desc: 'More predictable hours than restaurants. Steady corporate accounts.' },
  ],
  ece: [
    { id: 'centre',     title: 'Licensed Childcare',     icon: '🧒', salary: 2500,  stability: 'high',   bonusChance: 0.05, desc: 'Licensed daycare or kindergarten. Subsidized childcare expansion creating strong demand.' },
    { id: 'school',     title: 'School ECE / EA',        icon: '🍎', salary: 2700,  stability: 'high',   bonusChance: 0.05, desc: 'Educational assistant in schools. Union-backed, summers off.' },
    { id: 'private',    title: 'Nanny / Private Care',   icon: '🏠', salary: 2900,  stability: 'low',    bonusChance: 0.05, desc: 'Private childcare. Higher pay, flexible hours, but no benefits or union.' },
  ],
  // New trades
  welder: [
    { id: 'fabrication',title: 'Fabrication Welder',     icon: '🔥', salary: 3800,  stability: 'high',   bonusChance: 0.10, desc: 'Shop-based metalwork. Consistent hours and a skilled trade in demand.' },
    { id: 'pipeline',   title: 'Pipeline Welder',        icon: '🛢️', salary: 5500,  stability: 'low',    bonusChance: 0.15, desc: 'Remote or travel work on pipelines and infrastructure. Top pay in the trade.' },
    { id: 'industrial', title: 'Industrial Maintenance', icon: '🏭', salary: 4400,  stability: 'high',   bonusChance: 0.10, desc: 'Plant and manufacturing welding. Steady shifts with overtime opportunities.' },
  ],
  hvac: [
    { id: 'residential',title: 'Residential HVAC',       icon: '🏠', salary: 3800,  stability: 'high',   bonusChance: 0.15, desc: 'Home heating and cooling installs. Emergency call premiums in peak seasons.' },
    { id: 'commercial', title: 'Commercial HVAC',        icon: '🏢', salary: 4400,  stability: 'high',   bonusChance: 0.10, desc: 'Large building systems. Consistent contracts and union wages.' },
    { id: 'refrigerator',title:'Refrigeration Tech',     icon: '❄️', salary: 4600,  stability: 'high',   bonusChance: 0.10, desc: 'Food service and industrial refrigeration. Specialized and well-compensated.' },
  ],
};

const STABILITY_VARIANCE = { high: 0.05, medium: 0.12, low: 0.22 };
const BONUS_MULTIPLIER   = { high: 0.5,  medium: 1.0,  low: 1.5  };

function getJobOffers() {
  return jobOffers[playerCareerPath.tier2] || jobOffers['office'];
}

function showJobOfferScreen() {
  window._ffInterrupted = true;  // pause fast-forward
  jobOfferState.offered = true;
  const offers = getJobOffers();
  const careerName = playerCareerPath.data.label;

  const cardsHTML = offers.map((job, i) => {
    const stabilityLabel = { high: '🟢 Stable', medium: '🟡 Variable', low: '🔴 High Risk' }[job.stability];
    const bonusPct = Math.round(job.bonusChance * 100);
    return `
      <button class="job-offer-card" id="job-offer-${i}" data-index="${i}">
        <div class="job-offer-card__icon">${job.icon}</div>
        <div class="job-offer-card__title">${job.title}</div>
        <div class="job-offer-card__salary">${formatCurrency(job.salary)}<span>/mo</span></div>
        <div class="job-offer-card__tags">
          <span class="job-tag">${stabilityLabel}</span>
          <span class="job-tag">🎁 ${bonusPct}% bonus chance</span>
        </div>
        <div class="job-offer-card__desc">${job.desc}</div>
      </button>`;
  }).join('');

  const isTrades = playerCareerPath.tier1 === 'trades';
  const gradBadge = isTrades ? '🔧 Apprenticeship Complete — You\'re Certified!' : '🎓 Congratulations — You Graduated!';
  const jobHeading = isTrades ? `Choose Your First ${careerName} Role` : `Choose Your First ${careerName} Job`;

  setMonthCardContent(`
    <div class="job-offer-screen">
      <div class="job-offer-screen__badge">${gradBadge}</div>
      <h2 class="job-offer-screen__heading">${jobHeading}</h2>
      <p class="job-offer-screen__sub">Each offer has different pay, stability, and bonus potential. Your choice shapes your income for the years ahead.</p>
      <div class="job-offer-cards">${cardsHTML}</div>
      <div class="job-offer-confirm hidden" id="job-offer-confirm">
        <p class="job-offer-confirm__summary" id="job-offer-summary"></p>
        <button class="btn-confirm-month" id="btn-accept-job">Accept Offer ✓</button>
      </div>
    </div>`);

  let pendingIndex = null;

  document.querySelectorAll('.job-offer-card').forEach(card => {
    card.addEventListener('click', () => {
      pendingIndex = parseInt(card.dataset.index, 10);
      document.querySelectorAll('.job-offer-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const job = offers[pendingIndex];
      document.getElementById('job-offer-summary').textContent =
        `You'll start as a ${job.title} at ${formatCurrency(job.salary)}/mo.`;
      document.getElementById('job-offer-confirm').classList.remove('hidden');
    });
  });

  document.getElementById('btn-accept-job').addEventListener('click', () => {
    if (pendingIndex === null) return;
    document.getElementById('btn-accept-job').disabled = true;
    acceptJobOffer(offers[pendingIndex]);
  });
}

function acceptJobOffer(job) {
  jobOfferState.accepted   = true;
  jobOfferState.chosenJob  = job;
  jobOfferState.monthsAtJob = 0;

  // Apply income immediately
  incomeState.baseIncome = job.salary;
  incomeState.phase      = 'working';
  incomeState.phaseLabel = job.title;
  updateIncomeDisplay();

  // Also override the income variance to match job stability
  // (stored on incomeState for use in calculateMonthlyIncome)
  incomeState.varianceOverride = STABILITY_VARIANCE[job.stability];

  // Update food/transport costs now that player is a working adult
  updateExpensesForLifeStage('graduation');

  // Update career badge
  const badge = document.getElementById('career-badge-name');
  if (badge) badge.textContent = job.title;
  const phase = document.getElementById('career-badge-phase');
  if (phase) phase.textContent = '✅ Working';

  // If they declined the student card, re-offer 3 months into working life
  if (creditState.declinedOnce && !creditState.declined && !creditState.active) {
    creditState.secondOfferMonth = gameState.month + 3;
  }

  updateDashboard();
  resumeMonthAfterInterstitial();
}

/* Trigger annual career review — sets flag, interstitial fires in finishMonth */
function processAnnualCareerProgression() {
  if (!jobOfferState.accepted || !jobOfferState.chosenJob) return null;
  jobOfferState.monthsAtJob = (jobOfferState.monthsAtJob || 0) + 12;
  jobOfferState.yearsWorked = (jobOfferState.yearsWorked || 0) + 1;

  // Recover from layoff if active
  if (jobOfferState.layoffActive) {
    jobOfferState.layoffMonthsLeft--;
    if (jobOfferState.layoffMonthsLeft <= 0) {
      incomeState.baseIncome = jobOfferState.layoffOriginalIncome;
      incomeState.varianceOverride = STABILITY_VARIANCE[jobOfferState.chosenJob.stability];
      jobOfferState.layoffActive = false;
      updateIncomeDisplay();
    }
    return null; // no review during layoff recovery
  }

  // Signal that annual review should fire as interstitial
  jobOfferState.reviewPending = true;
  return null;
}

/* Determine the outcome of the annual review and return result object */
function resolveAnnualReview() {
  const job    = jobOfferState.chosenJob;
  const years  = jobOfferState.yearsWorked;
  const stab   = job.stability;
  const roll   = Math.random();

  // Outcome probabilities by stability
  // high:   60% standard raise, 20% promotion, 15% bonus, 5% flat
  // medium: 40% standard raise, 15% promotion, 25% bonus, 15% flat, 5% layoff scare
  // low:    25% standard raise, 10% promotion, 30% bonus, 20% flat, 15% layoff scare
  const outcomes = {
    high:   [
      { type: 'promotion',  threshold: 0.20, minYears: 2 },
      { type: 'bonus',      threshold: 0.35 },
      { type: 'raise',      threshold: 0.95 },
      { type: 'flat',       threshold: 1.00 },
    ],
    medium: [
      { type: 'promotion',  threshold: 0.15, minYears: 2 },
      { type: 'bonus',      threshold: 0.40 },
      { type: 'raise',      threshold: 0.80 },
      { type: 'flat',       threshold: 0.95 },
      { type: 'layoff',     threshold: 1.00 },
    ],
    low:    [
      { type: 'promotion',  threshold: 0.10, minYears: 2 },
      { type: 'bonus',      threshold: 0.40 },
      { type: 'raise',      threshold: 0.65 },
      { type: 'flat',       threshold: 0.85 },
      { type: 'layoff',     threshold: 1.00 },
    ],
  };

  const pool = outcomes[stab] || outcomes.medium;
  let outcome = 'raise';
  for (const o of pool) {
    if (o.minYears && years < o.minYears) continue;
    if (roll < o.threshold) { outcome = o.type; break; }
  }

  const oldSalary = incomeState.baseIncome;

  if (outcome === 'promotion') {
    const raiseAmt = Math.round(oldSalary * (0.10 + Math.random() * 0.08)); // 10-18%
    incomeState.baseIncome += raiseAmt;
    // Update job title
    const promotedTitle = job.title + ' (Sr.)';
    jobOfferState.chosenJob = { ...job, title: promotedTitle, salary: incomeState.baseIncome };
    incomeState.phaseLabel = promotedTitle;
    updateIncomeDisplay();
    const badge = document.getElementById('career-badge-name');
    if (badge) badge.textContent = promotedTitle;
    return { type: 'promotion', raiseAmt, newSalary: incomeState.baseIncome, oldSalary };
  }

  if (outcome === 'raise') {
    const raiseAmt = Math.round(oldSalary * (0.025 + Math.random() * 0.015)); // 2.5-4%
    incomeState.baseIncome += raiseAmt;
    return { type: 'raise', raiseAmt, newSalary: incomeState.baseIncome, oldSalary };
  }

  if (outcome === 'bonus') {
    const bonusAmt = Math.round(oldSalary * (0.5 + Math.random() * BONUS_MULTIPLIER[stab]));
    gameState.cash += bonusAmt;
    // Still get standard raise
    const raiseAmt = Math.round(oldSalary * 0.025);
    incomeState.baseIncome += raiseAmt;
    return { type: 'bonus', bonusAmt, raiseAmt, newSalary: incomeState.baseIncome, oldSalary };
  }

  if (outcome === 'flat') {
    // No raise — keep same income
    return { type: 'flat', newSalary: oldSalary, oldSalary };
  }

  if (outcome === 'layoff') {
    // Income drops 20-35% for 2-3 months
    const dropPct = 0.20 + Math.random() * 0.15;
    const reducedSalary = Math.round(oldSalary * (1 - dropPct));
    jobOfferState.layoffActive       = true;
    jobOfferState.layoffMonthsLeft   = 2 + Math.floor(Math.random() * 2); // 2-3 months
    jobOfferState.layoffOriginalIncome = oldSalary;
    incomeState.baseIncome = reducedSalary;
    incomeState.varianceOverride = 0.02; // very stable low income during layoff
    updateIncomeDisplay();
    return { type: 'layoff', dropPct, reducedSalary, oldSalary, months: jobOfferState.layoffMonthsLeft };
  }

  return { type: 'raise', raiseAmt: 0, newSalary: oldSalary, oldSalary };
}

/* ══════════════════════════════════════════════════════════════════
   HOUSING / MORTGAGE SYSTEM
   Fires ~month 24 of working life. Player can rent or buy.
   Buying opens a mortgage wizard. Home value appreciates monthly.
   ══════════════════════════════════════════════════════════════════ */

const mortgageState = {
  active:         false,
  balance:        0,
  originalAmount: 0,
  monthlyPayment: 0,
  interestRate:   0,
  amortYears:     25,
  homePrice:      0,
  purchaseMonth:  0,
};

const HOUSING_APPRECIATION = 0.04;  // 4% annual home appreciation

/* Home prices keyed to career income bracket */
const homePriceByCareer = {
  premed:      650000, specialist: 700000,
  cs:          580000, business: 520000, arts: 380000,
  nursing:     460000, it: 480000, design: 400000, police: 500000,
  electrician: 480000, carpenter: 420000, plumber: 490000, mechanic: 400000,
  retail:      340000, service: 330000, office: 400000, warehouse: 370000,
};

function getHomePrice() {
  return homePriceByCareer[playerCareerPath.tier2] || 420000;
}

function calcMortgagePayment(principal, annualRate, years) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

let housingOfferFired = false;
let housingOfferMonth = 0;   // month when working life started

function maybeOfferHousing() {
  if (housingOfferFired) return;
  if (!jobOfferState.accepted) return;
  // Fire 24 months after accepting first job
  if (!housingOfferMonth) housingOfferMonth = gameState.month;
  const monthsWorking = gameState.month - housingOfferMonth;
  if (monthsWorking < 24) return;
  housingOfferFired = true;
  finishMonth._pendingCtx = finishMonth._pendingCtx || null;
  // Intercept: store pending ctx if not already stored
  // We'll re-use the interstitial pattern
  housingState_pendingTrigger = true;
}

let housingState_pendingTrigger = false;

// Override processMortgageMonth to also check housing offer trigger
function processMortgageMonth() {
  expenseState.mortgagePayment = 0;  // reset each month
  if (mortgageState.active && mortgageState.balance > 0) {
    const payment   = Math.min(mortgageState.monthlyPayment, mortgageState.balance);
    const interest  = mortgageState.balance * (mortgageState.interestRate / 12);
    const principal = Math.max(0, payment - interest);
    mortgageState.balance = Math.max(0, mortgageState.balance - principal);
    // NOTE: cash deducted via expenseState.monthlyTotal in advanceMonth — do NOT deduct again here
    expenseState.mortgagePayment = Math.round(payment);  // for centre card display only

    // Home appreciation
    const monthlyAppreciation = Math.pow(1 + HOUSING_APPRECIATION, 1/12) - 1;
    gameState.homeValue *= (1 + monthlyAppreciation);
    gameState.homeEquity = Math.max(0, gameState.homeValue - mortgageState.balance);

    expenseState.rent = 0;  // owning replaces rent
    // Recalculate total including mortgage
    expenseState.monthlyTotal = expenseState.food + expenseState.transport + expenseState.phone + expenseState.other + Math.round(mortgageState.monthlyPayment);
  }
}

function showHousingOfferScreen(pendingCtx) {
  const homePrice = getHomePrice();
  const minDown   = Math.round(homePrice * 0.05);
  const down20    = Math.round(homePrice * 0.20);
  const fhsaBal   = Math.round(gameState.fhsa);
  const cashBal   = Math.round(gameState.cash);
  const canAfford5  = cashBal + fhsaBal >= minDown;
  const canAfford20 = cashBal + fhsaBal >= down20;

  // Three mortgage scenarios to show
  const scenarios = [
    { label: '5% Down',  rate: 0.055, years: 25, down: minDown,  cmhc: true  },
    { label: '10% Down', rate: 0.052, years: 25, down: Math.round(homePrice*0.10), cmhc: false },
    { label: '20% Down', rate: 0.048, years: 25, down: down20,   cmhc: false },
  ];

  const scenarioCards = scenarios.map((sc, i) => {
    const principal  = homePrice - sc.down;
    const monthly    = Math.round(calcMortgagePayment(principal, sc.rate, sc.years));
    const canBuy     = cashBal + fhsaBal >= sc.down;
    const cmhcNote   = sc.cmhc ? ' + CMHC insurance' : '';
    return `
      <div class="mortgage-scenario ${canBuy ? '' : 'mortgage-scenario--unaffordable'}" data-index="${i}"
           data-down="${sc.down}" data-rate="${sc.rate}" data-years="${sc.years}" data-monthly="${monthly}">
        <div class="mortgage-scenario__label">${sc.label}</div>
        <div class="mortgage-scenario__down">Down: ${formatCurrency(sc.down)}${cmhcNote}</div>
        <div class="mortgage-scenario__payment">${formatCurrency(monthly)}<span>/mo</span></div>
        <div class="mortgage-scenario__rate">${(sc.rate*100).toFixed(1)}% · ${sc.years}yr amort</div>
        ${!canBuy ? '<div class="mortgage-scenario__unaffordable">Insufficient funds</div>' : ''}
      </div>`;
  }).join('');

  const fhsaNote = fhsaBal > 0
    ? `<p class="housing-fhsa-note">🏠 Your FHSA balance of <strong>${formatCurrency(fhsaBal)}</strong> can go toward your down payment — tax-free.</p>`
    : '';

  setMonthCardContent(`
    <div class="housing-offer-screen">
      <div class="housing-offer-screen__badge">🏠 Housing Decision</div>
      <h2 class="housing-offer-screen__heading">Rent or Buy?</h2>
      <p class="housing-offer-screen__sub">You've been working for 2 years. Home prices in your area are around <strong>${formatCurrency(homePrice)}</strong>. Your cash: <strong>${formatCurrency(cashBal)}</strong>.</p>
      ${fhsaNote}

      <div class="housing-tabs">
        <button class="housing-tab housing-tab--active" id="tab-keep-renting">Keep Renting</button>
        <button class="housing-tab" id="tab-buy">Buy a Home</button>
      </div>

      <div id="housing-rent-panel">
        <div class="housing-rent-card">
          <div class="housing-rent-card__icon">🏢</div>
          <div class="housing-rent-card__title">Stay Renting</div>
          <p class="housing-rent-card__body">Keep your current rental. More flexibility, lower upfront cost, but no equity building. You can revisit buying next year.</p>
          <div class="housing-rent-card__stats">
            <div class="housing-stat"><span>Monthly Rent</span><span>${formatCurrency(expenseState.rent)}</span></div>
            <div class="housing-stat"><span>No Equity Gained</span><span>—</span></div>
          </div>
          <button class="btn-confirm-month" id="btn-keep-renting" style="margin-top:16px">Continue Renting →</button>
        </div>
      </div>

      <div id="housing-buy-panel" class="hidden">
        <p class="mortgage-intro">Choose your down payment scenario:</p>
        <div class="mortgage-scenarios">${scenarioCards}</div>
        <div class="mortgage-confirm hidden" id="mortgage-confirm">
          <p class="mortgage-confirm__summary" id="mortgage-confirm-summary"></p>
          <button class="btn-confirm-month" id="btn-buy-home">Purchase Home ✓</button>
        </div>
      </div>
    </div>`);

  // Tab switching
  document.getElementById('tab-keep-renting').addEventListener('click', () => {
    document.getElementById('tab-keep-renting').classList.add('housing-tab--active');
    document.getElementById('tab-buy').classList.remove('housing-tab--active');
    document.getElementById('housing-rent-panel').classList.remove('hidden');
    document.getElementById('housing-buy-panel').classList.add('hidden');
  });
  document.getElementById('tab-buy').addEventListener('click', () => {
    document.getElementById('tab-buy').classList.add('housing-tab--active');
    document.getElementById('tab-keep-renting').classList.remove('housing-tab--active');
    document.getElementById('housing-buy-panel').classList.remove('hidden');
    document.getElementById('housing-rent-panel').classList.add('hidden');
  });

  // Keep renting
  document.getElementById('btn-keep-renting').addEventListener('click', () => {
    // Allow offer to re-fire in another year
    housingOfferFired = false;
    housingOfferMonth += 12;
    resumeMonthAfterInterstitial();
  });

  // Mortgage scenario selection
  let pendingMortgage = null;
  document.querySelectorAll('.mortgage-scenario:not(.mortgage-scenario--unaffordable)').forEach(sc => {
    sc.addEventListener('click', () => {
      document.querySelectorAll('.mortgage-scenario').forEach(s => s.classList.remove('selected'));
      sc.classList.add('selected');
      pendingMortgage = {
        down: parseInt(sc.dataset.down),
        rate: parseFloat(sc.dataset.rate),
        years: parseInt(sc.dataset.years),
        monthly: parseInt(sc.dataset.monthly),
      };
      const conf = document.getElementById('mortgage-confirm');
      conf.classList.remove('hidden');
      document.getElementById('mortgage-confirm-summary').textContent =
        `Down payment: ${formatCurrency(pendingMortgage.down)} · Monthly payment: ${formatCurrency(pendingMortgage.monthly)}/mo`;
    });
  });

  document.getElementById('btn-buy-home').addEventListener('click', () => {
    if (!pendingMortgage) return;
    document.getElementById('btn-buy-home').disabled = true;
    purchaseHome(pendingMortgage, homePrice, pendingCtx);
  });
}

function purchaseHome(mortgage, homePrice, pendingCtx) {
  // Deduct down payment — use FHSA first, then cash
  let remaining = mortgage.down;
  if (gameState.fhsa >= remaining) {
    gameState.fhsa -= remaining;
    remaining = 0;
  } else {
    remaining -= gameState.fhsa;
    gameState.fhsa = 0;
  }
  gameState.cash -= remaining;

  // Set up mortgage state
  mortgageState.active        = true;
  mortgageState.balance       = homePrice - mortgage.down;
  mortgageState.originalAmount = mortgageState.balance;
  mortgageState.monthlyPayment = mortgage.monthly;
  mortgageState.interestRate   = mortgage.rate;
  mortgageState.amortYears     = mortgage.years;
  mortgageState.homePrice      = homePrice;
  mortgageState.purchaseMonth  = gameState.month;

  // Set gameState housing values
  gameState.homeValue  = homePrice;
  gameState.homeEquity = mortgage.down;

  // Remove rent from expenses — mortgage replaces it
  expenseState.rent = 0;
  expenseState.monthlyTotal = expenseState.food + expenseState.transport + expenseState.other + mortgage.monthly;

  // Update food costs for living independently
  updateExpensesForLifeStage('home-purchase');

  // Show housing panel in sidebar
  const housingPanel = document.getElementById('housing-panel');
  if (housingPanel) housingPanel.classList.remove('hidden');
  const rentRow = document.getElementById('row-exp-rent');
  if (rentRow) rentRow.classList.add('hidden');

  updateDashboard();

  // Log it
  const histMarker = document.createElement('div');
  histMarker.className = 'history-tax-marker history-tax-marker--home';
  histMarker.innerHTML = `<span>🏠 Bought a Home!</span><span>${formatCurrency(homePrice)}</span>`;
  historyFeed.insertBefore(histMarker, historyFeed.firstChild);

  resumeMonthAfterInterstitial();
}


/* ══════════════════════════════════════════════════════════════════
   EMERGENCY FUND SYSTEM
   A dedicated savings bucket separate from cash. Protects against
   negative life events — if funded adequately the hit is absorbed
   and the player sees a clear "your emergency fund covered this"
   message rather than taking a cash hit.

   Target = 3 months of monthly expenses (expenseState.monthlyTotal × 3)
   Covered events: any negative life event that would cost ≤ EF balance
   ══════════════════════════════════════════════════════════════════ */

const EF_MONTHS_TARGET = 3;  // 3-month expenses target

function efTarget() {
  return expenseState.monthlyTotal * EF_MONTHS_TARGET;
}

function efPercent() {
  const target = efTarget();
  if (target <= 0) return 0;
  return Math.min(100, Math.round((gameState.emergencyFund / target) * 100));
}

function updateEFProgressBar() {
  const el = (id) => document.getElementById(id);
  const pct = efPercent();
  const target = efTarget();
  if (el('ef-progress-bar'))   el('ef-progress-bar').style.width = pct + '%';
  if (el('ef-progress-bar')) {
    el('ef-progress-bar').className = 'ef-progress__bar' +
      (pct >= 100 ? ' ef-progress__bar--full' :
       pct >= 50  ? ' ef-progress__bar--mid'  : ' ef-progress__bar--low');
  }
  if (el('ef-progress-label')) {
    el('ef-progress-label').textContent = pct >= 100
      ? '✅ Fully funded!'
      : `${pct}% of ${formatCurrency(target)} target`;
  }
  if (el('alloc-ef-hint')) {
    el('alloc-ef-hint').textContent = pct >= 100
      ? 'Fully funded!'
      : `${pct}% · target ${formatCurrency(target)}`;
  }
}

/* applyEmergencyFundToEvent(event)
   Called from advanceMonth when a negative life event fires.
   If EF can cover the hit, absorbs it and returns a modified event
   with effect = 0 and a covered flag. Otherwise returns the event unchanged.
*/
function applyEmergencyFundToEvent(event) {
  if (event.type !== 'negative' || event.effect >= 0) return { event, covered: false };
  const cost = Math.abs(event.effect);
  if (gameState.emergencyFund >= cost) {
    gameState.emergencyFund -= cost;
    updateDashboard();
    return { event, covered: true, cost };
  }
  // Partial cover — EF absorbs what it can, rest hits cash
  if (gameState.emergencyFund > 0) {
    const partial = gameState.emergencyFund;
    gameState.emergencyFund = 0;
    updateDashboard();
    return { event, covered: false, partialCover: partial, cost };
  }
  return { event, covered: false };
}


/* ══════════════════════════════════════════════════════════════════
   CREDIT CARD SYSTEM
   Offered in month 2 or 3. Tracks balance, minimum payments,
   19.99% APR, and credit score (300–900).
   ══════════════════════════════════════════════════════════════════ */

const creditState = {
  offered:          false,
  active:           false,
  declined:         false,      // permanently declined (both offers)
  declinedOnce:     false,      // declined the first offer only
  secondOfferMonth: 0,          // game month when second offer should fire
  balance:          0,
  limit:            0,
  monthlyCharge:    0,
  eventCharge:      0,
  lastEventTitle:   '',
  missedPayments:   0,
  monthsOpen:       0,
  consecutiveFullPayments: 0,
  limitIncreaseOffered: false,
  premiumOffered:   false,
  score:            660,
  statementDue:     false,
};

const CC_APR        = 0.1999;  // 19.99% annual
const CC_MONTHLY_R  = CC_APR / 12;
const CC_MIN_PCT    = 0.02;    // minimum 2% of balance
const CC_MIN_FLOOR  = 10;      // or $10, whichever is greater

function ccMinPayment() {
  return Math.max(CC_MIN_FLOOR, Math.round(creditState.balance * CC_MIN_PCT));
}

function ccInterestProjection() {
  // Months to pay off at minimum payment, and total interest
  if (creditState.balance <= 0) return { months: 0, interest: 0 };
  let bal = creditState.balance;
  let totalInt = 0;
  let months = 0;
  while (bal > 0.5 && months < 600) {
    const interest = bal * CC_MONTHLY_R;
    const pmt = Math.max(CC_MIN_FLOOR, bal * CC_MIN_PCT);
    totalInt += interest;
    bal = bal + interest - pmt;
    months++;
  }
  return { months, interest: Math.round(totalInt) };
}

function updateCreditScoreDisplay() {
  const el = (id) => document.getElementById(id);
  if (!el('display-credit-score')) return;
  el('display-credit-score').textContent = creditState.score;
  const label = creditState.score >= 800 ? '💎 Excellent'
              : creditState.score >= 750 ? '🌟 Very Good'
              : creditState.score >= 700 ? '✅ Good'
              : creditState.score >= 650 ? '🟡 Fair'
              : creditState.score >= 600 ? '🟠 Poor'
                                         : '🔴 Very Poor';
  if (el('display-credit-label')) el('display-credit-label').textContent = label;
  if (el('display-cc-balance'))   el('display-cc-balance').textContent   = formatCurrency(Math.round(creditState.balance));
  if (el('display-cc-limit'))     el('display-cc-limit').textContent     = formatCurrency(creditState.limit);
  if (el('credit-panel'))         el('credit-panel').classList.toggle('hidden', !creditState.active);
}

/* Monthly credit score update — called in finishMonth */
function updateCreditScore() {
  if (!creditState.active) return;
  creditState.monthsOpen++;
  const util = creditState.limit > 0 ? creditState.balance / creditState.limit : 0;

  // Utilization penalty
  if (util > 0.70)      creditState.score += -8;
  else if (util > 0.30) creditState.score += -2;
  else                  creditState.score += 2;

  // 12-month milestone bonus
  if (creditState.monthsOpen === 12) creditState.score += 5;

  // Clamp
  creditState.score = Math.min(900, Math.max(300, creditState.score));
  updateCreditScoreDisplay();
}

/* applyMonthlyInterest — called in finishMonth before showing card */
function applyCCInterest() {
  if (!creditState.active || creditState.balance <= 0) return;
  const interest = Math.round(creditState.balance * CC_MONTHLY_R);
  creditState.balance += interest;
}

/* chargeToCreditCard(amount) — used by life events when cash is short */
function chargeToCreditCard(amount) {
  if (!creditState.active) return false;
  const available = creditState.limit - creditState.balance;
  if (available < amount) return false;
  creditState.balance += amount;
  creditState.monthlyCharge += amount;
  return true;
}

/* showCCOfferPrompt — fires in month 2 or 3 */
function maybeTriggerCCOffer() {
  if (creditState.active || creditState.declined) return;

  // ── First offer: always month 2, student card ──
  if (!creditState.offered && !creditState.declinedOnce && gameState.month === 2) {
    creditState.offered = true;
    showCCOfferBanner({
      headline: 'You are pre-approved for a student credit card!',
      subline:  '· 19.99% APR · Builds your credit score',
      isSecond: false,
    });
    return;
  }

  // ── Second offer: 3 months after job acceptance, if they declined before ──
  if (creditState.declinedOnce && !creditState.declined
      && creditState.secondOfferMonth > 0
      && gameState.month === creditState.secondOfferMonth) {
    creditState.secondOfferMonth = 0; // prevent re-triggering
    showCCOfferBanner({
      headline: 'You are now eligible for an entry-level credit card.',
      subline:  'You declined earlier, but with steady income your application is stronger.',
      isSecond: true,
    });
  }
}

function showCCOfferBanner({ headline, subline, isSecond }) {
  // Limit based on current income
  const income = incomeState.baseIncome || 2000;
  const limit  = isSecond
    ? (income < 3000 ? 1000 : income < 5000 ? 1500 : 2000)  // better limits with income
    : (income < 2000 ? 500  : income < 4000 ? 1000 : 1500); // student limits
  creditState.limit = limit;

  const card = document.getElementById('month-card');
  if (!card) return;
  const offerDiv = document.createElement('div');
  offerDiv.className = 'cc-offer-banner';
  offerDiv.id = 'cc-offer-banner';
  offerDiv.innerHTML =
    '<div class="cc-offer-banner__body">' +
      '<span class="cc-offer-banner__icon">💳</span>' +
      '<div class="cc-offer-banner__text">' +
        '<strong>' + headline + '</strong>' +
        '<span>' + formatCurrency(limit) + ' limit ' + subline + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="cc-offer-banner__btns">' +
      '<button class="cc-offer-btn cc-offer-btn--accept" id="btn-cc-accept">Accept</button>' +
      '<button class="cc-offer-btn cc-offer-btn--decline" id="btn-cc-decline">' + (isSecond ? 'No thanks' : 'Decline') + '</button>' +
    '</div>';
  card.insertBefore(offerDiv, card.firstChild);

  document.getElementById('btn-cc-accept').addEventListener('click', () => {
    creditState.active  = true;
    creditState.offered = true;
    offerDiv.remove();
    const creditPanel = document.getElementById('credit-panel');
    if (creditPanel) creditPanel.classList.remove('hidden');
    updateCreditScoreDisplay();
    showCCConfirmNote('Card accepted! ' + formatCurrency(limit) + ' limit. Pay in full each month to avoid interest and build your score.');
  });

  document.getElementById('btn-cc-decline').addEventListener('click', () => {
    if (!isSecond) {
      // First decline — will re-offer after job acceptance
      creditState.declinedOnce = true;
      showCCConfirmNote('No problem. You can always apply once you have a steady income.');
    } else {
      // Second decline — permanent, no more offers
      creditState.declined = true;
      showCCConfirmNote('Got it. You will not be offered a credit card again. Cash-only is a valid strategy too.');
    }
    offerDiv.remove();
  });
}

function showCCConfirmNote(msg) {
  const card = document.getElementById('month-card');
  if (!card) return;
  const note = document.createElement('div');
  note.className = 'cc-confirm-note';
  note.textContent = msg;
  card.insertBefore(note, card.firstChild);
  setTimeout(() => note.remove(), 6000);
}

/* showCCStatementSection — renders as a modal overlay, gates Save Allocations */
function showCCStatementSection(d) {
  if (!creditState.active) return;
  if (creditState.balance <= 0 && creditState.monthlyCharge <= 0) {
    creditState.statementDue = false;
    return;
  }

  creditState.statementDue = true;

  // Lock Save Allocations button until CC is settled
  const confirmBtn = document.getElementById('btn-confirm-month');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Settle credit card first';
  }

  const bal    = Math.round(creditState.balance);
  const minPmt = ccMinPayment();
  const proj   = ccInterestProjection();
  const util   = Math.round((creditState.balance / creditState.limit) * 100);

  // Build charge badge if a life event caused a charge this month
  const chargeBadge = creditState.eventCharge > 0
    ? '<div class="cc-modal__charge-badge">' +
        '<span>💳 Charged this month: ' + (creditState.lastEventTitle || 'Life event') + '</span>' +
        '<strong>' + formatCurrency(creditState.eventCharge) + '</strong>' +
      '</div>'
    : '';

  // Build interest projection
  const projHTML = (proj.months > 0 && proj.interest > 0)
    ? '<p class="cc-modal__projection">At minimum payments: ' + proj.months + ' months to clear · ' +
        formatCurrency(proj.interest) + ' in extra interest.<br>' +
        '<strong>Paying in full saves ' + formatCurrency(proj.interest) + '.</strong></p>'
    : '';

  // Render modal
  const backdrop = document.createElement('div');
  backdrop.className = 'cc-modal-backdrop';
  backdrop.id = 'cc-modal-backdrop';
  backdrop.innerHTML =
    '<div class="cc-modal" role="dialog" aria-modal="true" aria-label="Credit Card Statement">' +
      '<div class="cc-modal__header">' +
        '<span class="cc-modal__icon">💳</span>' +
        '<div>' +
          '<div class="cc-modal__title">Credit Card Statement</div>' +
          '<div class="cc-modal__subtitle">Settle your balance before allocating this month</div>' +
        '</div>' +
      '</div>' +
      chargeBadge +
      '<div class="cc-modal__rows">' +
        '<div class="cc-modal__row"><span>Total Balance</span><span class="cc-stat-val--debt">' + formatCurrency(bal) + '</span></div>' +
        '<div class="cc-modal__row"><span>Minimum Payment</span><span>' + formatCurrency(minPmt) + '</span></div>' +
        '<div class="cc-modal__row"><span>Card Utilization</span><span>' + util + '%</span></div>' +
      '</div>' +
      projHTML +
      '<hr class="cc-modal__divider">' +
      '<div class="cc-modal__input-row">' +
        '<input type="number" id="cc-pay-input" class="alloc-input" min="0" max="' + bal + '" placeholder="Custom amount" />' +
        '<button class="cc-pay-btn cc-pay-btn--custom" id="btn-cc-pay-custom">Pay Amount</button>' +
      '</div>' +
      '<div class="cc-modal__btns">' +
        '<button class="cc-pay-btn cc-pay-btn--full"  id="btn-cc-pay-full">✅ Pay in Full<br><small>' + formatCurrency(bal) + '</small></button>' +
        '<button class="cc-pay-btn cc-pay-btn--min"   id="btn-cc-pay-min">Pay Minimum<br><small>' + formatCurrency(minPmt) + '</small></button>' +
        '<button class="cc-pay-btn cc-pay-btn--skip"  id="btn-cc-skip">Skip ⚠️<br><small>-30 score</small></button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(backdrop);

  document.getElementById('btn-cc-pay-full').addEventListener('click', () => { backdrop.remove(); processCCPayment(bal, 'full'); });
  document.getElementById('btn-cc-pay-min').addEventListener('click',  () => { backdrop.remove(); processCCPayment(minPmt, 'minimum'); });
  document.getElementById('btn-cc-pay-custom').addEventListener('click', () => {
    const amt = Math.max(0, parseInt(document.getElementById('cc-pay-input').value) || 0);
    if (amt < minPmt && amt < bal) {
      document.getElementById('cc-pay-input').style.borderColor = 'var(--clr-red)';
      return;
    }
    backdrop.remove();
    processCCPayment(Math.min(amt, bal), 'custom');
  });
  document.getElementById('btn-cc-skip').addEventListener('click', () => { backdrop.remove(); processCCPayment(0, 'skip'); });
}

function processCCPayment(amount, type) {
  if (type === 'skip') {
    // Missed payment
    creditState.missedPayments++;
    creditState.score = Math.max(300, creditState.score - 30);

    if (creditState.missedPayments >= 3) {
      // Collections warning
      const fee = 150;
      gameState.cash -= fee;
      creditState.balance += fee;
      creditState.score = Math.max(300, creditState.score - 60);
      showCCConfirmNote(`⚠️ Collections! A $${fee} fee was added. Your credit score dropped severely.`);
    } else {
      showCCConfirmNote(`⚠️ Payment skipped. Your credit score dropped. Missing payments compounds quickly.`);
    }
  } else {
    // Make payment — never use negative cash
    const availableCash = Math.max(0, gameState.cash);
    if (amount > availableCash) amount = availableCash;
    gameState.cash      -= amount;
    creditState.balance  = Math.max(0, creditState.balance - amount);
    creditState.missedPayments = 0;

    // Credit score update based on payment type
    if (type === 'full') {
      creditState.score = Math.min(900, creditState.score + 4);
      showCCConfirmNote(`✅ Paid in full — no interest charged. Credit score +4.`);
    } else if (type === 'minimum') {
      creditState.score = Math.min(900, creditState.score + 1);
      showCCConfirmNote(`💳 Minimum payment made. Interest will compound on the remaining balance.`);
    } else {
      creditState.score = Math.min(900, creditState.score + 2);
      showCCConfirmNote(`💳 Partial payment made. Interest applies to remaining balance.`);
    }
  }

  creditState.statementDue   = false;
  creditState.monthlyCharge  = 0;
  creditState.eventCharge    = 0;
  creditState.lastEventTitle = '';

  if (type === 'full') {
    creditState.consecutiveFullPayments = (creditState.consecutiveFullPayments || 0) + 1;
  } else if (type !== 'skip') {
    creditState.consecutiveFullPayments = 0;
  }

  // Re-enable Save Allocations now that CC is settled
  const confirmBtnCC = document.getElementById('btn-confirm-month');
  if (confirmBtnCC) {
    confirmBtnCC.disabled = false;
    confirmBtnCC.textContent = 'Save Allocations ✓';
  }

  updateDashboard();
  updateCreditScoreDisplay();
  checkCreditMilestones();
  maybeShowCashCrisis();
}

function checkCreditMilestones() {
  if (!creditState.active) return;

  // Limit increase: 18+ months, 6+ consecutive full payments, score >= 680, no missed
  if (!creditState.limitIncreaseOffered
      && creditState.monthsOpen >= 18
      && (creditState.consecutiveFullPayments || 0) >= 6
      && creditState.score >= 680
      && creditState.missedPayments === 0) {
    creditState.limitIncreaseOffered = true;
    showLimitIncreaseOffer();
  }

  // Premium card: score >= 800
  if (!creditState.premiumOffered && creditState.score >= 800) {
    creditState.premiumOffered = true;
    setTimeout(() => {
      showCCConfirmNote('💎 Premium card unlocked! You now earn $15-30/mo in cash-back rewards.');
    }, 2000);
  }
}

function showLimitIncreaseOffer() {
  const oldLimit = creditState.limit;
  const newLimit = Math.round(oldLimit * 1.75);
  const card = document.getElementById('month-card');
  if (!card) return;

  const offerDiv = document.createElement('div');
  offerDiv.className = 'cc-limit-offer';
  offerDiv.id = 'cc-limit-offer';
  offerDiv.innerHTML =
    '<div class="cc-limit-offer__body">' +
      '<span class="cc-limit-offer__icon">💳</span>' +
      '<div>' +
        '<strong>Credit Limit Increase Offer</strong>' +
        '<p>Your bank wants to raise your limit from ' + formatCurrency(oldLimit) + ' to ' + formatCurrency(newLimit) + '. ' +
        'A higher limit improves your utilization ratio and gives more flexibility, but also more room to carry debt. Your call.</p>' +
      '</div>' +
    '</div>' +
    '<div class="cc-limit-offer__btns">' +
      '<button class="cc-offer-btn cc-offer-btn--accept" id="btn-limit-accept">Accept (+3 score)</button>' +
      '<button class="cc-offer-btn cc-offer-btn--decline" id="btn-limit-decline">No thanks</button>' +
    '</div>';

  card.insertBefore(offerDiv, card.firstChild);

  document.getElementById('btn-limit-accept').addEventListener('click', () => {
    creditState.limit = newLimit;
    creditState.score = Math.min(900, creditState.score + 3);
    updateCreditScoreDisplay();
    offerDiv.remove();
    showCCConfirmNote('Limit increased to ' + formatCurrency(newLimit) + '. Credit score +3.');
  });
  document.getElementById('btn-limit-decline').addEventListener('click', () => {
    offerDiv.remove();
    showCCConfirmNote('Limit increase declined. Staying at ' + formatCurrency(oldLimit) + '.');
  });
}

/* Monthly cash-back rewards for premium card holders */
function applyCCRewards() {
  if (!creditState.active || !creditState.premiumOffered) return 0;
  if (creditState.balance > creditState.limit * 0.5) return 0; // only if not overloaded
  const reward = Math.round(15 + Math.random() * 15);  // $15–30
  gameState.cash += reward;
  return reward;
}

/* Handle life events — priority: EF -> CC (if eligible) -> Cash */
function handleNegativeEvent(event) {
  if (event.type !== 'negative' || event.effect >= 0) {
    if (event.effect !== 0) gameState.cash += event.effect;
    return { event, covered: false, chargedToCC: false };
  }

  const cost   = Math.abs(event.effect);
  const ccElig = event.ccEligible === true;

  // 1. Emergency Fund covers fully
  if (gameState.emergencyFund >= cost) {
    gameState.emergencyFund -= cost;
    updateDashboard();
    return { event, covered: true, cost, chargedToCC: false };
  }

  // 2. EF partial cover
  const efPartial = gameState.emergencyFund;
  if (efPartial > 0) {
    gameState.emergencyFund = 0;
    updateDashboard();
  }
  const remaining = cost - efPartial;

  // 3. CC eligible + card active -> charge to card (up to available room)
  if (ccElig && creditState.active) {
    const ccRoom   = creditState.limit - creditState.balance;
    const ccCharge = Math.min(remaining, Math.max(0, ccRoom));
    const cashPart = remaining - ccCharge;

    if (ccCharge > 0) {
      creditState.balance       += ccCharge;
      creditState.monthlyCharge += ccCharge;
      creditState.eventCharge    = (creditState.eventCharge || 0) + ccCharge;
      creditState.lastEventTitle = event.title;
    }
    if (cashPart > 0) gameState.cash -= cashPart;

    return {
      event,
      covered:      false,
      partialCover: efPartial,
      chargedToCC:  ccCharge > 0,
      ccAmount:     ccCharge,
      cashPart,
    };
  }

  // 4. Not CC eligible or no card -> cash
  gameState.cash -= remaining;
  return { event, covered: false, partialCover: efPartial, chargedToCC: false };
}


/* ══════════════════════════════════════════════════════════════════
   PORTFOLIO PAGE SYSTEM
   A full centre-column view showing holdings, contribution vs growth,
   donut chart allocation, and per-account breakdown.
   Toggled by the Portfolio button in the top bar.
   ══════════════════════════════════════════════════════════════════ */

let portfolioViewActive = false;

function togglePortfolioView() {
  portfolioViewActive = !portfolioViewActive;
  const monthCard    = document.getElementById('month-card');
  const welcomeCard  = document.getElementById('welcome-card');
  const portfolioDiv = document.getElementById('portfolio-page');
  const btn          = document.getElementById('btn-portfolio');

  if (portfolioViewActive) {
    // Close lifestyle page if open
    if (lifestyleViewActive) toggleLifestyleView();
    monthCard.classList.add('hidden');
    welcomeCard.classList.add('hidden');
    portfolioDiv.classList.remove('hidden');
    btn.textContent = '← Budget';
    btn.classList.add('btn-portfolio--active');
    renderPortfolioPage();
  } else {
    portfolioDiv.classList.add('hidden');
    btn.textContent = '📈 Portfolio';
    btn.classList.remove('btn-portfolio--active');
    // Restore whichever card was showing
    monthCard.classList.remove('hidden');
  }
}

/* ── LIFESTYLE TAB TOGGLE ── */
let lifestyleViewActive = false;

function toggleLifestyleView() {
  lifestyleViewActive = !lifestyleViewActive;
  const monthCard     = document.getElementById('month-card');
  const welcomeCard   = document.getElementById('welcome-card');
  const portfolioDiv  = document.getElementById('portfolio-page');
  const lifestyleDiv  = document.getElementById('lifestyle-page');
  const btn           = document.getElementById('btn-lifestyle-tab');

  if (lifestyleViewActive) {
    // Close portfolio if open
    if (portfolioViewActive) {
      portfolioViewActive = false;
      portfolioDiv.classList.add('hidden');
      const pb = document.getElementById('btn-portfolio');
      if (pb) { pb.textContent = '📈 Portfolio'; pb.classList.remove('btn-portfolio--active'); }
    }
    monthCard.classList.add('hidden');
    welcomeCard.classList.add('hidden');
    lifestyleDiv.classList.remove('hidden');
    btn.textContent = '← Budget';
    btn.classList.add('btn-lifestyle-tab--active');
    renderLifestylePage();
  } else {
    lifestyleDiv.classList.add('hidden');
    btn.textContent = '🎛️ Lifestyle';
    btn.classList.remove('btn-lifestyle-tab--active');
    monthCard.classList.remove('hidden');
  }
}

function renderLifestylePage() {
  const page = document.getElementById('lifestyle-page');
  if (!page) return;

  const interests = playerSetup.interests || [];
  const lo = (window.LIVING_OPTIONS||[]).find(o => o.id === playerSetup.living) || { icon: '🏠', label: playerSetup.living || '—' };
  const to = (window.TRANSPORT_OPTIONS||[]).find(o => o.id === playerSetup.transport) || { icon: '🚗', label: playerSetup.transport || '—' };
  const po = (window.PHONE_OPTIONS||[]).find(o => o.id === (playerSetup.phone || 'mid')) || { icon: '📱', label: '—' };

  const interestItems = interests.map(id => {
    const item = INTERESTS_LIST.find(i => i.id === id);
    return item ? `<div class="lifestyle-interest-item">
      <span class="lifestyle-interest-item__icon">${item.icon}</span>
      <span>${item.label}</span>
      <span class="lifestyle-interest-item__cost">~$${item.monthlyCost}/mo</span>
    </div>` : '';
  }).join('');

  const totalInterestCost = interests.reduce((sum, id) => {
    const item = INTERESTS_LIST.find(i => i.id === id);
    return sum + (item ? item.monthlyCost : 0);
  }, 0);

  const ownsHome    = !!(mortgageState && mortgageState.active);
  const startedHome = (playerSetup._originalLiving === 'home');
  const isWorking   = !!jobOfferState.accepted;
  const base        = expenseConfig[playerCareerPath.tier2] || { rent: 1000, food: 400, transport: 120, other: 130 };
  const lockLiving  = o => ownsHome || (o.requiresOriginalHome && !startedHome);
  const lockTransport = o => o.requiresOriginalHome && !startedHome;
  const lockPhone   = o => o.requiresOriginalHome && !startedHome;

  const curLiving    = playerSetup.living    || 'roommates';
  const curTransport = playerSetup.transport || 'transit';
  const curPhone     = playerSetup.phone     || 'mid';

  function livingOptionHTML(o) {
    const locked = lockLiving(o);
    const selected = o.id === curLiving;
    return `<div class="lifestyle-inline-option${selected ? ' selected' : ''}${locked ? ' locked' : ''}" data-living-inline="${o.id}" style="pointer-events:${locked ? 'none' : 'auto'}">
      <span class="lifestyle-option__icon">${o.icon}</span>
      <div class="lifestyle-option__body">
        <div class="lifestyle-option__label">${o.label}</div>
        <div class="lifestyle-option__cost">${o.cost}</div>
        ${locked ? `<div class="lifestyle-option__lock">🔒 ${ownsHome ? 'You own a home' : "Requires living at parents'"}</div>` : ''}
      </div>
      <span class="lifestyle-option__check">✓</span>
    </div>`;
  }
  function transportOptionHTML(o) {
    const locked = lockTransport(o);
    const selected = o.id === curTransport;
    return `<div class="lifestyle-inline-option${selected ? ' selected' : ''}${locked ? ' locked' : ''}" data-transport-inline="${o.id}" style="pointer-events:${locked ? 'none' : 'auto'}">
      <span class="lifestyle-option__icon">${o.icon}</span>
      <div class="lifestyle-option__body">
        <div class="lifestyle-option__label">${o.label}</div>
        <div class="lifestyle-option__cost">${o.cost}</div>
        ${locked ? `<div class="lifestyle-option__lock">🔒 Requires living at parents'</div>` : ''}
      </div>
      <span class="lifestyle-option__check">✓</span>
    </div>`;
  }
  function phoneOptionHTML(o) {
    const locked = lockPhone(o);
    const selected = o.id === curPhone;
    return `<div class="lifestyle-inline-option${selected ? ' selected' : ''}${locked ? ' locked' : ''}" data-phone-inline="${o.id}" style="pointer-events:${locked ? 'none' : 'auto'}">
      <span class="lifestyle-option__icon">${o.icon}</span>
      <div class="lifestyle-option__body">
        <div class="lifestyle-option__label">${o.label}</div>
        <div class="lifestyle-option__cost">${o.cost}</div>
        ${locked ? `<div class="lifestyle-option__lock">🔒 Requires living at parents'</div>` : ''}
      </div>
      <span class="lifestyle-option__check">✓</span>
    </div>`;
  }

  // Pre-compute new car section (avoids nested template literal issues)
  const newCarRows = NEW_CAR_OPTIONS.map(o =>
    '<div class="lifestyle-inline-option" data-newcar-inline="' + o.id + '">'
    + '<span class="lifestyle-option__icon">' + o.icon + '</span>'
    + '<div class="lifestyle-option__body">'
    + '<div class="lifestyle-option__label">' + o.label + '</div>'
    + '<div class="lifestyle-option__cost">' + o.cost + '</div>'
    + '</div><span class="lifestyle-option__check">✓</span></div>'
  ).join('');
  const newCarSectionHTML = '<div class="lifestyle-section-title" style="margin-top:16px">'
    + '🚘 Buy a New Car <span style="font-size:0.7rem;background:#e8f0fe;color:#1a56db;border-radius:4px;padding:2px 6px;font-weight:600;text-transform:none;margin-left:4px">Post-Graduation</span></div>'
    + '<div class="lifestyle-inline-options" id="new-car-inline-options">' + newCarRows + '</div>';
  const carLoanActiveSectionHTML = '<div class="lifestyle-section-title" style="margin-top:16px">🚘 Car Loan Active</div>'
    + '<p style="font-size:0.82rem;color:var(--clr-muted);margin-bottom:8px">' + carLoanState.carLabel + ' · ' + formatCurrency(carLoanState.monthlyPayment) + '/mo · ' + carLoanState.remainingMonths + ' mo left</p>';

  // Pre-compute part-time job section (avoids nested template literal issues)
  let ptSectionHTML = '';
  if (loanState.inSchool) {
    const ptStep = setupSteps.find(s => s.id === 'parttime');
    const curPtForHTML = playerSetup.parttime || 'none';
    if (ptStep) {
      const ptRows = ptStep.options.map(o => {
        const sel = o.id === curPtForHTML;
        const costTxt = o.effect.inSchoolIncome > 0 ? '+' + formatCurrency(o.effect.inSchoolIncome) + '/mo' : 'No income';
        return '<div class="lifestyle-inline-option' + (sel ? ' selected' : '') + '" data-pt-inline="' + o.id + '">'
          + '<span class="lifestyle-option__icon">' + o.icon + '</span>'
          + '<div class="lifestyle-option__body">'
          + '<div class="lifestyle-option__label">' + o.label + '</div>'
          + '<div class="lifestyle-option__cost">' + costTxt + '</div>'
          + '</div><span class="lifestyle-option__check">✓</span></div>';
      }).join('');
      ptSectionHTML = '<div class="lifestyle-section-title" style="margin-top:20px">'
        + '💼 Part-Time Job <span style="font-size:0.7rem;color:var(--clr-muted);text-transform:none;font-weight:500">While In School</span></div>'
        + '<div class="lifestyle-inline-options" id="parttime-inline-options">' + ptRows + '</div>';
    }
  }

  page.innerHTML = `
    <div class="lifestyle-page-header">
      <span class="lifestyle-page-title">🎛️ My Lifestyle</span>
      <span class="lifestyle-page-sub">How you live shapes what you spend</span>
    </div>

    <div class="lifestyle-section-title">🏠 Living Situation ${ownsHome ? '<span style="font-size:0.7rem;color:#c0392b;font-weight:600;text-transform:none">🔒 Homeowner</span>' : ''}</div>
    <div class="lifestyle-inline-options" id="living-inline-options">
      ${LIVING_OPTIONS.map(livingOptionHTML).join('')}
    </div>

    <div class="lifestyle-section-title" style="margin-top:16px">🚗 Transport</div>
    <div class="lifestyle-inline-options" id="transport-inline-options">
      ${TRANSPORT_OPTIONS.map(transportOptionHTML).join('')}
    </div>

    <div class="lifestyle-section-title" style="margin-top:16px">📱 Phone Plan</div>
    <div class="lifestyle-inline-options" id="phone-inline-options">
      ${PHONE_OPTIONS.map(phoneOptionHTML).join('')}
    </div>

    ${isWorking && !carLoanState.active ? newCarSectionHTML : carLoanState.active ? carLoanActiveSectionHTML : ''}

    ${ptSectionHTML}

    <div class="lifestyle-inline-save-row">
      <div id="lifestyle-inline-cost" style="font-size:0.82rem;color:var(--clr-muted);"></div>
      <button class="btn-lifestyle-change" id="lifestyle-inline-apply" style="margin-top:8px">Apply Changes ✓</button>
    </div>

    <div class="lifestyle-section-title" style="margin-top:20px">🎯 My Interests <span style="font-size:0.7rem;color:var(--clr-muted);text-transform:none;font-weight:500">(~$${totalInterestCost}/mo lifestyle spending)</span></div>
    ${interests.length > 0
      ? `<div class="lifestyle-interests-grid">${interestItems}</div>`
      : `<p style="font-size:0.82rem;color:var(--clr-muted);margin-bottom:12px">No interests selected yet.</p>`}

    <button class="btn-edit-interests" id="btn-edit-interests-page">✏️ Edit Interests</button>
  `;

  // Inline option wiring
  let selLiving = curLiving, selTransport = curTransport, selPhone = curPhone, selNewCar = null;
  const curPtJob = playerSetup.parttime || 'none';
  let selPt = curPtJob;

  function refreshInline() {
    page.querySelectorAll('[data-living-inline]').forEach(el => el.classList.toggle('selected', el.dataset.livingInline === selLiving));
    page.querySelectorAll('[data-transport-inline]').forEach(el => el.classList.toggle('selected', el.dataset.transportInline === selTransport && !selNewCar));
    page.querySelectorAll('[data-phone-inline]').forEach(el => el.classList.toggle('selected', el.dataset.phoneInline === selPhone));
    page.querySelectorAll('[data-newcar-inline]').forEach(el => el.classList.toggle('selected', selNewCar && selNewCar.id === el.dataset.newcarInline));

    const noChange = selLiving === curLiving && selTransport === curTransport && selPhone === curPhone && !selNewCar;
    const costEl = document.getElementById('lifestyle-inline-cost');
    if (noChange) {
      costEl.innerHTML = '<em>No changes.</em>';
    } else {
      const nr = ownsHome ? expenseState.rent : (selLiving === 'home' ? 0 : Math.round(base.rent * (selLiving === 'roommates' ? 0.6 : 1.0)));
      const nf = ownsHome ? expenseState.food : Math.round(base.food * (selLiving === 'home' ? 0.45 : 1.0));
      const nt = selNewCar ? selNewCar.transport : ((TRANSPORT_OPTIONS.find(x => x.id === selTransport) || {}).effect?.transportFlat ?? expenseState.transport);
      const np = (PHONE_OPTIONS.find(x => x.id === selPhone) || {}).effect?.phoneFlat ?? expenseState.phone;
      const tot = nr + nf + nt + np + expenseState.other + (expenseState.loanRepayment || 0) + (expenseState.mortgagePayment || 0);
      const d = tot - expenseState.monthlyTotal;
      const s = d >= 0 ? '+' : ''; const c = d > 0 ? '#c0392b' : d < 0 ? 'var(--clr-forest)' : 'var(--clr-muted)';
      const carNote = selNewCar ? `<br><em style="color:#c0392b">+ ${formatCurrency(selNewCar.payment)}/mo car loan (${selNewCar.months} mo)</em>` : '';
      costEl.innerHTML = `New total: <strong>${formatCurrency(tot)}/mo</strong> <span style="color:${c};font-weight:700">${s}${formatCurrency(d)}/mo</span>${carNote}`;
    }
  }

  page.addEventListener('click', e => {
    const l = e.target.closest('[data-living-inline]');   if (l) { selLiving = l.dataset.livingInline; refreshInline(); return; }
    const t = e.target.closest('[data-transport-inline]'); if (t) { selNewCar = null; selTransport = t.dataset.transportInline; refreshInline(); return; }
    const p = e.target.closest('[data-phone-inline]');     if (p) { selPhone = p.dataset.phoneInline; refreshInline(); return; }
    const nc = e.target.closest('[data-newcar-inline]');
    if (nc) {
      const o = NEW_CAR_OPTIONS.find(x => x.id === nc.dataset.newcarInline);
      selNewCar = (selNewCar && selNewCar.id === o.id) ? null : o;
      if (selNewCar) selTransport = '__nc__';
      refreshInline(); return;
    }
    const pt = e.target.closest('[data-pt-inline]');
    if (pt) {
      selPt = pt.dataset.ptInline;
      page.querySelectorAll('[data-pt-inline]').forEach(el => el.classList.toggle('selected', el.dataset.ptInline === selPt));
      return;
    }
  });

  document.getElementById('lifestyle-inline-apply').addEventListener('click', () => {
    if (!ownsHome && selLiving !== curLiving) {
      const o = LIVING_OPTIONS.find(x => x.id === selLiving);
      if (o && !lockLiving(o)) {
        playerSetup.living = selLiving;
        expenseState.rent = o.effect.rentFlat !== undefined ? o.effect.rentFlat : Math.round(base.rent * o.effect.rentMultiplier);
        expenseState.food = Math.round(base.food * o.effect.foodMultiplier);
        const rr = document.getElementById('row-exp-rent'); if (rr) rr.classList.toggle('hidden', expenseState.rent === 0);
      }
    }
    if (selNewCar) {
      carLoanState.active = true; carLoanState.monthlyPayment = selNewCar.payment;
      carLoanState.remainingMonths = selNewCar.months; carLoanState.carLabel = selNewCar.label;
      expenseState.transport = selNewCar.transport; playerSetup.transport = selNewCar.id;
    } else
    if (selTransport !== curTransport) {
      const o = TRANSPORT_OPTIONS.find(x => x.id === selTransport);
      if (o && !lockTransport(o)) { playerSetup.transport = selTransport; expenseState.transport = o.effect.transportFlat; }
    }
    if (selPhone !== curPhone) {
      const o = PHONE_OPTIONS.find(x => x.id === selPhone);
      if (o && !lockPhone(o)) { playerSetup.phone = selPhone; expenseState.phone = o.effect.phoneFlat; }
    }
    // Part-time job change (school phase only)
    if (loanState.inSchool && selPt !== curPtJob) {
      const ptStep = setupSteps.find(s => s.id === 'parttime');
      const ptOpt = ptStep && ptStep.options.find(o => o.id === selPt);
      if (ptOpt) {
        playerSetup.parttime = selPt;
        incomeState.baseIncome = ptOpt.effect.inSchoolIncome;
        incomeState.lastIncome = ptOpt.effect.inSchoolIncome;
        const incEl = document.getElementById('display-income');
        if (incEl) incEl.textContent = formatCurrency(incomeState.baseIncome);
        const jobEl = document.getElementById('display-income-job');
        if (jobEl) jobEl.textContent = formatCurrency(incomeState.baseIncome);
        const ptMarker = document.createElement('div'); ptMarker.className = 'history-tax-marker';
        ptMarker.style.cssText = 'background:linear-gradient(135deg,#e8f0fe,#f0f4ff);border-left-color:#1a56db';
        ptMarker.innerHTML = `<span>💼 Job Changed — ${ptOpt.label}</span><span>${ptOpt.effect.inSchoolIncome > 0 ? '+' + formatCurrency(ptOpt.effect.inSchoolIncome) + '/mo' : 'No income'}</span>`;
        historyFeed.insertBefore(ptMarker, historyFeed.firstChild);
      }
    }
    expenseState.monthlyTotal = expenseState.rent + expenseState.food + expenseState.transport + expenseState.phone + expenseState.other + (expenseState.loanRepayment || 0) + (expenseState.mortgagePayment || 0);
    const g = id => document.getElementById(id);
    if (g('display-exp-rent'))      g('display-exp-rent').textContent = formatCurrency(expenseState.rent);
    if (g('display-exp-food'))      g('display-exp-food').textContent = formatCurrency(expenseState.food);
    if (g('display-exp-transport')) g('display-exp-transport').textContent = formatCurrency(expenseState.transport);
    if (g('display-exp-phone'))     g('display-exp-phone').textContent = formatCurrency(expenseState.phone);
    if (g('display-expenses'))      g('display-expenses').textContent = formatCurrency(expenseState.monthlyTotal);
    updateLifestyleBadge();
    const mk = document.createElement('div'); mk.className = 'history-tax-marker';
    mk.style.cssText = 'background:linear-gradient(135deg,#e8f4e8,#f0f7f0);border-left-color:var(--clr-forest)';
    mk.innerHTML = `<span>🎛️ Lifestyle Changed</span><span>${formatCurrency(expenseState.monthlyTotal)}/mo</span>`;
    historyFeed.insertBefore(mk, historyFeed.firstChild);
    renderLifestylePage(); // re-render to show updated selections
  });

  document.getElementById('btn-edit-interests-page')?.addEventListener('click', () => {
    showInterestsEditModal();
  });
}

function showInterestsEditModal() {
  const ov = document.createElement('div');
  ov.className = 'lifestyle-modal-overlay';
  const selected = [...(playerSetup.interests || [])];

  ov.innerHTML = `<div class="lifestyle-modal">
    <div class="lifestyle-modal__title">✏️ Update Your Interests</div>
    <div class="lifestyle-modal__sub">Choose 1–5 interests. Changes affect upcoming monthly events.</div>
    <div class="interests-grid" id="modal-interests-grid">
      ${INTERESTS_LIST.map(i => `
        <button class="interest-chip${selected.includes(i.id) ? ' selected' : ''}" data-interest="${i.id}">
          <span class="interest-chip__icon">${i.icon}</span>
          <span>${i.label}</span>
          <span class="interest-chip__check">✓</span>
        </button>`).join('')}
    </div>
    <div class="lifestyle-modal__btns">
      <button class="lifestyle-modal__cancel" id="int-modal-cancel">Cancel</button>
      <button class="lifestyle-modal__confirm" id="int-modal-save">Save Interests ✓</button>
    </div>
  </div>`;

  ov.querySelectorAll('.interest-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.interest;
      const idx = selected.indexOf(id);
      if (idx === -1) {
        if (selected.length >= 5) return;
        selected.push(id);
        chip.classList.add('selected');
      } else {
        selected.splice(idx, 1);
        chip.classList.remove('selected');
      }
    });
  });

  document.body.appendChild(ov);
  ov.querySelector('#int-modal-cancel').addEventListener('click', () => ov.remove());
  ov.querySelector('#int-modal-save').addEventListener('click', () => {
    if (selected.length === 0) return;
    playerSetup.interests = selected;
    ov.remove();
    if (lifestyleViewActive) renderLifestylePage();
  });
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

/* ── RENDER PORTFOLIO PAGE ── */
function renderPortfolioPage() {
  const page = document.getElementById('portfolio-page');
  if (!page) return;

  const accounts = [
    { key: 'tfsa', label: 'TFSA',  icon: '🌿', cap: `${formatCurrency(TFSA_ANNUAL_LIMIT)}/yr` },
    { key: 'rrsp', label: 'RRSP',  icon: '🏔️', cap: 'No annual cap' },
    { key: 'fhsa', label: 'FHSA',  icon: '🏠', cap: `${formatCurrency(FHSA_ANNUAL_LIMIT)}/yr · ${formatCurrency(FHSA_LIFETIME_LIMIT)} lifetime` },
  ];

  // Compute totals across all accounts per investment type for donut
  const typeMap = { index: 0, stocks: 0, crypto: 0 };
  let grandTotal = 0;
  accounts.forEach(({ key }) => {
    Object.keys(INVEST_TYPES).forEach(type => {
      const bal = portfolioState.holdings[key][type].balance;
      typeMap[type] += bal;
      grandTotal += bal;
    });
  });

  // ── Account cards ──
  const accountCardsHTML = accounts.map(({ key, label, icon, cap }) => {
    const holdings = portfolioState.holdings[key];
    const contributed = totalContributed(key);
    const balance     = totalBalance(key);
    const gain        = balance - contributed;
    const gainPct     = contributed > 0 ? ((gain / contributed) * 100).toFixed(1) : '0.0';
    const gainClass   = gain >= 0 ? 'port-gain--pos' : 'port-gain--neg';
    const gainSign    = gain >= 0 ? '+' : '';

    const holdingRows = Object.entries(INVEST_TYPES).map(([type, t]) => {
      const h = holdings[type];
      if (h.balance < 0.5 && h.contributed === 0) return '';
      const hGain    = h.balance - h.contributed;
      const hGainSign = hGain >= 0 ? '+' : '';
      const hPct     = h.contributed > 0 ? ((hGain / h.contributed) * 100).toFixed(1) : '0.0';
      return `<div class="port-holding-row">
        <span class="port-holding-type" style="color:${t.color}">${t.icon} ${t.label}</span>
        <span class="port-holding-bal">${formatCurrency(Math.round(h.balance))}</span>
        <span class="port-holding-contrib">in: ${formatCurrency(Math.round(h.contributed))}</span>
        <span class="port-holding-gain ${hGain >= 0 ? 'port-gain--pos' : 'port-gain--neg'}">${hGainSign}${formatCurrency(Math.round(hGain))} (${hGainSign}${hPct}%)</span>
      </div>`;
    }).join('');

    const yearRoom = key === 'tfsa'
      ? `<div class="port-year-room">Annual room remaining: <strong>${formatCurrency(Math.max(0, TFSA_ANNUAL_LIMIT - portfolioState.tfsaYearContrib))}</strong></div>`
      : key === 'fhsa'
      ? `<div class="port-year-room">Annual room: <strong>${formatCurrency(Math.max(0, FHSA_ANNUAL_LIMIT - portfolioState.fhsaYearContrib))}</strong> · Lifetime: <strong>${formatCurrency(Math.max(0, FHSA_LIFETIME_LIMIT - balance))}</strong></div>`
      : '';

    return `<div class="port-account-card">
      <div class="port-account-card__header">
        <span class="port-account-card__icon">${icon}</span>
        <div class="port-account-card__meta">
          <span class="port-account-card__name">${label}</span>
          <span class="port-account-card__cap">${cap}</span>
        </div>
        <div class="port-account-card__totals">
          <span class="port-balance">${formatCurrency(Math.round(balance))}</span>
          <span class="${gainClass} port-gain-badge">${gainSign}${formatCurrency(Math.round(gain))} (${gainSign}${gainPct}%)</span>
        </div>
      </div>
      ${holdingRows ? `<div class="port-holdings">${holdingRows}</div>` : '<div class="port-empty">No contributions yet</div>'}
      ${yearRoom}
    </div>`;
  }).join('');

  // ── Donut chart SVG ──
  const donutHTML = grandTotal > 0 ? buildDonutChart(typeMap, grandTotal) : `<div class="port-donut-empty">Invest to see your allocation</div>`;

  // ── Growth log (last 6 months) ──
  const recentLog = portfolioState.growthLog.slice(-6).reverse();
  const logHTML = recentLog.length > 0
    ? recentLog.map(e => {
        const total = e.tfsa + e.rrsp + e.fhsa;
        const sign  = total >= 0 ? '+' : '';
        return `<div class="port-log-row">
          <span class="port-log-month">Month ${e.month}</span>
          <span class="port-log-tfsa">TFSA ${e.tfsa >= 0 ? '+' : ''}${formatCurrency(e.tfsa)}</span>
          <span class="port-log-rrsp">RRSP ${e.rrsp >= 0 ? '+' : ''}${formatCurrency(e.rrsp)}</span>
          <span class="port-log-fhsa">FHSA ${e.fhsa >= 0 ? '+' : ''}${formatCurrency(e.fhsa)}</span>
          <span class="port-log-total ${total >= 0 ? 'port-gain--pos' : 'port-gain--neg'}">${sign}${formatCurrency(total)}</span>
        </div>`;
      }).join('')
    : '<div class="port-empty">Growth will appear here once investments are earning</div>';

  page.innerHTML = `
    <div class="port-header">
      <h2 class="port-title">📈 Investment Portfolio</h2>
      <div class="port-summary">
        <div class="port-summary-stat">
          <span>Total Invested</span>
          <strong>${formatCurrency(Math.round(['tfsa','rrsp','fhsa'].reduce((s,a) => s + totalContributed(a), 0)))}</strong>
        </div>
        <div class="port-summary-stat">
          <span>Total Value</span>
          <strong>${formatCurrency(Math.round(grandTotal))}</strong>
        </div>
        <div class="port-summary-stat">
          <span>Total Growth</span>
          <strong class="${grandTotal - ['tfsa','rrsp','fhsa'].reduce((s,a) => s + totalContributed(a), 0) >= 0 ? 'port-gain--pos' : 'port-gain--neg'}">
            ${(()=>{ const contrib = ['tfsa','rrsp','fhsa'].reduce((s,a)=>s+totalContributed(a),0); const g=grandTotal-contrib; return (g>=0?'+':'')+formatCurrency(Math.round(g)); })()}
          </strong>
        </div>
      </div>
    </div>

    <div class="port-two-col">
      <div class="port-accounts">${accountCardsHTML}</div>
      <div class="port-chart-wrap">
        <h3 class="port-section-title">Allocation</h3>
        ${donutHTML}
        <div class="port-legend">
          ${Object.entries(INVEST_TYPES).map(([type, t]) => {
            const pct = grandTotal > 0 ? ((typeMap[type] / grandTotal) * 100).toFixed(0) : 0;
            return `<div class="port-legend-item">
              <span class="port-legend-dot" style="background:${t.color}"></span>
              <span>${t.icon} ${t.label}</span>
              <span class="port-legend-pct">${pct}%</span>
            </div>`;
          }).join('')}
        </div>
        <h3 class="port-section-title" style="margin-top:20px">Recent Growth</h3>
        <div class="port-growth-log">${logHTML}</div>
      </div>
    </div>`;
}

function buildDonutChart(typeMap, total) {
  const cx = 90, cy = 90, r = 70, stroke = 28;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const types = Object.keys(INVEST_TYPES);

  const segments = types.map(type => {
    const pct  = typeMap[type] / total;
    const dash = pct * circumference;
    const seg  = `<circle
      cx="${cx}" cy="${cy}" r="${r}"
      fill="none"
      stroke="${INVEST_TYPES[type].color}"
      stroke-width="${stroke}"
      stroke-dasharray="${dash} ${circumference - dash}"
      stroke-dashoffset="${-offset}"
      transform="rotate(-90 ${cx} ${cy})"
      opacity="${pct > 0 ? 1 : 0}">
      <title>${INVEST_TYPES[type].label}: ${(pct*100).toFixed(1)}%</title>
    </circle>`;
    offset += dash;
    return seg;
  }).join('');

  const totalLabel = formatCurrency(Math.round(total));

  return `<svg class="port-donut" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--clr-border)" stroke-width="${stroke}"/>
    ${segments}
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-family="var(--font-mono)" font-size="12" fill="var(--clr-text)" font-weight="700">${totalLabel}</text>
    <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="var(--font-body)" font-size="9" fill="var(--clr-muted)">Total</text>
  </svg>`;
}


/* ══════════════════════════════════════════════════════════════════
   NET WORTH TIMELINE CHART
   SVG line chart rendered in the right column above the history feed.
   Redraws each month when addHistoryEntry is called.
   Tracks: net worth, cash, and total investments as three lines.
   ══════════════════════════════════════════════════════════════════ */

const chartData = {
  points: [],   // { month, netWorth, cash, invested }
};

function recordChartPoint() {
  const invested = Math.round(
    gameState.tfsa + gameState.rrsp + gameState.fhsa + gameState.emergencyFund
  );
  chartData.points.push({
    month:    gameState.month,
    netWorth: Math.round(gameState.netWorth),
    cash:     Math.round(gameState.cash),
    invested,
  });
  renderNetWorthChart();
}

function renderNetWorthChart() {
  const el = document.getElementById('nw-chart');
  if (!el) return;

  const points = chartData.points;
  if (points.length < 2) {
    el.innerHTML = '<text x="50%" y="50%" text-anchor="middle" font-size="10" fill="#999" font-family="sans-serif">Play a few months to see your chart</text>';
    return;
  }

  const W = 216, H = 110, PAD = { top: 8, right: 8, bottom: 20, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  // Value range across all three series
  const allVals = points.flatMap(p => [p.netWorth, p.cash, p.invested]);
  const minVal  = Math.min(0, ...allVals);
  const maxVal  = Math.max(...allVals, 100);
  const valRange = maxVal - minVal || 1;

  const xScale = (i) => PAD.left + (i / (points.length - 1)) * plotW;
  const yScale = (v) => PAD.top  + plotH - ((v - minVal) / valRange) * plotH;

  const polyline = (series, color, dash = '') =>
    `<polyline points="${points.map((p, i) => `${xScale(i).toFixed(1)},${yScale(p[series]).toFixed(1)}`).join(' ')}"
       fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"
       ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;

  // Zero line
  const zeroY = yScale(0).toFixed(1);
  const zeroLine = minVal < 0
    ? `<line x1="${PAD.left}" y1="${zeroY}" x2="${W - PAD.right}" y2="${zeroY}" stroke="var(--clr-border)" stroke-width="1" stroke-dasharray="3,3"/>`
    : '';

  // Y-axis labels (3 ticks)
  const ticks = [minVal, minVal + valRange * 0.5, maxVal];
  const yLabels = ticks.map(v => {
    const y = yScale(v).toFixed(1);
    const label = v >= 1000 || v <= -1000
      ? `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v / 1000))}k`
      : `$${Math.round(v)}`;
    return `<text x="${PAD.left - 3}" y="${y}" text-anchor="end" dominant-baseline="middle"
              font-size="7" fill="var(--clr-muted)" font-family="var(--font-mono)">${label}</text>`;
  }).join('');

  // X-axis labels (first, middle, last month)
  const xLabelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const xLabels = [...new Set(xLabelIdx)].map(i => {
    const x = xScale(i).toFixed(1);
    return `<text x="${x}" y="${H - 4}" text-anchor="middle"
              font-size="7" fill="var(--clr-muted)" font-family="var(--font-mono)">M${points[i].month}</text>`;
  }).join('');

  // Latest value dot on net worth line
  const lastPt = points[points.length - 1];
  const dotX   = xScale(points.length - 1).toFixed(1);
  const dotY   = yScale(lastPt.netWorth).toFixed(1);
  const dotColor = lastPt.netWorth >= 0 ? '#27ae60' : '#c0392b';

  el.innerHTML = `
    <rect width="${W}" height="${H}" fill="transparent"/>
    <!-- Grid lines -->
    <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${H - PAD.bottom}" stroke="var(--clr-border)" stroke-width="0.5"/>
    ${zeroLine}
    <!-- Series lines -->
    ${polyline('invested', '#d4a843', '4,2')}
    ${polyline('cash',     '#2980b9')}
    ${polyline('netWorth', '#1b3a2d')}
    <!-- Labels -->
    ${yLabels}
    ${xLabels}
    <!-- Latest net worth dot -->
    <circle cx="${dotX}" cy="${dotY}" r="3" fill="${dotColor}" stroke="white" stroke-width="1"/>
  `;
}


/* ══════════════════════════════════════════════════════════════════
   END GAME SCREEN
   Fires at month 145 (age 30). Summarises the player's 12-year run.
   ══════════════════════════════════════════════════════════════════ */
function showEndGameScreen() {
  btnNextMonth.disabled = true;
  btnNextMonth.classList.add('hidden');

  const nw           = gameState.netWorth;
  const totalInvested = ['tfsa','rrsp','fhsa'].reduce(function(s, a) {
    return s + ['index','stocks','crypto'].reduce(function(ss, t) {
      return ss + portfolioState.holdings[a][t].contributed;
    }, 0);
  }, 0);
  const totalPortVal  = Math.round(gameState.tfsa + gameState.rrsp + gameState.fhsa);
  const investGrowth  = totalPortVal - totalInvested;
  const studentDebt   = loanState ? Math.round(loanState.studentDebt || 0) : 0;
  const hasHome       = mortgageState && mortgageState.active;
  const career        = jobOfferState.chosenJob ? jobOfferState.chosenJob.title : incomeState.phaseLabel;

  var grade;
  if      (nw >= 200000) grade = { label: 'Exceptional', icon: '💎', desc: 'You built serious wealth by 30. Your financial habits are setting you up for life.' };
  else if (nw >= 100000) grade = { label: 'Strong',       icon: '🌟', desc: 'A solid foundation. Consistent saving and smart choices put you well ahead of most Canadians your age.' };
  else if (nw >= 40000)  grade = { label: 'Good',         icon: '✅', desc: 'You are on the right track. A few more years of focused saving will accelerate your progress.' };
  else if (nw >= 0)      grade = { label: 'Getting There',icon: '🌱', desc: 'You made it to 30 without going under. Now is the time to get serious about investing.' };
  else                   grade = { label: 'In the Red',   icon: '⚠️', desc: 'Debt outweighs your assets. Focus on paying down high-interest debt before anything else.' };

  var card    = document.getElementById('month-card');
  var welcome = document.getElementById('welcome-card');
  welcome.classList.add('hidden');
  card.classList.remove('hidden');
  if (!document.getElementById('btn-confirm-month')) restoreMonthCard();

  var debtRow = studentDebt > 0
    ? '<div class="endgame-stat"><span class="endgame-stat__label">Student Debt Left</span><span class="endgame-stat__val neg">-' + formatCurrency(studentDebt) + '</span></div>'
    : '<div class="endgame-stat"><span class="endgame-stat__label">Student Debt</span><span class="endgame-stat__val pos">Cleared! 🎉</span></div>';

  var homeRow = hasHome
    ? '<div class="endgame-stat"><span class="endgame-stat__label">Home Equity</span><span class="endgame-stat__val pos">' + formatCurrency(Math.round(gameState.homeEquity)) + '</span></div>'
    : '';

  var ccRow = creditState.active
    ? '<div class="endgame-stat"><span class="endgame-stat__label">Credit Score</span><span class="endgame-stat__val">' + creditState.score + '</span></div>'
    : '';

  card.innerHTML =
    '<div class="endgame-screen">' +
      '<div class="endgame-badge">🍁 You have reached Age 30</div>' +
      '<div class="endgame-grade">' +
        '<span class="endgame-grade__icon">' + grade.icon + '</span>' +
        '<span class="endgame-grade__label">' + grade.label + '</span>' +
      '</div>' +
      '<p class="endgame-grade__desc">' + grade.desc + '</p>' +
      '<div class="endgame-stats">' +
        '<div class="endgame-stat"><span class="endgame-stat__label">Net Worth</span><span class="endgame-stat__val ' + (nw >= 0 ? 'pos' : 'neg') + '">' + formatCurrency(nw) + '</span></div>' +
        '<div class="endgame-stat"><span class="endgame-stat__label">Cash</span><span class="endgame-stat__val">' + formatCurrency(Math.round(gameState.cash)) + '</span></div>' +
        '<div class="endgame-stat"><span class="endgame-stat__label">Portfolio Value</span><span class="endgame-stat__val pos">' + formatCurrency(totalPortVal) + '</span></div>' +
        '<div class="endgame-stat"><span class="endgame-stat__label">Investment Growth</span><span class="endgame-stat__val ' + (investGrowth >= 0 ? 'pos' : 'neg') + '">' + (investGrowth >= 0 ? '+' : '') + formatCurrency(Math.round(investGrowth)) + '</span></div>' +
        '<div class="endgame-stat"><span class="endgame-stat__label">Emergency Fund</span><span class="endgame-stat__val pos">' + formatCurrency(Math.round(gameState.emergencyFund)) + '</span></div>' +
        debtRow + homeRow + ccRow +
        '<div class="endgame-stat"><span class="endgame-stat__label">Career</span><span class="endgame-stat__val">' + career + '</span></div>' +
        '<div class="endgame-stat"><span class="endgame-stat__label">Monthly Income</span><span class="endgame-stat__val pos">' + formatCurrency(incomeState.baseIncome) + '/mo</span></div>' +
      '</div>' +
      '<button class="btn-confirm-month" onclick="location.reload()" style="margin-top:20px">🔄 Play Again</button>' +
    '</div>';
}


/* ══════════════════════════════════════════════════════════════════
   HISA — HIGH INTEREST SAVINGS ACCOUNT
   4.5% APR on the HISA balance, compounded monthly.
   Interest is applied each month in finishMonth.
   Player can deposit from cash any month via the allocator.
   ══════════════════════════════════════════════════════════════════ */

const HISA_APR         = 0.045;   // 4.5% annual
const HISA_MONTHLY_RATE = HISA_APR / 12;

function applyHISAInterest() {
  if (gameState.hisa <= 0) return 0;
  const interest = Math.round(gameState.hisa * HISA_MONTHLY_RATE * 100) / 100;
  gameState.hisa += interest;
  return interest;
}


/* ══════════════════════════════════════════════════════════════════
   TOOLTIP SYSTEM
   Any element with data-tip="key" shows a floating tooltip on hover.
   ══════════════════════════════════════════════════════════════════ */

const TOOLTIPS = {
  hisa:  { title: '🏦 HISA — High Interest Savings Account', body: 'Earns 4.5% annual interest on your balance — paid monthly, fully liquid, zero risk. The first account every Canadian should use. Keep your emergency fund and short-term savings here.' },
  ef:    { title: '🛡️ Emergency Fund', body: 'A dedicated safety buffer covering 3–6 months of expenses. When a negative event fires, your EF absorbs the cost so it never hits your investing budget. Build this before anything else.' },
  tfsa:  { title: '🌿 TFSA — Tax-Free Savings Account', body: 'All growth and withdrawals are completely tax-free. $7,000/year contribution limit in 2024. Withdrawn room is restored the following year. Almost always the first registered account to fill.' },
  rrsp:  { title: '🏔️ RRSP — Registered Retirement Savings Plan', body: 'Contributions reduce your taxable income this year. Growth is tax-sheltered until withdrawal. Best used when you are in a higher tax bracket. The tax deduction shows up at your annual filing.' },
  fhsa:  { title: '🏠 FHSA — First Home Savings Account', body: 'Combines RRSP tax deductions with TFSA tax-free withdrawals — but only for buying your first home. $8,000/year, $40,000 lifetime. If you plan to buy a home, this is essential.' },
  osap:  { title: '🎓 OSAP', body: 'Ontario Student Assistance Program. Grants are free money — no repayment. Loans accumulate interest at 5% annually after graduation. Apply every year you are in school.' },
  networth: { title: '📊 Net Worth', body: 'Assets minus liabilities. Cash + investments + home equity minus all debt. This is the number that matters most — growing it steadily over time is the goal of the game.' },
};

(function initTooltips() {
  const box   = document.getElementById('tooltip-box');
  const title = document.getElementById('tooltip-title');
  const body  = document.getElementById('tooltip-body');
  if (!box) return;

  let hideTimer = null;

  function showTooltip(el, key) {
    const tip = TOOLTIPS[key];
    if (!tip) return;
    title.textContent = tip.title;
    body.textContent  = tip.body;
    box.classList.remove('hidden');

    // Position near the trigger element
    const rect = el.getBoundingClientRect();
    const boxW  = 280;
    let left = rect.left + window.scrollX;
    let top  = rect.bottom + window.scrollY + 6;

    // Keep within viewport
    if (left + boxW > window.innerWidth - 12) left = window.innerWidth - boxW - 12;
    if (left < 8) left = 8;

    box.style.left = left + 'px';
    box.style.top  = top  + 'px';
  }

  function hideTooltip() {
    box.classList.add('hidden');
  }

  document.addEventListener('mouseover', function(e) {
    const trigger = e.target.closest('[data-tip]');
    if (trigger) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      showTooltip(trigger, trigger.dataset.tip);
    }
  });

  document.addEventListener('mouseout', function(e) {
    const trigger = e.target.closest('[data-tip]');
    if (trigger) {
      hideTimer = setTimeout(hideTooltip, 200);
    }
  });

  // Tap on mobile
  document.addEventListener('click', function(e) {
    const trigger = e.target.closest('[data-tip]');
    if (trigger) {
      e.stopPropagation();
      if (box.classList.contains('hidden')) {
        showTooltip(trigger, trigger.dataset.tip);
      } else {
        hideTooltip();
      }
    } else if (!box.contains(e.target)) {
      hideTooltip();
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   INSTRUCTIONS SCREEN
   ══════════════════════════════════════════════════════════════════ */
(function initInstructions() {
  const screen  = document.getElementById('instructions-screen');
  const startBtn = document.getElementById('btn-to-career');
  if (!screen || !startBtn) return;

  // Tab switching
  screen.addEventListener('click', function(e) {
    const tab = e.target.closest('.instr-tab');
    if (!tab) return;
    const key = tab.dataset.tab;
    screen.querySelectorAll('.instr-tab').forEach(t => t.classList.remove('instr-tab--active'));
    screen.querySelectorAll('.instr-panel').forEach(p => p.classList.remove('instr-panel--active'));
    tab.classList.add('instr-tab--active');
    const panel = document.getElementById('tab-' + key);
    if (panel) panel.classList.add('instr-panel--active');
  });

  // Continue to career screen
  startBtn.addEventListener('click', function() {
    screen.classList.add('hidden');
    document.getElementById('career-screen').classList.remove('hidden');
  });
})();


/* ══════════════════════════════════════════════════════════════════
   ANNUAL REVIEW CARD
   Full-centre interstitial shown every 12 months of working life.
   Five outcomes: promotion, raise, bonus, flat, layoff.
   Player reads the card and clicks Continue to see the month card.
   ══════════════════════════════════════════════════════════════════ */

function showAnnualReviewCard(result) {
  window._ffInterrupted = true;  // pause fast-forward
  const job   = jobOfferState.chosenJob;
  const year  = jobOfferState.yearsWorked;
  const stab  = job ? job.stability : 'medium';

  // ── Build outcome-specific content ──
  let badge, heading, icon, bodyHTML, statsHTML, noteHTML;

  if (result.type === 'promotion') {
    badge    = 'Year ' + year + ' Review · Promotion';
    icon     = '🏆';
    heading  = 'You have been promoted!';
    bodyHTML = 'Your hard work has paid off. Your title has changed to <strong>' + job.title + '</strong> and your salary reflects your new seniority.';
    statsHTML =
      '<div class="review-stat review-stat--pos">' +
        '<span>New Monthly Salary</span>' +
        '<strong>' + formatCurrency(result.newSalary) + '/mo</strong>' +
      '</div>' +
      '<div class="review-stat">' +
        '<span>Salary Increase</span>' +
        '<strong class="pos">+' + formatCurrency(result.raiseAmt) + '/mo (+' + Math.round((result.raiseAmt / result.oldSalary) * 100) + '%)</strong>' +
      '</div>' +
      '<div class="review-stat">' +
        '<span>Annual Increase</span>' +
        '<strong class="pos">+' + formatCurrency(result.raiseAmt * 12) + '/yr</strong>' +
      '</div>';
    noteHTML = '💡 A promotion is the fastest way to grow income. Pair it with increased TFSA contributions this year.';

  } else if (result.type === 'raise') {
    badge    = 'Year ' + year + ' Review · Annual Raise';
    icon     = '📈';
    heading  = 'Annual performance review';
    bodyHTML = 'Another year of solid work. Your employer recognizes your contribution with a cost-of-living and merit raise.';
    statsHTML =
      '<div class="review-stat review-stat--pos">' +
        '<span>New Monthly Salary</span>' +
        '<strong>' + formatCurrency(result.newSalary) + '/mo</strong>' +
      '</div>' +
      '<div class="review-stat">' +
        '<span>Monthly Raise</span>' +
        '<strong class="pos">+' + formatCurrency(result.raiseAmt) + '/mo</strong>' +
      '</div>' +
      '<div class="review-stat">' +
        '<span>Annual Impact</span>' +
        '<strong class="pos">+' + formatCurrency(result.raiseAmt * 12) + '/yr</strong>' +
      '</div>';
    noteHTML = '💡 Even a 2-3% raise compounds significantly over a career. Investing the difference each month accelerates your net worth.';

  } else if (result.type === 'bonus') {
    badge    = 'Year ' + year + ' Review · Bonus Year';
    icon     = '🎉';
    heading  = 'Bonus! Great year.';
    bodyHTML = 'Strong performance this year earned you a bonus. It has been added to your cash balance. You also received a small salary increase.';
    statsHTML =
      '<div class="review-stat review-stat--pos">' +
        '<span>Bonus Received</span>' +
        '<strong>' + formatCurrency(result.bonusAmt) + ' (cash)</strong>' +
      '</div>' +
      '<div class="review-stat">' +
        '<span>New Monthly Salary</span>' +
        '<strong>' + formatCurrency(result.newSalary) + '/mo</strong>' +
      '</div>' +
      '<div class="review-stat">' +
        '<span>Salary Raise</span>' +
        '<strong class="pos">+' + formatCurrency(result.raiseAmt) + '/mo</strong>' +
      '</div>';
    noteHTML = '💡 A bonus is a great time to max out your TFSA or FHSA contribution room. Resist the urge to spend it all at once.';

  } else if (result.type === 'flat') {
    const flatReasons = {
      high:   'The organization had a tight budget year. Your role is secure, but raises are on hold.',
      medium: 'Mixed results across the company this year. Performance was noted but salary adjustments were paused.',
      low:    'The market was tough. You kept your job — that alone is a win in this environment.',
    };
    badge    = 'Year ' + year + ' Review · No Raise';
    icon     = '⏸️';
    heading  = 'Flat year.';
    bodyHTML = flatReasons[stab] || flatReasons.medium;
    statsHTML =
      '<div class="review-stat">' +
        '<span>Monthly Salary</span>' +
        '<strong>' + formatCurrency(result.newSalary) + '/mo (unchanged)</strong>' +
      '</div>';
    noteHTML = '💡 A flat year is a signal to revisit your career options. Could you negotiate, upskill, or switch roles to accelerate income growth?';

  } else if (result.type === 'layoff') {
    badge    = 'Year ' + year + ' Review · Layoff';
    icon     = '⚠️';
    heading  = 'You have been laid off.';
    bodyHTML = 'Budget cuts hit your team. You have been let go but are picking up contract work to bridge the gap. Your income will be reduced for <strong>' + result.months + ' months</strong>, then recover.';
    statsHTML =
      '<div class="review-stat review-stat--neg">' +
        '<span>Reduced Income</span>' +
        '<strong class="neg">' + formatCurrency(result.reducedSalary) + '/mo (' + Math.round(result.dropPct * 100) + '% drop)</strong>' +
      '</div>' +
      '<div class="review-stat">' +
        '<span>Duration</span>' +
        '<strong>' + result.months + ' months</strong>' +
      '</div>' +
      '<div class="review-stat">' +
        '<span>Previous Salary</span>' +
        '<strong>' + formatCurrency(result.oldSalary) + '/mo</strong>' +
      '</div>';
    noteHTML = '🛡️ This is exactly why an Emergency Fund exists. Lean on it now, pause discretionary investing, and your income will recover.';
  }

  // ── Add to history feed ──
  const histDiv = document.createElement('div');
  histDiv.className = 'history-tax-marker history-tax-marker--review';
  histDiv.innerHTML =
    '<span>' + icon + ' Year ' + year + ' Review: ' + result.type.charAt(0).toUpperCase() + result.type.slice(1) + '</span>' +
    '<span>' + (result.type === 'promotion' ? '+' + formatCurrency(result.raiseAmt) + '/mo' :
                result.type === 'bonus'     ? '+' + formatCurrency(result.bonusAmt)         :
                result.type === 'layoff'    ? '−' + Math.round(result.dropPct * 100) + '% income' :
                result.type === 'flat'      ? 'No raise'                                   :
                '+' + formatCurrency(result.raiseAmt) + '/mo') + '</span>';
  historyFeed.insertBefore(histDiv, historyFeed.firstChild);

  // ── Render the card ──
  setMonthCardContent(
    '<div class="review-card">' +
      '<div class="review-card__badge">' + badge + '</div>' +
      '<div class="review-card__icon">' + icon + '</div>' +
      '<h2 class="review-card__heading">' + heading + '</h2>' +
      '<p class="review-card__body">' + bodyHTML + '</p>' +
      '<div class="review-stats">' + statsHTML + '</div>' +
      '<div class="review-note">' + noteHTML + '</div>' +
      '<button class="btn-confirm-month review-continue" id="btn-review-continue">Continue →</button>' +
    '</div>'
  );

  document.getElementById('btn-review-continue').addEventListener('click', function() {
    restoreMonthCard();
    resumeMonthAfterInterstitial();
  });

  btnNextMonth.disabled = true;
}
btnNextMonth.addEventListener('click', advanceMonth);

document.getElementById('btn-portfolio').addEventListener('click', togglePortfolioView);
document.getElementById('btn-lifestyle-tab').addEventListener('click', toggleLifestyleView);

function initGame() {
  displayMonth.textContent    = gameState.month;
  displayCash.textContent     = formatCurrency(gameState.cash);
  displayNetworth.textContent = formatCurrency(gameState.netWorth);
  btnNextMonth.disabled = false;
  btnNextMonth.classList.remove('hidden');

  initLoanSystem();
  initIncomeSystem();

  // Re-apply OSAP from wizard choices — initIncomeSystem() resets osapMonthly to 0,
  // so we must restore the player's chosen values immediately after.
  const _ef = playerSetup.effects || {};
  if (_ef.osapMonthly !== undefined) {
    incomeState.osapMonthly   = _ef.osapMonthly;
    incomeState.osapGrantFrac = _ef.osapGrantFraction ?? 0;
    if (loanState.active) updateLoanDisplay();
  }

  initExpenseSystem();   // Phase B: sets fixed monthly costs + populates displays
  initInvestSystem();
  initTaxSystem();

  tipState.remaining = hotTips.map((_, i) => i);

  // Reset job offer + housing state on new game
  jobOfferState.offered             = false;
  jobOfferState.accepted            = false;
  jobOfferState.pendingTransition   = false;
  jobOfferState.chosenJob           = null;
  jobOfferState.monthsAtJob         = 0;
  jobOfferState.yearsWorked         = 0;
  jobOfferState.reviewPending       = false;
  jobOfferState.layoffActive        = false;
  jobOfferState.layoffMonthsLeft    = 0;
  jobOfferState.layoffOriginalIncome = 0;
  housingOfferFired               = false;
  housingOfferMonth               = 0;
  housingState_pendingTrigger     = false;
  mortgageState.active            = false;
  mortgageState.balance           = 0;
  gameState.homeValue             = 0;
  gameState.homeEquity            = 0;

  // Workforce players skip job offer screen (already working from day 1)
  if (playerCareerPath.tier1 === 'workforce') {
    jobOfferState.offered  = true;
    jobOfferState.accepted = true;
    jobOfferState.chosenJob = {
      title: incomeState.phaseLabel,
      salary: incomeState.baseIncome,
      stability: 'medium',
      bonusChance: 0.10,
    };
    incomeState.varianceOverride = STABILITY_VARIANCE['medium'];
  }

  gameState.emergencyFund = 0;
  gameState.hisa = 0;
  updateEFProgressBar();
  chartData.points = [];
  const chartEl = document.getElementById('nw-chart');
  if (chartEl) chartEl.innerHTML = '<text x="50%" y="50%" text-anchor="middle" font-size="10" fill="#999" font-family="sans-serif">Play a few months to see your chart</text>';
  creditState.offered          = false;
  creditState.active           = false;
  creditState.declined         = false;
  creditState.declinedOnce     = false;
  creditState.secondOfferMonth = 0;
  creditState.balance          = 0;
  creditState.limit            = 0;
  creditState.monthlyCharge    = 0;
  creditState.eventCharge      = 0;
  creditState.lastEventTitle   = '';
  creditState.missedPayments   = 0;
  creditState.monthsOpen       = 0;
  creditState.consecutiveFullPayments = 0;
  creditState.score            = 660;
  creditState.statementDue     = false;
  creditState.limitIncreaseOffered = false;
  creditState.premiumOffered   = false;
  updateCreditScoreDisplay();
  // Store original choices
  playerSetup._originalLiving    = playerSetup.living;
  playerSetup._originalTransport = playerSetup.transport;
  const phoneMap = { basic:'basic', mid:'mid', premium:'premium', family:'family' };
  playerSetup.phone = phoneMap[playerSetup.phone] || playerSetup.phone || 'mid';
  window._fhsaClosed = false;
  gameState.totalIncome = 0;
  carLoanState.active=false; carLoanState.monthlyPayment=0; carLoanState.remainingMonths=0; carLoanState.carLabel='';
  const lifestylePanel=document.getElementById('lifestyle-panel');
  if(lifestylePanel){ lifestylePanel.classList.remove('hidden'); if(typeof updateLifestyleBadge==='function') updateLifestyleBadge(); }
  // Show the Lifestyle tab button in the topbar
  const lifestyleTabBtn = document.getElementById('btn-lifestyle-tab');
  if (lifestyleTabBtn) lifestyleTabBtn.classList.remove('hidden');

  // Budget challenge / reflection setup
  _yearInvestedAccum = 0;
  budgetGoal.monthlyTarget = 0;
  budgetGoal.yearlyActual  = 0;
  budgetGoal.totalInvested = 0;

  console.log('[Maple Money] Game ready.');
}

/* ══════════════════════════════════════════════════════════
   AUTO-CONTRIBUTION PRESETS
   ══════════════════════════════════════════════════════════ */
const autoContrib = { ef: 0, hisa: 0, tfsa: 0, rrsp: 0, fhsa: 0 };

function initAutoContribPanel() {
  const toggle = document.getElementById('auto-contrib-toggle');
  const panel  = document.getElementById('auto-contrib-panel');
  const saveBtn= document.getElementById('auto-contrib-save');
  if (!toggle || !panel || !saveBtn) return;
  ['ef','hisa','tfsa','rrsp','fhsa'].forEach(k => {
    const inp = document.getElementById('auto-'+k); if(!inp) return;
    inp.value = autoContrib[k]||0; inp.addEventListener('input', updateAutoContribTotal);
  });
  updateAutoContribTotal();
  const ft = toggle.cloneNode(true); toggle.parentNode.replaceChild(ft, toggle);
  ft.addEventListener('click', () => {
    const hidden = panel.classList.toggle('hidden');
    ft.classList.toggle('active', !hidden);
    if (!hidden) { ['ef','hisa','tfsa','rrsp','fhsa'].forEach(k=>{ const i=document.getElementById('auto-'+k); if(i) i.value=autoContrib[k]||0; }); updateAutoContribTotal(); }
  });
  const fs = saveBtn.cloneNode(true); saveBtn.parentNode.replaceChild(fs, saveBtn);
  fs.addEventListener('click', () => {
    ['ef','hisa','tfsa','rrsp','fhsa'].forEach(k => {
      if(k==='fhsa'&&window._fhsaClosed){autoContrib[k]=0;return;}
      autoContrib[k]=Math.max(0,parseInt(document.getElementById('auto-'+k)?.value)||0);
    });
    ['ef','hisa','tfsa','rrsp','fhsa'].forEach(k => { const el=document.getElementById('alloc-'+k); if(el) el.value=(k==='fhsa'&&window._fhsaClosed)?0:(autoContrib[k]||0); });
    updateAllocRemainder();
    fs.textContent='✓ Saved!'; setTimeout(()=>{ fs.textContent='Save Presets ✓'; },1500);
    panel.classList.add('hidden'); ft.classList.remove('active'); updateAutoContribBadge();
  });
}
function updateAutoContribTotal() {
  const t=['ef','hisa','tfsa','rrsp','fhsa'].reduce((s,k)=>s+(parseInt(document.getElementById('auto-'+k)?.value)||0),0);
  const el=document.getElementById('auto-contrib-total'); if(el) el.textContent=formatCurrency(Math.max(0,t))+' / month';
}
function updateAutoContribBadge() {
  const tg=document.getElementById('auto-contrib-toggle'); if(!tg) return;
  const t=Object.values(autoContrib).reduce((a,b)=>a+b,0);
  tg.textContent=t>0?'📌 Auto · '+formatCurrency(t)+'/mo':'📌 Auto';
  tg.classList.toggle('active',t>0);
}
initAutoContribPanel();

/* ══════════════════════════════════════════════════════════
   CAR LOAN STATE
   ══════════════════════════════════════════════════════════ */
const carLoanState = { active:false, monthlyPayment:0, remainingMonths:0, carLabel:'' };

function processCarLoanMonth() {
  if (!carLoanState.active) return;
  carLoanState.remainingMonths--;
  if (carLoanState.remainingMonths <= 0) {
    carLoanState.active = false;
    expenseState.transport = Math.max(0, expenseState.transport - carLoanState.monthlyPayment);
    expenseState.monthlyTotal = expenseState.rent+expenseState.food+expenseState.transport+expenseState.phone+expenseState.other+(expenseState.loanRepayment||0)+(expenseState.mortgagePayment||0);
    const m=document.createElement('div'); m.className='history-tax-marker';
    m.style.cssText='background:linear-gradient(135deg,#e8f4e8,#f0f7f0);border-left-color:var(--clr-forest)';
    m.innerHTML=`<span>🚘 Car Paid Off!</span><span>-${formatCurrency(carLoanState.monthlyPayment)}/mo freed</span>`;
    historyFeed.insertBefore(m,historyFeed.firstChild);
  }
}

/* ══════════════════════════════════════════════════════════
   LIFESTYLE CHANGE SYSTEM
   ══════════════════════════════════════════════════════════ */
const LIVING_OPTIONS = [
  { id:'home',      icon:'🏠', label:'At Home with Parents', cost:'$0/mo rent · low food', effect:{rentFlat:0,foodMultiplier:0.45}, requiresOriginalHome:true  },
  { id:'roommates', icon:'👥', label:'Shared Housing',        cost:'~60% of market rent',  effect:{rentMultiplier:0.60,foodMultiplier:1.0}, requiresOriginalHome:false },
  { id:'solo',      icon:'🏢', label:'Renting Independently', cost:'Full rent + expenses', effect:{rentMultiplier:1.0,foodMultiplier:1.0},  requiresOriginalHome:false },
];
const TRANSPORT_OPTIONS = [
  { id:'family-car', icon:'🚗', label:'Family Car',     cost:'~$250/mo', effect:{transportFlat:250}, requiresOriginalHome:true  },
  { id:'used-car',   icon:'🚙', label:'Used Car',       cost:'~$500/mo', effect:{transportFlat:500}, requiresOriginalHome:false },
  { id:'transit',    icon:'🚌', label:'Public Transit', cost:'~$130/mo', effect:{transportFlat:130}, requiresOriginalHome:false },
  { id:'bike',       icon:'🚲', label:'Bike / Walk',    cost:'~$20/mo',  effect:{transportFlat:20},  requiresOriginalHome:false },
];
const PHONE_OPTIONS = [
  { id:'family',  icon:'👨‍👩‍👧', label:"Parents' Plan",  cost:'~$20/mo', effect:{phoneFlat:20}, requiresOriginalHome:true  },
  { id:'basic',   icon:'📵', label:'Basic Plan',       cost:'~$30/mo', effect:{phoneFlat:30}, requiresOriginalHome:false },
  { id:'mid',     icon:'📱', label:'Mid-Range Plan',   cost:'~$55/mo', effect:{phoneFlat:55}, requiresOriginalHome:false },
  { id:'premium', icon:'📲', label:'Premium/Unlimited',cost:'~$85/mo', effect:{phoneFlat:85}, requiresOriginalHome:false },
];
const NEW_CAR_OPTIONS = [
  { id:'new-compact', icon:'🚘', label:'New Compact',     cost:'$420/mo · 60mo', payment:420, months:60, transport:500 },
  { id:'new-suv',     icon:'🚙', label:'New SUV / Truck', cost:'$590/mo · 60mo', payment:590, months:60, transport:700 },
];

function showLifestyleModal() {
  const ownsHome     = !!(mortgageState&&mortgageState.active);
  const isWorking    = !!jobOfferState.accepted;
  const startedHome  = (playerSetup._originalLiving==='home');
  const curLiving    = playerSetup.living    ||'roommates';
  const curTransport = playerSetup.transport ||'transit';
  const curPhone     = playerSetup.phone     ||'mid';
  let selLiving=curLiving, selTransport=curTransport, selPhone=curPhone, selNewCar=null;
  const base = expenseConfig[playerCareerPath.tier2]||{rent:1000,food:400,transport:120,other:130};

  const lockLiving   = o => ownsHome||(o.requiresOriginalHome&&!startedHome);
  const lockTransport= o => o.requiresOriginalHome&&!startedHome;
  const lockPhone    = o => o.requiresOriginalHome&&!startedHome;

  const newRent    = id=>{ const o=LIVING_OPTIONS.find(x=>x.id===id); return o?(o.effect.rentFlat!==undefined?o.effect.rentFlat:Math.round(base.rent*o.effect.rentMultiplier)):expenseState.rent; };
  const newFood    = id=>{ const o=LIVING_OPTIONS.find(x=>x.id===id); return o?Math.round(base.food*o.effect.foodMultiplier):expenseState.food; };
  const newTransp  = (id,nc)=>{ if(nc) return nc.transport; const o=TRANSPORT_OPTIONS.find(x=>x.id===id); return o?o.effect.transportFlat:expenseState.transport; };
  const newPhone   = id=>{ const o=PHONE_OPTIONS.find(x=>x.id===id); return o?o.effect.phoneFlat:expenseState.phone; };

  function costHTML() {
    if(selLiving===curLiving&&selTransport===curTransport&&selPhone===curPhone&&!selNewCar) return '<em style="color:var(--clr-muted)">No changes.</em>';
    const nr=ownsHome?expenseState.rent:newRent(selLiving);
    const nf=ownsHome?expenseState.food:newFood(selLiving);
    const nt=newTransp(selTransport,selNewCar); const np=newPhone(selPhone);
    const tot=nr+nf+nt+np+expenseState.other+(expenseState.loanRepayment||0)+(expenseState.mortgagePayment||0);
    const d=tot-expenseState.monthlyTotal; const s=d>=0?'+':''; const c=d>0?'#c0392b':d<0?'var(--clr-forest)':'var(--clr-muted)';
    const cl=selNewCar?`<br><em style="color:#c0392b">+ ${formatCurrency(selNewCar.payment)}/mo car loan</em>`:'';
    return `New: <strong>${formatCurrency(tot)}/mo</strong> <span style="color:${c};font-weight:700">${s}${formatCurrency(d)}/mo</span>${cl}`;
  }

  function optRow(o, attr, sel, locked, ownMsg) {
    const lm = locked?(ownMsg||"Requires living at parents'"):'';
    return `<div class="lifestyle-option${sel?' selected':''}${locked?' locked':''}" ${locked?'':` ${attr}="${o.id}"`}>
      <span class="lifestyle-option__icon">${o.icon}</span>
      <div class="lifestyle-option__body"><div class="lifestyle-option__label">${o.label}</div><div class="lifestyle-option__cost">${o.cost}</div>${lm?`<div class="lifestyle-option__lock">🔒 ${lm}</div>`:''}</div>
      <span class="lifestyle-option__check">✓</span></div>`;
  }

  const lockMsg = ownsHome?'🔒 Locked — homeowner':(!startedHome?'(some locked)':'');
  const carSect = isWorking&&!carLoanState.active
    ? `<hr class="lifestyle-modal__divider"><div class="lifestyle-modal__section"><div class="lifestyle-modal__section-title">🚘 Buy a New Car <span class="car-purchase-badge">Post-Graduation</span></div>
       ${NEW_CAR_OPTIONS.map(o=>`<div class="lifestyle-option${selNewCar?.id===o.id?' selected':''}" data-new-car="${o.id}"><span class="lifestyle-option__icon">${o.icon}</span><div class="lifestyle-option__body"><div class="lifestyle-option__label">${o.label}</div><div class="lifestyle-option__cost">${o.cost}</div></div><span class="lifestyle-option__check">✓</span></div>`).join('')}</div>`
    : carLoanState.active?`<hr class="lifestyle-modal__divider"><div class="lifestyle-modal__section"><div class="lifestyle-modal__section-title">🚘 Car Loan Active</div><p style="font-size:0.78rem;color:var(--clr-muted)">${carLoanState.carLabel} · ${formatCurrency(carLoanState.monthlyPayment)}/mo · ${carLoanState.remainingMonths} mo left</p></div>` : '';

  const ov=document.createElement('div'); ov.className='lifestyle-modal-overlay';
  ov.innerHTML=`<div class="lifestyle-modal">
    <div class="lifestyle-modal__title">✏️ Change Lifestyle</div>
    <div class="lifestyle-modal__sub">Changes take effect next month.</div>
    <div class="lifestyle-modal__section"><div class="lifestyle-modal__section-title">🏠 Where do you live? <span style="font-size:0.7rem;color:#c0392b;font-weight:600;text-transform:none">${lockMsg}</span></div>
      ${LIVING_OPTIONS.map(o=>optRow(o,'data-living',o.id===selLiving,lockLiving(o),ownsHome?'You own a home':'')).join('')}</div>
    <div class="lifestyle-modal__section"><div class="lifestyle-modal__section-title">🚗 Transport</div>
      ${TRANSPORT_OPTIONS.map(o=>optRow(o,'data-transport',o.id===selTransport&&!selNewCar,lockTransport(o),'')).join('')}</div>
    <div class="lifestyle-modal__section"><div class="lifestyle-modal__section-title">📱 Phone Plan</div>
      ${PHONE_OPTIONS.map(o=>optRow(o,'data-phone',o.id===selPhone,lockPhone(o),'')).join('')}</div>
    ${carSect}
    <div class="lifestyle-modal__cost-change" id="lc-cost">${costHTML()}</div>
    <div class="lifestyle-modal__btns">
      <button class="lifestyle-modal__cancel" id="lc-cancel">Cancel</button>
      <button class="lifestyle-modal__confirm" id="lc-confirm">Apply Changes</button>
    </div></div>`;
  document.body.appendChild(ov);

  function refresh() {
    ov.querySelectorAll('[data-living]').forEach(e=>e.classList.toggle('selected',e.dataset.living===selLiving));
    ov.querySelectorAll('[data-transport]').forEach(e=>e.classList.toggle('selected',e.dataset.transport===selTransport&&!selNewCar));
    ov.querySelectorAll('[data-phone]').forEach(e=>e.classList.toggle('selected',e.dataset.phone===selPhone));
    ov.querySelectorAll('[data-new-car]').forEach(e=>e.classList.toggle('selected',selNewCar?.id===e.dataset.newCar));
    ov.querySelector('#lc-cost').innerHTML=costHTML();
  }

  ov.addEventListener('click', e=>{
    if(e.target.closest('#lc-cancel')){ov.remove();return;}
    if(e.target.closest('#lc-confirm')){apply();ov.remove();return;}
    const l=e.target.closest('[data-living]'); if(l){selLiving=l.dataset.living;refresh();return;}
    const t=e.target.closest('[data-transport]'); if(t){selNewCar=null;selTransport=t.dataset.transport;refresh();return;}
    const p=e.target.closest('[data-phone]'); if(p){selPhone=p.dataset.phone;refresh();return;}
    const c=e.target.closest('[data-new-car]');
    if(c){const o=NEW_CAR_OPTIONS.find(x=>x.id===c.dataset.newCar);selNewCar=selNewCar?.id===o.id?null:o;if(selNewCar)selTransport='__nc__';refresh();}
  });

  function apply() {
    if(!ownsHome&&selLiving!==curLiving){const o=LIVING_OPTIONS.find(x=>x.id===selLiving);if(o&&!lockLiving(o)){playerSetup.living=selLiving;expenseState.rent=o.effect.rentFlat!==undefined?o.effect.rentFlat:Math.round(base.rent*o.effect.rentMultiplier);expenseState.food=Math.round(base.food*o.effect.foodMultiplier);const rr=document.getElementById('row-exp-rent');if(rr)rr.classList.toggle('hidden',expenseState.rent===0);}}
    if(selNewCar){carLoanState.active=true;carLoanState.monthlyPayment=selNewCar.payment;carLoanState.remainingMonths=selNewCar.months;carLoanState.carLabel=selNewCar.label;expenseState.transport=selNewCar.transport;playerSetup.transport=selNewCar.id;}
    else if(selTransport!==curTransport&&selTransport!=='__nc__'){const o=TRANSPORT_OPTIONS.find(x=>x.id===selTransport);if(o&&!lockTransport(o)){playerSetup.transport=selTransport;expenseState.transport=o.effect.transportFlat;}}
    if(selPhone!==curPhone){const o=PHONE_OPTIONS.find(x=>x.id===selPhone);if(o&&!lockPhone(o)){playerSetup.phone=selPhone;expenseState.phone=o.effect.phoneFlat;}}
    expenseState.monthlyTotal=expenseState.rent+expenseState.food+expenseState.transport+expenseState.phone+expenseState.other+(expenseState.loanRepayment||0)+(expenseState.mortgagePayment||0);
    const g=id=>document.getElementById(id);
    if(g('display-exp-rent'))      g('display-exp-rent').textContent=formatCurrency(expenseState.rent);
    if(g('display-exp-food'))      g('display-exp-food').textContent=formatCurrency(expenseState.food);
    if(g('display-exp-transport')) g('display-exp-transport').textContent=formatCurrency(expenseState.transport);
    if(g('display-exp-phone'))     g('display-exp-phone').textContent=formatCurrency(expenseState.phone);
    if(g('display-expenses'))      g('display-expenses').textContent=formatCurrency(expenseState.monthlyTotal);
    updateLifestyleBadge();
    const mk=document.createElement('div');mk.className='history-tax-marker';
    mk.style.cssText='background:linear-gradient(135deg,#e8f4e8,#f0f7f0);border-left-color:var(--clr-forest)';
    mk.innerHTML=`<span>🎛️ Lifestyle Changed</span><span>${formatCurrency(expenseState.monthlyTotal)}/mo</span>`;
    historyFeed.insertBefore(mk,historyFeed.firstChild);
  }
}

function updateLifestyleBadge() {
  const lo=LIVING_OPTIONS.find(o=>o.id===playerSetup.living)||{icon:'🏠',label:playerSetup.living||'—'};
  const to=TRANSPORT_OPTIONS.find(o=>o.id===playerSetup.transport)||{icon:'🚗',label:playerSetup.transport||'—'};
  const po=PHONE_OPTIONS.find(o=>o.id===playerSetup.phone)||{icon:'📱',label:'—'};
  const g=id=>document.getElementById(id);
  if(g('display-lifestyle-living'))    g('display-lifestyle-living').textContent=lo.icon+' '+lo.label;
  if(g('display-lifestyle-transport')) g('display-lifestyle-transport').textContent=to.icon+' '+to.label;
  if(g('display-lifestyle-phone'))     g('display-lifestyle-phone').textContent=po.icon+' $'+(PHONE_OPTIONS.find(o=>o.id===(playerSetup.phone||'mid'))?.effect.phoneFlat||'?')+'/mo';
}
document.addEventListener('click',e=>{ if(e.target.closest('#btn-lifestyle-change')) showLifestyleModal(); });

/* ══════════════════════════════════════════════════════════
   CASH CRISIS PANEL
   ══════════════════════════════════════════════════════════ */
function maybeShowCashCrisis() {
  if(gameState.cash>=0) return;
  if(document.getElementById('cash-crisis-panel')) return;
  const card=document.getElementById('month-card'); if(!card) return;
  const cb=Math.round(gameState.cash), hb=Math.round(gameState.hisa), eb=Math.round(gameState.emergencyFund), tb=Math.round(gameState.tfsa);
  const def=Math.abs(cb), has=hb+eb+tb>0;
  const sv=document.getElementById('btn-confirm-month'); if(sv&&has) sv.disabled=true;
  const pn=document.createElement('div'); pn.className='cash-crisis-panel'; pn.id='cash-crisis-panel';
  pn.innerHTML=`<div class="cash-crisis-panel__title">⚠️ Cash: ${formatCurrency(cb)}</div>
    <div class="cash-crisis-panel__body">Expenses exceeded income. Withdraw from savings to cover the shortfall.</div>
    ${hb>0?`<div class="cash-crisis-row"><span class="cash-crisis-row__label">🏦 HISA <span class="cash-crisis-row__bal">(${formatCurrency(hb)})</span></span><div class="alloc-row__input-wrap"><span class="alloc-row__dollar">$</span><input type="number" id="crisis-hisa" class="alloc-input" min="0" max="${hb}" step="50" value="0"/></div></div>`:''}
    ${eb>0?`<div class="cash-crisis-row"><span class="cash-crisis-row__label">🛡️ EF <span class="cash-crisis-row__bal">(${formatCurrency(eb)})</span></span><div class="alloc-row__input-wrap"><span class="alloc-row__dollar">$</span><input type="number" id="crisis-ef" class="alloc-input" min="0" max="${eb}" step="50" value="0"/></div></div>`:''}
    ${tb>0?`<div class="cash-crisis-row"><span class="cash-crisis-row__label">🌿 TFSA <span class="cash-crisis-row__bal">(${formatCurrency(tb)})</span></span><div class="alloc-row__input-wrap"><span class="alloc-row__dollar">$</span><input type="number" id="crisis-tfsa" class="alloc-input" min="0" max="${tb}" step="50" value="0"/></div></div>`:''}
    ${!has?'<p style="font-size:0.82rem;color:#c0392b;font-weight:600">No liquid savings — negative balance carries forward.</p>':''}
    <div style="font-size:0.78rem;color:var(--clr-muted);margin-top:8px">Still short: <strong id="crisis-short" style="color:#c0392b">${formatCurrency(def)}</strong></div>
    ${has?'<button class="cash-crisis-withdraw" id="crisis-btn" disabled>Withdraw Funds</button>':''}`;
  const ab=card.querySelector('.month-action-bar'); if(ab) card.insertBefore(pn,ab); else card.appendChild(pn);
  if(!has) return;
  function upd(){
    const hw=Math.min(Math.max(0,parseInt(document.getElementById('crisis-hisa')?.value)||0),hb);
    const ew=Math.min(Math.max(0,parseInt(document.getElementById('crisis-ef')?.value)||0),eb);
    const tw=Math.min(Math.max(0,parseInt(document.getElementById('crisis-tfsa')?.value)||0),tb);
    const st=Math.max(0,def-hw-ew-tw); const el=document.getElementById('crisis-short');
    if(el){el.textContent=formatCurrency(st);el.style.color=st>0?'#c0392b':'var(--clr-forest)';}
    const btn=document.getElementById('crisis-btn'); if(btn) btn.disabled=hw+ew+tw===0||st>0;
  }
  pn.addEventListener('input',upd);
  pn.querySelector('#crisis-btn')?.addEventListener('click',()=>{
    const hw=Math.min(Math.max(0,parseInt(document.getElementById('crisis-hisa')?.value)||0),hb);
    const ew=Math.min(Math.max(0,parseInt(document.getElementById('crisis-ef')?.value)||0),eb);
    const tw=Math.min(Math.max(0,parseInt(document.getElementById('crisis-tfsa')?.value)||0),tb);
    if(hw>0){gameState.hisa-=hw;gameState.cash+=hw;} if(ew>0){gameState.emergencyFund-=ew;gameState.cash+=ew;} if(tw>0){gameState.tfsa-=tw;gameState.cash+=tw;}
    updateDashboard();updateAccountsDisplay();pn.remove();if(sv)sv.disabled=false;
    const mk=document.createElement('div');mk.className='history-tax-marker';
    mk.style.cssText='background:linear-gradient(135deg,#fff5f5,#fff0f0);border-left-color:#c0392b';
    mk.innerHTML=`<span>⚠️ Emergency Withdrawal</span><span>${formatCurrency(hw+ew+tw)}</span>`;
    historyFeed.insertBefore(mk,historyFeed.firstChild);
  });
}

/* ══════════════════════════════════════════════════════════
   HOUSING — DOWN PAYMENT SOURCE PICKER + FHSA CLOSE
   ══════════════════════════════════════════════════════════ */
/* Override the original showHousingOfferScreen and purchaseHome */
function showHousingOfferScreen(pendingCtx) {
  window._ffInterrupted = true;  // pause fast-forward
  const hp=getHomePrice(), fhb=Math.round(gameState.fhsa), cb=Math.round(gameState.cash), rb=Math.round(gameState.rrsp), HBP=35000;
  const tot=cb+fhb+Math.min(rb,HBP), min5=Math.round(hp*.05), d20=Math.round(hp*.20);
  const scens=[{label:'5% Down',rate:.055,years:25,down:min5,cmhc:true},{label:'10% Down',rate:.052,years:25,down:Math.round(hp*.10),cmhc:false},{label:'20% Down',rate:.048,years:25,down:d20,cmhc:false}];
  const cards=scens.map((s,i)=>{const m=Math.round(calcMortgagePayment(hp-s.down,s.rate,s.years)),ok=tot>=s.down;
    return `<div class="mortgage-scenario ${ok?'':'mortgage-scenario--unaffordable'}" data-index="${i}" data-down="${s.down}" data-rate="${s.rate}" data-years="${s.years}" data-monthly="${m}">
      <div class="mortgage-scenario__label">${s.label}</div><div class="mortgage-scenario__down">Down: ${formatCurrency(s.down)}${s.cmhc?' + CMHC':''}</div>
      <div class="mortgage-scenario__payment">${formatCurrency(m)}<span>/mo</span></div><div class="mortgage-scenario__rate">${(s.rate*100).toFixed(1)}% · ${s.years}yr</div>
      ${!ok?'<div class="mortgage-scenario__unaffordable">Insufficient funds</div>':''}</div>`;}).join('');
  setMonthCardContent(`<div class="housing-offer-screen">
    <div class="housing-offer-screen__badge">🏠 Housing Decision</div>
    <h2 class="housing-offer-screen__heading">Rent or Buy?</h2>
    <p class="housing-offer-screen__sub">Home prices: <strong>${formatCurrency(hp)}</strong>. Cash: <strong>${formatCurrency(cb)}</strong>.</p>
    ${fhb>0?`<p class="housing-fhsa-note">🏠 FHSA: <strong>${formatCurrency(fhb)}</strong> — tax-free. Account closes after purchase.</p>`:''}
    ${rb>0?`<p class="housing-fhsa-note" style="margin-top:4px">🏔️ RRSP HBP: up to <strong>${formatCurrency(Math.min(rb,HBP))}</strong> — repay 15 yrs.</p>`:''}
    <div class="housing-tabs"><button class="housing-tab housing-tab--active" id="tab-rent">Keep Renting</button><button class="housing-tab" id="tab-buy">Buy a Home</button></div>
    <div id="hp-rent"><div class="housing-rent-card"><div class="housing-rent-card__icon">🏢</div><div class="housing-rent-card__title">Stay Renting</div>
      <p class="housing-rent-card__body">Flexibility over equity. Revisit buying next year.</p>
      <div class="housing-rent-card__stats"><div class="housing-stat"><span>Monthly Rent</span><span>${formatCurrency(expenseState.rent)}</span></div></div>
      <button class="btn-confirm-month" id="hp-keep" style="margin-top:16px">Continue Renting →</button></div></div>
    <div id="hp-buy" class="hidden">
      <p class="mortgage-intro">Choose your scenario:</p><div class="mortgage-scenarios">${cards}</div>
      <div class="mortgage-confirm hidden" id="hp-confirm">
        <p class="mortgage-intro" style="margin-bottom:8px">💰 Down payment sources:</p>
        <div class="down-source-grid" id="dp-grid">
          ${fhb>0?`<div class="down-source-row"><label class="down-source-label">🏠 FHSA (tax-free, closes after)</label><div class="alloc-row__input-wrap"><span class="alloc-row__dollar">$</span><input type="number" id="dp-fhsa" class="alloc-input" min="0" max="${fhb}" step="100" value="${fhb}"/></div></div>`:''}
          ${rb>0?`<div class="down-source-row"><label class="down-source-label">🏔️ RRSP/HBP (max ${formatCurrency(HBP)})</label><div class="alloc-row__input-wrap"><span class="alloc-row__dollar">$</span><input type="number" id="dp-rrsp" class="alloc-input" min="0" max="${Math.min(rb,HBP)}" step="100" value="0"/></div></div>`:''}
          <div class="down-source-row"><label class="down-source-label">💵 Cash (auto)</label><div class="alloc-row__input-wrap"><span class="alloc-row__dollar">$</span><input type="number" id="dp-cash" class="alloc-input" value="0" readonly style="opacity:0.6"/></div></div>
          <div class="down-source-row" style="border-top:1px solid var(--clr-border);padding-top:6px"><label class="down-source-label"><strong>Total / Required</strong></label><span class="down-source-total" id="dp-total">—</span></div>
        </div>
        <div class="down-source-warning hidden" id="dp-warn"></div>
        <p class="mortgage-confirm__summary" id="hp-summary"></p>
        <button class="btn-confirm-month" id="hp-buy-btn" disabled>Purchase Home ✓</button>
      </div>
    </div></div>`);

  document.getElementById('tab-rent').addEventListener('click',()=>{document.getElementById('tab-rent').classList.add('housing-tab--active');document.getElementById('tab-buy').classList.remove('housing-tab--active');document.getElementById('hp-rent').classList.remove('hidden');document.getElementById('hp-buy').classList.add('hidden');});
  document.getElementById('tab-buy').addEventListener('click',()=>{document.getElementById('tab-buy').classList.add('housing-tab--active');document.getElementById('tab-rent').classList.remove('housing-tab--active');document.getElementById('hp-buy').classList.remove('hidden');document.getElementById('hp-rent').classList.add('hidden');});
  document.getElementById('hp-keep').addEventListener('click',()=>{housingOfferFired=false;housingOfferMonth+=12;resumeMonthAfterInterstitial();});

  let pm=null;
  function updDP(){if(!pm)return;const fi=Math.min(Math.max(0,parseInt(document.getElementById('dp-fhsa')?.value)||0),fhb),ri=Math.min(Math.max(0,parseInt(document.getElementById('dp-rrsp')?.value)||0),Math.min(rb,HBP)),cn=Math.max(0,pm.down-fi-ri);
    const ce=document.getElementById('dp-cash');if(ce)ce.value=cn;
    const te=document.getElementById('dp-total');if(te)te.textContent=`${formatCurrency(fi+ri+cn)} / ${formatCurrency(pm.down)}`;
    const we=document.getElementById('dp-warn'),be=document.getElementById('hp-buy-btn');
    if(cn>cb){we.classList.remove('hidden');we.textContent=`⚠️ Short ${formatCurrency(cn-cb)}`;be.disabled=true;}else{we.classList.add('hidden');be.disabled=false;}}
  document.querySelectorAll('.mortgage-scenario:not(.mortgage-scenario--unaffordable)').forEach(s=>{s.addEventListener('click',()=>{document.querySelectorAll('.mortgage-scenario').forEach(x=>x.classList.remove('selected'));s.classList.add('selected');
    pm={down:parseInt(s.dataset.down),rate:parseFloat(s.dataset.rate),years:parseInt(s.dataset.years),monthly:parseInt(s.dataset.monthly)};
    document.getElementById('hp-confirm').classList.remove('hidden');document.getElementById('hp-summary').textContent=`${formatCurrency(pm.monthly)}/mo · ${formatCurrency(hp)}`;
    const fe=document.getElementById('dp-fhsa');if(fe)fe.value=Math.min(fhb,pm.down);const re=document.getElementById('dp-rrsp');if(re)re.value=0;updDP();});});
  document.getElementById('dp-grid')?.addEventListener('input',updDP);
  document.getElementById('hp-buy-btn').addEventListener('click',()=>{if(!pm)return;
    const fu=Math.min(Math.max(0,parseInt(document.getElementById('dp-fhsa')?.value)||0),fhb),ru=Math.min(Math.max(0,parseInt(document.getElementById('dp-rrsp')?.value)||0),Math.min(rb,HBP)),cu=Math.max(0,pm.down-fu-ru);
    document.getElementById('hp-buy-btn').disabled=true;purchaseHome(pm,hp,pendingCtx,{fhsa:fu,rrsp:ru,cash:cu});});
}

function purchaseHome(mortgage,homePrice,pendingCtx,sources) {
  sources=sources||{fhsa:0,rrsp:0,cash:mortgage.down};
  const fu=Math.min(sources.fhsa||0,gameState.fhsa),ru=Math.min(sources.rrsp||0,gameState.rrsp),cu=Math.max(0,mortgage.down-fu-ru);
  gameState.rrsp-=ru; gameState.cash-=cu;
  closeFhsaHoldings();
  if(fu>0) gameState.rrsp-=fu;
  const fr=document.getElementById('row-fhsa');if(fr)fr.classList.add('hidden');
  const afr=document.getElementById('auto-fhsa-row');if(afr)afr.style.display='none';
  autoContrib.fhsa=0;
  mortgageState.active=true;mortgageState.balance=homePrice-mortgage.down;mortgageState.originalAmount=mortgageState.balance;
  mortgageState.monthlyPayment=mortgage.monthly;mortgageState.interestRate=mortgage.rate;mortgageState.amortYears=mortgage.years;
  mortgageState.homePrice=homePrice;mortgageState.purchaseMonth=gameState.month;
  gameState.homeValue=homePrice;gameState.homeEquity=mortgage.down;
  expenseState.rent=0;expenseState.monthlyTotal=expenseState.food+expenseState.transport+expenseState.phone+expenseState.other+mortgage.monthly;
  updateExpensesForLifeStage('home-purchase');
  const hp2=document.getElementById('housing-panel');if(hp2)hp2.classList.remove('hidden');
  const rr=document.getElementById('row-exp-rent');if(rr)rr.classList.add('hidden');
  updateLifestyleBadge();updateDashboard();
  const ss=[fu>0?`FHSA ${formatCurrency(fu)}`:'',ru>0?`RRSP ${formatCurrency(ru)}`:'',cu>0?`Cash ${formatCurrency(cu)}`:''].filter(Boolean).join(' · ');
  const mk=document.createElement('div');mk.className='history-tax-marker history-tax-marker--home';
  mk.innerHTML=`<span>🏠 Bought a Home! ${ss?'('+ss+')':''}</span><span>${formatCurrency(homePrice)}</span>`;
  historyFeed.insertBefore(mk,historyFeed.firstChild);resumeMonthAfterInterstitial();
}

/* ══════════════════════════════════════════════════════════
   WANTS VS NEEDS
   ══════════════════════════════════════════════════════════ */
const WANT_ITEMS = [
  {icon:'🍕',title:'Pizza Night with Friends',    cost:65,  body:'Friends want to go out. A fun evening — but it adds up every time.',                   tip:'Cooking at home 3× more often could cover this each month.'},
  {icon:'🍣',title:'Sushi Date Night',             cost:120, body:'A nice dinner out. Life is meant to be enjoyed — but every splurge is a trade-off.',   tip:'$120 invested monthly for 10 years grows to ~$2,000.'},
  {icon:'☕',title:'Daily Coffee Habit',           cost:85,  body:'A month of café coffees. Convenient, tasty, and quietly expensive.',                    tip:'Brewing at home saves ~$70/mo — $840/year.'},
  {icon:'🍔',title:'Food Delivery Binge',          cost:95,  body:'Late-night delivery orders. The fees and tips add up fast.',                            tip:'Skipping this and cooking frees up nearly $100 this month.'},
  {icon:'🎬',title:'Concert Tickets',              cost:180, body:'Your favourite artist is in town. Once-in-a-while experiences matter.',                  tip:'Could go into your EF or top up your TFSA instead.'},
  {icon:'🎮',title:'New Video Game',               cost:90,  body:'A highly anticipated release. Digital entertainment is a real budget line.',             tip:'Wait for a sale in 3 months at half price?'},
  {icon:'📺',title:'Streaming Upgrade',            cost:50,  body:'Upgrade to premium. Convenience comes at a recurring cost.',                            tip:'Recurring subscriptions are the stealth drain on every budget.'},
  {icon:'🎳',title:'Weekend Activities',           cost:75,  body:'Bowling, mini golf, escape room — a fun weekend that adds up.',                         tip:'Split costs with friends to reduce your share.'},
  {icon:'👟',title:'New Sneakers',                 cost:160, body:'A pair you\'ve been eyeing. Wants are fine — the key is intentionality.',               tip:'Wait 48 hours before any purchase over $100. Still want them?'},
  {icon:'🧥',title:'Seasonal Wardrobe Update',     cost:200, body:'New season, new look. Clothing has flexible timing.',                                    tip:'Wait for end-of-season sales — 30–50% off.'},
  {icon:'🎁',title:'Birthday Gift (Generous)',     cost:85,  body:'You want to get your friend something nice.',                                            tip:'A thoughtful experience gift can mean more than something expensive.'},
  {icon:'🪴',title:'Home Decor Haul',              cost:130, body:'A trip to HomeSense. It always starts with one thing.',                                  tip:'Wants that improve your space feel like needs — budget separately.'},
  {icon:'🏋️',title:'Gym Membership',              cost:55,  body:'A monthly membership at a new gym. Health investment — or unused subscription?',        tip:'Try a free trial or YouTube workouts first.'},
  {icon:'💆',title:'Massage & Spa Day',            cost:110, body:'Self-care matters. But so does knowing when you can afford it.',                         tip:'A planned monthly wellness budget prevents guilt spending.'},
  {icon:'📚',title:'Books & Online Course',        cost:70,  body:'Investing in yourself — genuinely.',                                                     tip:'Check your library card — many books and courses are free.'},
  {icon:'✈️',title:'Long Weekend Getaway',         cost:350, body:'A quick trip with friends. Travel enriches life — and drains accounts fast.',            tip:'$350 in TFSA compounding for 10 years at 7%.'},
  {icon:'🏕️',title:'Camping Trip',                cost:120, body:'A weekend in nature. One of the more affordable ways to recharge.',                     tip:'Split gear costs with friends.'},
  {icon:'🎡',title:'Theme Park Day',               cost:95,  body:'Admission, food, and parking make this pricier than expected.',                          tip:'Pack your own food to cut the cost significantly.'},
  {icon:'🎧',title:'Wireless Headphones',          cost:220, body:'Premium audio. Tech wants have a way of feeling like needs.',                            tip:'Last year\'s model is often 40% cheaper and nearly identical.'},
  {icon:'⌚',title:'Smartwatch Upgrade',           cost:350, body:'The new model dropped. Upgrading every cycle drains budgets fast.',                      tip:'Your current watch still works. What\'s the actual new benefit?'},
];
let _wantThisMonth = null;

function pickWantItem() {
  return pickWantItemForInterests(); // returns array of 2-3 items or null
}

function injectWantsCard(wants, card) {
  // Normalise: accept single item or array
  const wantList = Array.isArray(wants) ? wants : [wants];
  if (!wantList || wantList.length === 0) return;

  const alloc = card.querySelector('.month-section--allocate');

  wantList.forEach((want, idx) => {
    if (!want) return;
    const elId = `wants-card-${idx}`;
    const skipId = `want-skip-${idx}`;
    const buyId  = `want-buy-${idx}`;
    const canAfford = gameState.cash >= want.cost;
    const grown = formatCurrency(Math.round(want.cost * Math.pow(1.07, 10)));

    const el = document.createElement('div');
    el.className = 'wants-card';
    el.id = elId;
    el.innerHTML = `<div class="wants-card__header">
      <span class="wants-card__badge">💭 Want or Skip?</span>
      <span class="wants-card__title">${want.icon} ${want.title}</span>
      <span class="wants-card__cost">-${formatCurrency(want.cost)}</span></div>
      <p class="wants-card__body">${want.body}</p>
      <div class="wants-card__opp-cost">💡 ${want.tip} At 7%/yr, ${formatCurrency(want.cost)} → <strong>${grown}</strong> in 10 years.</div>
      <div class="wants-card__btns">
        <button class="wants-card__skip" id="${skipId}">✅ Skip It</button>
        <button class="wants-card__buy" id="${buyId}" ${!canAfford ? 'disabled' : ''}>
          ${canAfford ? `🛍️ Buy It (-${formatCurrency(want.cost)})` : '🛍️ Insufficient Cash'}</button>
      </div>`;

    if (alloc) card.insertBefore(el, alloc); else card.appendChild(el);

    function resolve(bought) {
      el.querySelector('.wants-card__btns').innerHTML = '';
      const res = document.createElement('div');
      res.className = `wants-card__result wants-card__result--${bought ? 'bought' : 'skipped'}`;
      if (bought) {
        gameState.cash -= want.cost; gameState.totalExpenses += want.cost;
        allocState.leftover = Math.max(0, (allocState.leftover || 0) - want.cost);
        const ll = document.getElementById('mrow-leftover'); if (ll) ll.textContent = formatCurrency(allocState.leftover);
        updateDashboard();
        res.textContent = `🛍️ Bought! -${formatCurrency(want.cost)} from cash.`;
        const mk = document.createElement('div'); mk.className = 'history-tax-marker';
        mk.style.cssText = 'background:linear-gradient(135deg,#fff8e8,#fffbf0);border-left-color:var(--clr-amber,#c8622a)';
        mk.innerHTML = `<span>${want.icon} ${want.title}</span><span>-${formatCurrency(want.cost)}</span>`;
        historyFeed.insertBefore(mk, historyFeed.firstChild);
      } else { res.textContent = `✅ Skipped! ${formatCurrency(want.cost)} stays available.`; }
      el.appendChild(res);
    }

    document.getElementById(skipId).addEventListener('click', () => resolve(false));
    document.getElementById(buyId).addEventListener('click', () => { if (gameState.cash >= want.cost) resolve(true); });
  });

  _wantThisMonth = null;
}

/* ══════════════════════════════════════════════════════════
   SPEED CONTROLS — FAST FORWARD
   ══════════════════════════════════════════════════════════ */
let speedState = { current:1, remaining:0, total:0, running:false };

document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    speedState.current = parseInt(btn.dataset.speed);
    document.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('speed-btn--active'));
    btn.classList.add('speed-btn--active');
  });
});

function startFastForward() {
  if (speedState.current <= 1) { advanceMonth(); return; }
  speedState.remaining=speedState.current; speedState.total=speedState.current; speedState.running=true;
  window._ffInterrupted = false;
  showFFBar(); runNextFFMonth();
}

function runNextFFMonth() {
  if (!speedState.running||speedState.remaining<=0){endFF();return;}
  speedState.remaining--; updFFBar();
  window._ffSkipWants=true;
  confirmMonthSilent();
  window._ffSkipWants=false;

  // Clear the interrupt flag before advancing — any interstitial will set it
  window._ffInterrupted = false;
  advanceMonth();

  // If an interstitial fired (job offer, housing, year review, tuition), stop FF
  if (window._ffInterrupted) { endFF(); return; }

  // Also check flags that may still be pending
  const pause = loanState.waitingForChoice || jobOfferState.pendingTransition ||
    jobOfferState.reviewPending || housingState_pendingTrigger ||
    creditState.statementDue || (gameState.month > GAME_END_MONTH);
  if(pause){endFF();return;}
  if(speedState.remaining>0) setTimeout(runNextFFMonth,80); else endFF();
}

function confirmMonthSilent() {
  if(typeof autoContrib==='undefined') return;
  let rem=allocState.leftover||0; if(rem<=0) return;
  ['ef','hisa','tfsa','rrsp','fhsa'].forEach(k=>{
    const amt=Math.min(autoContrib[k]||0,rem,Math.max(0,gameState.cash));
    if(amt<=0) return; rem-=amt; gameState.cash-=amt;
    if(k==='ef') gameState.emergencyFund+=amt;
    else if(k==='hisa') gameState.hisa+=amt;
    else if(typeof depositToHolding==='function'&&(k!=='fhsa'||!window._fhsaClosed)){
      depositToHolding(k,portfolioState[k+'Choice']||'index',amt);
    }
  });
  if(typeof updateDashboard==='function') updateDashboard();
}

function showFFBar() {
  let b=document.getElementById('ff-bar'); if(!b){b=document.createElement('div');b.id='ff-bar';b.className='ff-progress-bar';b.innerHTML='<div class="ff-progress-bar__fill" id="ff-fill" style="width:0%"></div>';document.body.appendChild(b);}
  let l=document.getElementById('ff-label'); if(!l){l=document.createElement('div');l.id='ff-label';l.className='ff-progress-label';document.body.appendChild(l);}
  updFFBar();
}
function updFFBar() {
  const done=speedState.total-speedState.remaining,pct=Math.round(done/speedState.total*100);
  const f=document.getElementById('ff-fill');if(f)f.style.width=pct+'%';
  const l=document.getElementById('ff-label');if(l)l.textContent=`⚡ Fast-forwarding… ${done}/${speedState.total} months`;
}
function endFF() {
  speedState.running=false;speedState.remaining=0;
  ['ff-bar','ff-label'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();});
}

function initSpeedControl() {
  const btn=document.getElementById('btn-next-month'); if(!btn) return;
  const fresh=btn.cloneNode(true); btn.parentNode.replaceChild(fresh,btn);
  fresh.addEventListener('click',()=>{ if(speedState.current>1&&!speedState.running) startFastForward(); else advanceMonth(); });
  btnNextMonth=fresh;
}

/* ══════════════════════════════════════════════════════════
   END-GAME DEBRIEF
   ══════════════════════════════════════════════════════════ */
/* Override the original showEndGameScreen */
function showEndGameScreen() {
  window._ffInterrupted = true;
  btnNextMonth.disabled=true; btnNextMonth.classList.add('hidden');
  const nw=gameState.netWorth;
  const ti=['tfsa','rrsp','fhsa'].reduce((s,a)=>s+['index','stocks','crypto'].reduce((ss,t)=>ss+portfolioState.holdings[a][t].contributed,0),0);
  const pv=Math.round(gameState.tfsa+gameState.rrsp+gameState.fhsa), ig=pv-ti;
  const sd=loanState?Math.round(loanState.studentDebt||0):0;
  const hasHome=mortgageState&&mortgageState.active;
  const career=jobOfferState.chosenJob?jobOfferState.chosenJob.title:incomeState.phaseLabel;
  const totalIncome=Math.round(gameState.totalIncome||(incomeState.baseIncome*144));
  const sr=totalIncome>0?Math.round(ti/totalIncome*100):0;
  const efb=Math.round(gameState.emergencyFund), efc=expenseState.monthlyTotal*3>0?efb/(expenseState.monthlyTotal*3):0;
  const gm=ti>0?(pv/ti).toFixed(2):'—';

  function lg(s){if(s>=90)return{l:'A+',c:'#1b3a2d'};if(s>=80)return{l:'A',c:'#1b3a2d'};if(s>=70)return{l:'B',c:'#2e7d32'};if(s>=55)return{l:'C',c:'#f57c00'};if(s>=40)return{l:'D',c:'#e65100'};return{l:'F',c:'#c0392b'};}
  let grade;
  if(nw>=250000)grade={label:'Exceptional',icon:'💎',letter:'A+',color:'#1b3a2d'};
  else if(nw>=150000)grade={label:'Strong',icon:'🌟',letter:'A',color:'#1b3a2d'};
  else if(nw>=80000)grade={label:'Good',icon:'✅',letter:'B',color:'#2e7d32'};
  else if(nw>=20000)grade={label:'Getting There',icon:'🌱',letter:'C',color:'#f57c00'};
  else if(nw>=0)grade={label:'Struggled',icon:'⚠️',letter:'D',color:'#e65100'};
  else grade={label:'In the Red',icon:'🔴',letter:'F',color:'#c0392b'};

  const savG=lg(Math.min(100,sr*4)), efG=lg(Math.min(100,Math.round(efc*100)));
  // Debt management grade: based on behaviour & progress, not raw balance.
  // Mortgage is excluded (it's tied to an appreciating asset already graded via home equity).
  // Student debt is graded on: did they ever have it? did they clear it? how much did they pay off?
  const peakSd = loanState ? Math.round(loanState.peakStudentDebt || 0) : 0;
  let debtScore;
  if (peakSd === 0) {
    // Never had student debt — full marks
    debtScore = 95;
  } else if (sd === 0) {
    // Had debt and fully cleared it — excellent
    debtScore = 95;
  } else {
    // Grade on % of peak debt paid off (min score 45 for consistent payers —
    // the game doesn't allow extra payments, so carrying a balance isn't the player's fault)
    const paidOff = Math.max(0, peakSd - sd);
    const pctPaid = peakSd > 0 ? paidOff / peakSd : 0;
    // Scale: 0% paid = 45, 50% paid = 65, 100% paid = 95
    debtScore = Math.round(45 + pctPaid * 50);
  }
  const debtG=lg(debtScore);
  const ccG=creditState.active?lg(creditState.missedPayments===0?90:creditState.missedPayments<=2?60:30):lg(75);
  const invG=lg(Math.min(100,sr*3+(pv>ti?30:0)));

  const savIns=sr>=20?`You saved ${sr}% of income — well above Canada's ~4% average. A habit that compounds over a lifetime.`:sr>=4?`You saved ${sr}% of income, ahead of the Canadian average of 4%.`:`You saved ${sr}% — below Canada's 4% average. Small contributions started earlier make a big difference.`;
  const invIns=ig>0?`Investments earned ${formatCurrency(ig)} growth on ${formatCurrency(ti)} contributed — a ${gm}× multiplier. Money earned without working.`:`You contributed ${formatCurrency(ti)} to registered accounts. Earlier or more consistent contributions would have unlocked compound growth.`;
  const efIns=efc>=1?`Your EF covered ${Math.round(efc*3)} months of expenses — a real safety net.`:efb>0?`Your EF covered ${(efc*3).toFixed(1)} months. The target is 3 months.`:`No emergency fund built. Life events hit your cash directly.`;
  const debtIns = peakSd === 0
    ? `You never took on student debt — no loan burden to manage.`
    : sd === 0
      ? `You fully paid off your student debt. Great discipline.`
      : (() => {
          const paidOff = Math.max(0, peakSd - sd);
          const pct = peakSd > 0 ? Math.round(paidOff / peakSd * 100) : 0;
          return `You paid off ${pct}% of your student debt (${formatCurrency(paidOff)} of ${formatCurrency(peakSd)}). ${formatCurrency(sd)} remains — the game's 12-year window doesn't allow full repayment on minimum payments, but consistent payments keep interest from spiralling.`;
        })();
  const homeIns=hasHome?`Home equity of ${formatCurrency(Math.round(gameState.homeEquity))} on a ${formatCurrency(Math.round(gameState.homeValue))} property.`:`You chose to rent — flexibility over equity building.`;

  function cat(icon,label,g,detail){return `<div class="debrief-cat"><div class="debrief-cat__header"><span class="debrief-cat__icon">${icon}</span><span class="debrief-cat__label">${label}</span><span class="debrief-cat__grade" style="color:${g.c}">${g.l}</span></div><p class="debrief-cat__detail">${detail}</p></div>`;}
  function st(label,val,cls=''){return `<div class="debrief-stat"><span class="debrief-stat__label">${label}</span><span class="debrief-stat__val ${cls}">${val}</span></div>`;}

  const summary=[
    '═══════════════════════════════════════',
    '    MAPLE MONEY — FINANCIAL DEBRIEF',
    '         Age 18 → 30 Simulation',
    '═══════════════════════════════════════','',
    `CAREER:            ${career}`,
    `MONTHLY INCOME:    ${formatCurrency(incomeState.baseIncome)}/mo`,
    `TOTAL EARNED:      ${formatCurrency(totalIncome)}`,
    '','─── FINAL SNAPSHOT ───────────────────',
    `NET WORTH:         ${formatCurrency(nw)}`,
    `CASH:              ${formatCurrency(Math.round(gameState.cash))}`,
    `HISA:              ${formatCurrency(Math.round(gameState.hisa))}`,
    `EMERGENCY FUND:    ${formatCurrency(efb)}`,
    `TFSA:              ${formatCurrency(Math.round(gameState.tfsa))}`,
    `RRSP:              ${formatCurrency(Math.round(gameState.rrsp))}`,
    hasHome?`HOME EQUITY:       ${formatCurrency(Math.round(gameState.homeEquity))}`:`HOME:              Renting`,
    sd>0?`STUDENT DEBT:      -${formatCurrency(sd)}`:`STUDENT DEBT:      Cleared ✓`,
    creditState.active?`CREDIT SCORE:      ${creditState.score}`:'',
    '','─── SAVINGS & INVESTING ──────────────',
    `TOTAL INVESTED:    ${formatCurrency(ti)}`,
    `PORTFOLIO VALUE:   ${formatCurrency(pv)}`,
    `INVESTMENT GROWTH: +${formatCurrency(Math.max(0,ig))}`,
    `GROWTH MULTIPLIER: ${gm}×`,
    `SAVINGS RATE:      ${sr}% of income`,
    `CANADIAN AVERAGE:  ~4% of income`,
    '','─── REPORT CARD ──────────────────────',
    `OVERALL:           ${grade.letter} — ${grade.label}`,
    `SAVINGS HABIT:     ${savG.l}`, `INVESTING:         ${invG.l}`,
    `EMERGENCY FUND:    ${efG.l}`, `DEBT MANAGEMENT:   ${debtG.l}`, `CREDIT:            ${ccG.l}`,
    '','─── KEY INSIGHTS ─────────────────────',
    `• ${savIns}`, `• ${invIns}`, `• ${efIns}`, `• ${debtIns}`, `• ${homeIns}`,
    '','═══════════════════════════════════════',
  ].filter(x=>x!==null&&x!==undefined).join('\n');

  const card=document.getElementById('month-card'), welcome=document.getElementById('welcome-card');
  welcome.classList.add('hidden'); card.classList.remove('hidden');
  if(!document.getElementById('btn-confirm-month')) restoreMonthCard();

  card.innerHTML=`<div class="debrief-screen">
    <div class="debrief-header">
      <div class="debrief-header__badge">🍁 Age 30 — Game Complete</div>
      <div class="debrief-header__grade" style="color:${grade.color}">${grade.icon} ${grade.label}</div>
      <div class="debrief-header__letter" style="color:${grade.color}">${grade.letter}</div>
    </div>
    <div class="debrief-ribbon">
      ${st('Net Worth',formatCurrency(nw),nw>=0?'pos':'neg')}${st('Total Earned',formatCurrency(totalIncome))}${st('Savings Rate',sr+'%',sr>=10?'pos':'neg')}
      ${st('Portfolio',formatCurrency(pv),'pos')}${st('Invest Growth','+'+formatCurrency(Math.max(0,ig)),'pos')}${st('Monthly Income',formatCurrency(incomeState.baseIncome)+'/mo','pos')}
    </div>
    <div class="debrief-insight-box"><span class="debrief-insight-box__label">💡 Power of Investing</span>
      <p class="debrief-insight-box__body">Without investing, your wealth would be ~${formatCurrency(Math.round(gameState.cash+efb+(hasHome?gameState.homeEquity:0)))}. Investing added +${formatCurrency(Math.max(0,ig))} in growth.</p></div>
    <div class="debrief-section-title">📊 Report Card</div>
    <div class="debrief-cats">
      ${cat('💰','Savings Habit',savG,savIns)}${cat('📈','Investing',invG,invIns)}
      ${cat('🛡️','Emergency Fund',efG,efIns)}${cat('🎓','Debt Management',debtG,debtIns)}
      ${cat('💳','Credit',ccG,creditState.active?`Score: ${creditState.score}. ${creditState.missedPayments===0?'No missed payments.':creditState.missedPayments+' missed payment(s).'}`:'No credit card opened.')}
    </div>
    <div class="debrief-section-title">📋 Full Breakdown</div>
    <div class="debrief-grid">
      <div class="debrief-group"><div class="debrief-group__title">🏠 Assets</div>
        ${st('Cash',formatCurrency(Math.round(gameState.cash)))}${st('HISA',formatCurrency(Math.round(gameState.hisa)),'pos')}
        ${st('Emergency Fund',formatCurrency(efb),'pos')}${st('TFSA',formatCurrency(Math.round(gameState.tfsa)),'pos')}
        ${st('RRSP',formatCurrency(Math.round(gameState.rrsp)),'pos')}
        ${hasHome?st('Home Equity',formatCurrency(Math.round(gameState.homeEquity)),'pos'):''}</div>
      <div class="debrief-group"><div class="debrief-group__title">📊 Investing</div>
        ${st('Contributed',formatCurrency(ti))}${st('Portfolio',formatCurrency(pv),'pos')}
        ${st('Growth','+'+formatCurrency(Math.max(0,ig)),'pos')}${st('Multiplier',gm+'×',pv>ti?'pos':'')}
        ${st('Savings Rate',sr+'%',sr>=4?'pos':'neg')}${st('Cdn. Average','4%')}</div>
      <div class="debrief-group"><div class="debrief-group__title">🎯 Life</div>
        ${st('Career',career)}${hasHome?st('Housing','Homeowner'):st('Housing','Renter')}
        ${hasHome?st('Home Value',formatCurrency(Math.round(gameState.homeValue))):''}
        ${sd===0?st('Student Debt','Cleared ✓','pos'):st('Student Debt','-'+formatCurrency(sd),'neg')}
        ${creditState.active?st('Credit Score',creditState.score.toString(),creditState.score>=700?'pos':creditState.score>=600?'':'neg'):st('Credit','No card')}
        ${st('EF Coverage',(efc*3).toFixed(1)+' months',efc>=1?'pos':'neg')}</div>
    </div>
    <div class="debrief-insight-box" style="margin-top:12px"><span class="debrief-insight-box__label">🏠 Housing</span><p class="debrief-insight-box__body">${homeIns}</p></div>
    <div class="debrief-section-title" style="margin-top:20px">📄 Submission Summary</div>
    <p style="font-size:0.78rem;color:var(--clr-muted);margin-bottom:10px">Copy and paste into your assignment document.</p>
    <textarea class="debrief-copy-area" id="debrief-area" readonly>${summary}</textarea>
    <button class="debrief-copy-btn" id="debrief-copy">📋 Copy to Clipboard</button>
    <div class="debrief-copy-confirm hidden" id="debrief-confirm">✓ Copied! Paste it into your document.</div>
    <button class="debrief-play-again" onclick="location.reload()">🔄 Play Again</button>
  </div>`;

  document.getElementById('debrief-copy').addEventListener('click',()=>{
    const a=document.getElementById('debrief-area'); a.select(); a.setSelectionRange(0,99999);
    navigator.clipboard?.writeText(a.value).catch(()=>document.execCommand('copy')).finally(()=>{
      const c=document.getElementById('debrief-confirm'); c.classList.remove('hidden');
      setTimeout(()=>c.classList.add('hidden'),3000);
    })||(document.execCommand('copy'),document.getElementById('debrief-confirm').classList.remove('hidden'),setTimeout(()=>document.getElementById('debrief-confirm').classList.add('hidden'),3000));
  });
}

/* ══════════════════════════════════════════════════════════
   BUDGET CHALLENGE
   Shows once before month 1. Student sees their income and
   fixed expenses, then sets a monthly savings goal with a
   slider. Stored in budgetGoal — tracked throughout the game.
   ══════════════════════════════════════════════════════════ */

const budgetGoal = {
  monthlyTarget:  0,   // player-set monthly savings goal
  yearlyActual:   0,   // savings accumulated this calendar year
  yearStartNW:    0,   // net worth at start of each year (for delta calc)
  totalInvested:  0,   // total put into savings accounts across the game
};

function showBudgetChallenge() {
  const income   = Math.round(incomeState.baseIncome + (incomeState.osapMonthly || 0));
  const expenses = Math.round(expenseState.monthlyTotal);
  const surplus  = Math.max(0, income - expenses);
  const maxGoal  = Math.min(surplus, Math.round(income * 0.5)); // cap at 50%

  // Pre-set slider to ~10% of income as a starting suggestion
  const suggested = Math.round(income * 0.10 / 50) * 50; // round to nearest $50

  budgetGoal.yearStartNW = gameState.netWorth;

  setMonthCardContent(`
    <div class="budget-challenge">
      <span class="budget-challenge__badge">🎯 Before You Begin</span>
      <h2 class="budget-challenge__heading">Set Your Savings Goal</h2>
      <p class="budget-challenge__sub">Before month 1, look at your income and expenses — then commit to a monthly savings target. You'll see how you track against it every year.</p>

      <div class="budget-snapshot">
        <div class="budget-snapshot__title">📊 Your Monthly Budget</div>
        <div class="budget-row">
          <span class="budget-row__label">💼 Monthly Income</span>
          <span class="budget-row__val pos">+${formatCurrency(income)}</span>
        </div>
        <div class="budget-row">
          <span class="budget-row__label">🏠 Rent / Housing</span>
          <span class="budget-row__val neg">-${formatCurrency(expenseState.rent)}</span>
        </div>
        <div class="budget-row">
          <span class="budget-row__label">🍎 Food</span>
          <span class="budget-row__val neg">-${formatCurrency(expenseState.food)}</span>
        </div>
        <div class="budget-row">
          <span class="budget-row__label">🚗 Transport</span>
          <span class="budget-row__val neg">-${formatCurrency(expenseState.transport)}</span>
        </div>
        <div class="budget-row">
          <span class="budget-row__label">📱 Phone + Other</span>
          <span class="budget-row__val neg">-${formatCurrency(expenseState.phone + expenseState.other)}</span>
        </div>
        <div class="budget-row budget-row--total">
          <span class="budget-row__label">💰 Available to Save</span>
          <span class="budget-row__val pos">+${formatCurrency(surplus)}</span>
        </div>
      </div>

      <div class="budget-goal-section">
        <span class="budget-goal-section__label">🎯 I commit to saving at least this much every month:</span>
        <div class="budget-goal-slider-row">
          <input type="range" class="budget-goal-slider" id="budget-slider"
            min="0" max="${maxGoal}" step="50" value="${suggested}" />
          <div class="budget-goal-val" id="budget-goal-display">${formatCurrency(suggested)}</div>
        </div>
        <div class="budget-goal-pct" id="budget-goal-pct">
          That's <strong>${Math.round(suggested/income*100)}%</strong> of your income.
          The Canadian average is <strong>~4%</strong>.
        </div>
      </div>

      <div class="budget-challenge__tip">
        💡 <strong>Financial advisors recommend saving 10–20%</strong> of your income, especially when you're young. The earlier you start, the more compound growth works in your favour. Even $100/month invested at 18 is worth far more than $200/month starting at 25.
      </div>

      <button class="budget-challenge__start" id="budget-start-btn">
        Start My Financial Journey →
      </button>
    </div>`);

  const slider  = document.getElementById('budget-slider');
  const display = document.getElementById('budget-goal-display');
  const pct     = document.getElementById('budget-goal-pct');

  slider.addEventListener('input', () => {
    const val = parseInt(slider.value);
    display.textContent = formatCurrency(val);
    const p = income > 0 ? Math.round(val/income*100) : 0;
    pct.innerHTML = `That's <strong>${p}%</strong> of your income. The Canadian average is <strong>~4%</strong>.`;
  });

  document.getElementById('budget-start-btn').addEventListener('click', () => {
    budgetGoal.monthlyTarget = parseInt(slider.value) || 0;
    budgetGoal.yearStartNW   = gameState.netWorth;
    budgetGoal.yearlyActual  = 0;
    _yearInvestedAccum = 0;
    if (typeof takeYearSnapshot === 'function') takeYearSnapshot();
    // Zero variance for month 1 so actual income matches what the budget challenge showed
    incomeState.varianceOverride = 0;
    // Advance month 1 — processes income/expenses and shows a populated month card
    advanceMonth();
    // Restore normal variance after month 1 fires
    incomeState.varianceOverride = null;
  });

  btnNextMonth.disabled = true;
}


/* ══════════════════════════════════════════════════════════
   SCHOOL YEAR-END SCREEN
   Fires at the end of each school year (month % 12 === 0)
   while loanState.inSchool is true. Consolidates:
   - Tuition recap (if tuition was due this year)
   - Year-in-numbers stats
   - Interests update
   - Discussion question
   ══════════════════════════════════════════════════════════ */
function showSchoolYearEnd(yearNum, _unused, ctx) {
  window._ffInterrupted = true;

  // Compute year stats
  const nwChange   = gameState.netWorth - _yearSnapshot.netWorth;
  const invested   = _yearInvestedAccum;
  const nwSign     = nwChange >= 0 ? '+' : '';
  const nwColor    = nwChange >= 0 ? 'var(--clr-green,#2e7d32)' : '#c0392b';
  const nwIcon     = nwChange >= 2000 ? '🚀' : nwChange >= 0 ? '📈' : '📉';

  // The tuition was paid at the START of this school year (month N*12+1).
  // We show it as a reminder of the cost incurred this year.
  const tuitionPaid = loanState.yearlyTuition || 0;
  // yearNum = gameState.month / 12, which is exactly the school year just completed
  // (month 12 = end of year 1, month 24 = end of year 2, etc.)
  const schoolYear  = yearNum;
  const totalYears  = loanState.yearsInSchool;

  // Debt status
  const currentDebt = Math.round(loanState.studentDebt);
  const debtLine    = currentDebt > 0
    ? `<div class="review-stat review-stat--neg"><span>Student Debt</span><strong class="neg">${formatCurrency(currentDebt)}</strong></div>`
    : `<div class="review-stat review-stat--pos"><span>Student Debt</span><strong class="pos">$0 — debt-free!</strong></div>`;

  // Tuition line
  const isTrades = loanState.yearlyTuition === 0 && loanState.active;
  const histLabel   = isTrades ? '🔧 Apprentice Year' : '📚 School Year';
  const panelTitle  = isTrades ? '🔧 Apprenticeship Progress' : '🎓 Academic Progress';

  const tuitionLine = tuitionPaid > 0
    ? `<div class="review-stat"><span>Tuition This Year</span><strong>${formatCurrency(tuitionPaid)}</strong></div>`
    : '';

  // Savings insight
  let insight;
  if (invested === 0) {
    insight = isTrades
      ? '⚠️ No savings this year — even $25/month in a HISA builds the habit while you\'re earning as an apprentice.'
      : '⚠️ No savings this year — even $25/month in a HISA builds the habit and earns interest. Small amounts add up before graduation.';
  } else if (invested >= 500) {
    insight = isTrades
      ? `✅ You managed to save ${formatCurrency(invested)} while apprenticing — a great start. Money invested now has the most time to compound.`
      : `✅ You managed to save ${formatCurrency(invested)} while in school — a great start. Money invested now has the most time to compound.`;
  } else {
    insight = isTrades
      ? `📈 You saved ${formatCurrency(invested)} this year. Apprenticeship wages can be tight — every dollar saved is a dollar working for you.`
      : `📈 You saved ${formatCurrency(invested)} this year. School is tough on budgets, but every dollar saved is a dollar working for you.`;
  }

  // OSAP recap
  const osapMonthly = incomeState.osapMonthly || 0;
  const osapAnnual  = Math.round(osapMonthly * 12);
  const osapLine    = osapAnnual > 0
    ? `<div class="review-stat"><span>OSAP Received</span><strong class="pos">+${formatCurrency(osapAnnual)}</strong></div>`
    : '';

  const question = REFLECTION_QUESTIONS[(yearNum - 1) % REFLECTION_QUESTIONS.length];

  // Add history marker
  const histDiv = document.createElement('div');
  histDiv.className = 'history-tax-marker history-tax-marker--review';
  histDiv.innerHTML = `<span>${histLabel} ${schoolYear}/${totalYears} Complete</span><span style="color:${nwColor}">${nwSign}${formatCurrency(nwChange)}</span>`;
  historyFeed.insertBefore(histDiv, historyFeed.firstChild);

  const yearsLeft = totalYears - schoolYear;
  const progressPct = Math.round((schoolYear / totalYears) * 100);
  const yearBadgeLabel = isTrades ? '🔧 Apprentice Year' : '📚 School Year';
  const continueLabel  = yearsLeft > 0
    ? (isTrades ? 'Continue Apprenticeship Year ' + (schoolYear + 1) + ' →' : 'Start Year ' + (schoolYear + 1) + ' →')
    : (isTrades ? 'Complete Apprenticeship →' : 'Continue to Graduation →');

  setMonthCardContent(`
    <div class="year-reflection year-end-combined">
      <div class="year-reflection__badge">${yearBadgeLabel} ${schoolYear} of ${totalYears} Complete · Age ~${17 + yearNum}</div>

      <div class="year-end-combined__sections">

        <!-- School/Apprenticeship Progress Panel -->
        <div class="year-end-combined__panel year-end-combined__panel--career">
          <div class="year-end-combined__panel-title">${panelTitle}</div>
          <div style="margin:8px 0 12px">
            <div style="background:var(--clr-border);border-radius:6px;height:8px;overflow:hidden">
              <div style="background:var(--clr-forest);height:100%;width:${progressPct}%;transition:width 0.4s"></div>
            </div>
            <div style="font-size:0.72rem;color:var(--clr-muted);margin-top:4px">${progressPct}% through your program · ${yearsLeft > 0 ? yearsLeft + ' year' + (yearsLeft > 1 ? 's' : '') + ' left' : 'Final year done!'}</div>
          </div>
          <div class="review-stats">
            ${tuitionLine}
            ${debtLine}
            ${osapLine}
          </div>
          ${tuitionPaid > 0
            ? `<div class="review-note" style="margin-top:8px">💡 Paying tuition from cash saves you ${formatCurrency(Math.round(tuitionPaid * 1.5))} in interest over a 10-year repayment. Loans are fine — but cash is cheaper.</div>`
            : ''}
        </div>

        <!-- Year-End Stats Panel -->
        <div class="year-end-combined__panel year-end-combined__panel--reflect">
          <div class="year-end-combined__panel-title">${nwIcon} Year in Numbers</div>
          <div class="year-end-combined__nw" style="color:${nwColor}">${nwSign}${formatCurrency(nwChange)}</div>
          <div class="year-end-combined__nw-label">Net Worth Change</div>
          <div class="review-stats">
            <div class="review-stat ${nwChange >= 0 ? 'review-stat--pos' : 'review-stat--neg'}">
              <span>Net Worth Now</span><strong>${formatCurrency(gameState.netWorth)}</strong>
            </div>
            <div class="review-stat ${invested > 0 ? 'review-stat--pos' : ''}">
              <span>Total Saved</span><strong class="${invested > 0 ? 'pos' : ''}">${formatCurrency(invested)}</strong>
            </div>
            <div class="review-stat">
              <span>Emergency Fund</span><strong>${formatCurrency(Math.round(gameState.emergencyFund))}</strong>
            </div>
            <div class="review-stat">
              <span>Cash on Hand</span><strong>${formatCurrency(Math.round(gameState.cash))}</strong>
            </div>
          </div>
          <div class="year-reflection__insight" style="margin-top:8px">${insight}</div>
        </div>

      </div>

      <div class="year-reflection__question">
        💬 <strong>Think about it:</strong> ${question}
      </div>

      <div class="interests-review-card" id="school-interests-review">
        <div class="interests-review-card__title">🎯 Update Your Interests for Year ${yearNum + 1}</div>
        <p style="font-size:0.78rem;color:var(--clr-muted);margin-bottom:10px">Adjust your lifestyle interests — they shape the monthly spending decisions you face.</p>
        <div class="interests-review-grid" id="school-interests-grid">
          ${INTERESTS_LIST.map(i => `
            <button class="interests-review-chip${(playerSetup.interests||[]).includes(i.id) ? ' selected' : ''}" data-interest="${i.id}">
              <span>${i.icon} ${i.label}</span>
              <span class="interests-review-chip__check">✓</span>
            </button>`).join('')}
        </div>
        <button class="btn-save-interests" id="btn-save-interests-school">Save Interests ✓</button>
      </div>

      <button class="btn-confirm-month review-continue hidden" id="btn-school-yearend-continue">
        ${continueLabel}
      </button>
    </div>`);

  // Wire interests chips
  const schoolGrid = document.getElementById('school-interests-grid');
  let pendingSchoolInterests = [...(playerSetup.interests || [])];
  if (schoolGrid) {
    schoolGrid.querySelectorAll('.interests-review-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.interest;
        const idx = pendingSchoolInterests.indexOf(id);
        if (idx === -1) {
          if (pendingSchoolInterests.length >= 5) return;
          pendingSchoolInterests.push(id);
          chip.classList.add('selected');
        } else {
          pendingSchoolInterests.splice(idx, 1);
          chip.classList.remove('selected');
        }
      });
    });
  }

  const btnSaveSchool = document.getElementById('btn-save-interests-school');
  if (btnSaveSchool) {
    btnSaveSchool.addEventListener('click', () => {
      if (pendingSchoolInterests.length === 0) return;
      playerSetup.interests = pendingSchoolInterests;
      btnSaveSchool.textContent = '✅ Interests saved!';
      btnSaveSchool.disabled = true;
      const cont = document.getElementById('btn-school-yearend-continue');
      if (cont) cont.classList.remove('hidden');
    });
  }

  document.getElementById('btn-school-yearend-continue').addEventListener('click', () => {
    _yearInvestedAccum = 0;
    takeYearSnapshot();
    restoreMonthCard();
    // If this was the final year, graduate now before resuming — prevents
    // the next month boundary from firing another tuition prompt.
    if (yearsLeft === 0) {
      loanState.inSchool = false;
      updateLoanDisplay();
      const justGrad = checkIncomePhaseTransition();
      if (finishMonth._pendingCtx) finishMonth._pendingCtx.justGraduated = justGrad;
    }
    resumeMonthAfterInterstitial();
  });

  btnNextMonth.disabled = true;
}

/* ══════════════════════════════════════════════════════════
   YEAR-END COMBINED SCREEN
   Fires when the annual career review and year-end reflection
   both fall on the same month (month % 12 === 0).
   Shows career review result + year stats in one single screen
   so neither event gets skipped.
   ══════════════════════════════════════════════════════════ */
function showYearEndCombined(reviewResult, taxResult, yearNum) {
  window._ffInterrupted = true;

  // ── Career review section ──
  const job  = jobOfferState.chosenJob;
  const stab = job ? job.stability : 'medium';
  let reviewBadge, reviewIcon, reviewHeading, reviewBodyHTML, reviewStatsHTML, reviewNoteHTML;

  if (reviewResult.type === 'promotion') {
    reviewBadge    = 'Promotion 🏆';
    reviewIcon     = '🏆';
    reviewHeading  = 'You have been promoted!';
    reviewBodyHTML = 'Your hard work paid off. Title changed to <strong>' + job.title + '</strong>.';
    reviewStatsHTML =
      '<div class="review-stat review-stat--pos"><span>New Salary</span><strong>' + formatCurrency(reviewResult.newSalary) + '/mo</strong></div>' +
      '<div class="review-stat"><span>Raise</span><strong class="pos">+' + formatCurrency(reviewResult.raiseAmt) + '/mo (+' + Math.round(reviewResult.raiseAmt / reviewResult.oldSalary * 100) + '%)</strong></div>';
    reviewNoteHTML = '💡 A promotion is the fastest income growth. Increase your TFSA contributions this year.';
  } else if (reviewResult.type === 'raise') {
    reviewBadge    = 'Annual Raise 📈';
    reviewIcon     = '📈';
    reviewHeading  = 'Annual performance review';
    reviewBodyHTML = 'Solid year. Your employer recognizes your contribution with a merit raise.';
    reviewStatsHTML =
      '<div class="review-stat review-stat--pos"><span>New Salary</span><strong>' + formatCurrency(reviewResult.newSalary) + '/mo</strong></div>' +
      '<div class="review-stat"><span>Raise</span><strong class="pos">+' + formatCurrency(reviewResult.raiseAmt) + '/mo</strong></div>';
    reviewNoteHTML = '💡 Even 2–3% compounds significantly. Invest the difference to accelerate your net worth.';
  } else if (reviewResult.type === 'bonus') {
    reviewBadge    = 'Bonus Year 🎉';
    reviewIcon     = '🎉';
    reviewHeading  = 'Bonus! Great year.';
    reviewBodyHTML = 'Strong performance earned you a bonus — added to your cash. You also received a small raise.';
    reviewStatsHTML =
      '<div class="review-stat review-stat--pos"><span>Bonus</span><strong>' + formatCurrency(reviewResult.bonusAmt) + ' (cash)</strong></div>' +
      '<div class="review-stat"><span>New Salary</span><strong>' + formatCurrency(reviewResult.newSalary) + '/mo</strong></div>';
    reviewNoteHTML = '💡 A bonus is a great chance to max your TFSA or FHSA. Resist spending it all at once.';
  } else if (reviewResult.type === 'flat') {
    const flatReason = { high: 'Tight budget year — your role is secure, raises are on hold.', medium: 'Mixed results company-wide — salary adjustments paused.', low: 'Tough market. You kept your job — that alone is a win.' };
    reviewBadge    = 'No Raise ⏸️';
    reviewIcon     = '⏸️';
    reviewHeading  = 'Flat year.';
    reviewBodyHTML = flatReason[stab] || flatReason.medium;
    reviewStatsHTML = '<div class="review-stat"><span>Salary</span><strong>' + formatCurrency(reviewResult.newSalary) + '/mo (unchanged)</strong></div>';
    reviewNoteHTML = '💡 A flat year is a signal to negotiate, upskill, or consider switching roles.';
  } else if (reviewResult.type === 'layoff') {
    reviewBadge    = 'Layoff ⚠️';
    reviewIcon     = '⚠️';
    reviewHeading  = 'You have been laid off.';
    reviewBodyHTML = 'Budget cuts hit your team. Income reduced for <strong>' + reviewResult.months + ' months</strong>, then recovers.';
    reviewStatsHTML =
      '<div class="review-stat review-stat--neg"><span>Reduced Income</span><strong class="neg">' + formatCurrency(reviewResult.reducedSalary) + '/mo (' + Math.round(reviewResult.dropPct * 100) + '% drop)</strong></div>' +
      '<div class="review-stat"><span>Duration</span><strong>' + reviewResult.months + ' months</strong></div>';
    reviewNoteHTML = '🛡️ This is why an Emergency Fund exists. Lean on it, pause discretionary investing, income will recover.';
  }

  // ── Year-end reflection section ──
  const nwChange  = gameState.netWorth - _yearSnapshot.netWorth;
  const invested  = _yearInvestedAccum;
  const income    = Math.round(incomeState.baseIncome);
  const sr        = income > 0 ? Math.min(100, Math.round(invested / (income * 12) * 100)) : 0;
  const goalMet   = budgetGoal.monthlyTarget > 0 && invested >= (budgetGoal.monthlyTarget * 12 * 0.8);
  const hasGoal   = budgetGoal.monthlyTarget > 0;
  const nwSign    = nwChange >= 0 ? '+' : '';
  const nwColor   = nwChange >= 0 ? 'var(--clr-green,#2e7d32)' : '#c0392b';
  const nwIcon    = nwChange >= 5000 ? '🚀' : nwChange >= 0 ? '📈' : '📉';

  let insight;
  if (invested === 0) {
    insight = '⚠️ You didn\'t invest anything this year. Even $50/month in a HISA builds the habit.';
  } else if (sr >= 20) {
    insight = `🌟 You saved ${sr}% of income — well above Canada's 4% average. That discipline compounds.`;
  } else if (sr >= 10) {
    insight = `✅ You saved ${sr}% of income — hitting the classic 10% benchmark. Keep going.`;
  } else if (sr >= 4) {
    insight = `📈 You saved ${sr}% — ahead of the Canadian average. Push toward 10% next year.`;
  } else {
    insight = `💡 You saved ${sr}% — below Canada's 4% average. Find one spending category to reduce.`;
  }
  if (nwChange < 0 && !jobOfferState.layoffActive) {
    insight = '⚠️ Net worth dropped this year. Review whether expenses are outpacing income — adjust, don\'t panic.';
  }

  let goalHTML;
  if (!hasGoal) {
    goalHTML = '<div class="year-reflection__goal-result year-reflection__goal-result--none">No savings goal was set. Next year, try committing to a monthly target — even $100/month makes a difference.</div>';
  } else if (goalMet) {
    goalHTML = `<div class="year-reflection__goal-result year-reflection__goal-result--met">🎯 Goal met! Aimed for ${formatCurrency(budgetGoal.monthlyTarget)}/mo and saved ${formatCurrency(invested)} — ${formatCurrency(Math.round(invested/12))}/mo avg.</div>`;
  } else {
    const shortBy = Math.round(budgetGoal.monthlyTarget * 12 - invested);
    goalHTML = `<div class="year-reflection__goal-result year-reflection__goal-result--missed">📌 Goal missed. Aimed for ${formatCurrency(budgetGoal.monthlyTarget)}/mo but averaged ${formatCurrency(Math.round(invested/12))}/mo. ${formatCurrency(shortBy)} short.</div>`;
  }

  const taxLine = taxResult
    ? `<div class="review-stat"><span>Tax Filing</span><strong class="${taxResult.summary.includes('Refund') || taxResult.summary.includes('+') ? 'pos' : ''}">${taxResult.summary}</strong></div>`
    : '';

  const question = REFLECTION_QUESTIONS[(yearNum - 1) % REFLECTION_QUESTIONS.length];

  // ── Add to history feed ──
  const histCareer = document.createElement('div');
  histCareer.className = 'history-tax-marker history-tax-marker--review';
  histCareer.innerHTML =
    '<span>' + reviewIcon + ' Year ' + yearNum + ' Review: ' + reviewResult.type.charAt(0).toUpperCase() + reviewResult.type.slice(1) + '</span>' +
    '<span>' + (reviewResult.type === 'promotion' ? '+' + formatCurrency(reviewResult.raiseAmt) + '/mo' :
                reviewResult.type === 'bonus'     ? '+' + formatCurrency(reviewResult.bonusAmt) :
                reviewResult.type === 'layoff'    ? '−' + Math.round(reviewResult.dropPct * 100) + '% income' :
                reviewResult.type === 'flat'      ? 'No raise' :
                '+' + formatCurrency(reviewResult.raiseAmt) + '/mo') + '</span>';
  historyFeed.insertBefore(histCareer, historyFeed.firstChild);

  const histReflect = document.createElement('div');
  histReflect.className = 'history-tax-marker history-tax-marker--review';
  histReflect.innerHTML = `<span>📅 Year ${yearNum} in Review</span><span style="color:${nwColor}">${nwSign}${formatCurrency(nwChange)}</span>`;
  historyFeed.insertBefore(histReflect, historyFeed.firstChild);

  // ── Render combined card ──
  setMonthCardContent(`
    <div class="year-reflection year-end-combined">
      <div class="year-reflection__badge">📅 Year ${yearNum} Complete · Age ~${17 + yearNum}</div>

      <div class="year-end-combined__sections">

        <!-- Career Review Panel -->
        <div class="year-end-combined__panel year-end-combined__panel--career">
          <div class="year-end-combined__panel-title">${reviewIcon} Career Review: ${reviewBadge}</div>
          <p class="review-card__body" style="margin:6px 0 8px">${reviewBodyHTML}</p>
          <div class="review-stats" style="margin-bottom:6px">${reviewStatsHTML}</div>
          <div class="review-note" style="margin:0">${reviewNoteHTML}</div>
        </div>

        <!-- Year-End Stats Panel -->
        <div class="year-end-combined__panel year-end-combined__panel--reflect">
          <div class="year-end-combined__panel-title">${nwIcon} Year in Numbers</div>
          <div class="year-end-combined__nw" style="color:${nwColor}">${nwSign}${formatCurrency(nwChange)}</div>
          <div class="year-end-combined__nw-label">Net Worth Change</div>
          <div class="review-stats">
            <div class="review-stat ${nwChange >= 0 ? 'review-stat--pos' : 'review-stat--neg'}">
              <span>Net Worth Now</span><strong>${formatCurrency(gameState.netWorth)}</strong>
            </div>
            <div class="review-stat ${invested > 0 ? 'review-stat--pos' : ''}">
              <span>Total Saved / Invested</span><strong class="${invested > 0 ? 'pos' : ''}">${formatCurrency(invested)}</strong>
            </div>
            <div class="review-stat">
              <span>Savings Rate</span>
              <strong class="${sr >= 10 ? 'pos' : sr >= 4 ? '' : 'neg'}">${sr}% of income</strong>
            </div>
            <div class="review-stat">
              <span>Emergency Fund</span><strong>${formatCurrency(Math.round(gameState.emergencyFund))}</strong>
            </div>
            ${taxLine}
          </div>
          ${goalHTML}
          <div class="year-reflection__insight" style="margin-top:8px">${insight}</div>
        </div>

      </div>

      <div class="year-reflection__question">
        💬 <strong>Think about it:</strong> ${question}
      </div>

      <div class="interests-review-card" id="interests-review-section">
        <div class="interests-review-card__title">🎯 Update Your Interests for Year ${yearNum + 1}</div>
        <p style="font-size:0.78rem;color:var(--clr-muted);margin-bottom:10px">Your lifestyle interests shape the monthly decisions you face. Adjust them to reflect how your life is evolving.</p>
        <div class="interests-review-grid" id="interests-review-grid">
          ${INTERESTS_LIST.map(i => `
            <button class="interests-review-chip${(playerSetup.interests||[]).includes(i.id) ? ' selected' : ''}" data-interest="${i.id}">
              <span>${i.icon} ${i.label}</span>
              <span class="interests-review-chip__check">✓</span>
            </button>`).join('')}
        </div>
        <button class="btn-save-interests" id="btn-save-interests-yearend">Save Interests ✓</button>
      </div>

      <button class="btn-confirm-month review-continue hidden" id="btn-yearend-combined-continue">
        Start Year ${yearNum + 1} →
      </button>
    </div>`);

  // ── Wire interests review in year-end combined ──
  const interestReviewGrid = document.getElementById('interests-review-grid');
  let pendingInterests = [...(playerSetup.interests || [])];

  if (interestReviewGrid) {
    interestReviewGrid.querySelectorAll('.interests-review-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.interest;
        const idx = pendingInterests.indexOf(id);
        if (idx === -1) {
          if (pendingInterests.length >= 5) return;
          pendingInterests.push(id);
          chip.classList.add('selected');
        } else {
          pendingInterests.splice(idx, 1);
          chip.classList.remove('selected');
        }
      });
    });
  }

  const btnSaveInterests = document.getElementById('btn-save-interests-yearend');
  if (btnSaveInterests) {
    btnSaveInterests.addEventListener('click', () => {
      if (pendingInterests.length === 0) return;
      playerSetup.interests = pendingInterests;
      btnSaveInterests.textContent = '✅ Interests saved!';
      btnSaveInterests.disabled = true;
      // Reveal the continue button
      const cont = document.getElementById('btn-yearend-combined-continue');
      if (cont) cont.classList.remove('hidden');
    });
  }

  document.getElementById('btn-yearend-combined-continue').addEventListener('click', () => {
    _yearInvestedAccum = 0;
    takeYearSnapshot();
    restoreMonthCard();
    resumeMonthAfterInterstitial();
  });

  btnNextMonth.disabled = true;
}

/* ══════════════════════════════════════════════════════════
   YEAR-END REFLECTION
   Fires every 12 months (when working). Shows:
   - Year number and age
   - Net worth change this year
   - Income earned, expenses paid, amount invested
   - Savings rate vs. goal
   - One personalized insight
   - One discussion question
   ══════════════════════════════════════════════════════════ */

// Snapshot taken at the START of each year so we can compute the delta
const _yearSnapshot = { netWorth: 0, totalInvested: 0, month: 0 };

function takeYearSnapshot() {
  _yearSnapshot.netWorth      = gameState.netWorth;
  _yearSnapshot.totalInvested = _currentYearInvested();
  _yearSnapshot.month         = gameState.month;
}

// Accumulator: total contributed to savings this year (reset each reflection)
let _yearInvestedAccum = 0;

function _currentYearInvested() {
  return _yearInvestedAccum;
}

// Call this from confirmMonth to track savings
function trackYearlyInvested(amount) {
  _yearInvestedAccum += amount;
  budgetGoal.totalInvested += amount;
}

const REFLECTION_QUESTIONS = [
  'Did you hit your savings goal this year? What got in the way — or what helped?',
  'Look at your net worth change. Which accounts grew the most? Why?',
  'If you could change one financial decision from this year, what would it be?',
  'Your investments earned money while you slept. How much of your growth came from working vs. investing?',
  'What was the biggest unexpected expense this year? How prepared were you?',
  'If you earned more money next year, what would you do differently with it?',
  'Compare your savings rate to the Canadian average of 4%. Are you happy with the gap?',
  'What would your net worth look like if you had saved $100 more per month this year?',
  'Did your Emergency Fund protect you from anything this year? How would things have gone without it?',
  'You\'re getting closer to 30. What financial goal matters most to you right now?',
  'Would you rather earn more or spend less? Which had a bigger impact on your finances this year?',
  'Think about the "wants" decisions you made this year. Any regrets? Any you\'re glad you made?',
];

function showYearReflection(yearNum, taxResult) {
  window._ffInterrupted = true;  // pause fast-forward for year-end reflection
  const age       = 18 + yearNum;  // at end of year N, player is 18+N years old
  const nwChange  = gameState.netWorth - _yearSnapshot.netWorth;
  const invested  = _yearInvestedAccum;
  const income    = Math.round(incomeState.baseIncome);
  const sr        = income > 0 ? Math.min(100, Math.round(invested / (income * 12) * 100)) : 0;
  const goalMet   = budgetGoal.monthlyTarget > 0 && invested >= (budgetGoal.monthlyTarget * 12 * 0.8); // 80% counts
  const hasGoal   = budgetGoal.monthlyTarget > 0;

  // Pick insight based on what happened this year
  let insight;
  if (invested === 0) {
    insight = '⚠️ You didn\'t invest anything this year. Even putting $50/month into a HISA would have earned interest and built the habit. Small consistent amounts beat large irregular ones every time.';
  } else if (sr >= 20) {
    insight = `🌟 You saved ${sr}% of your income this year — well above the Canadian average of 4%. That kind of discipline, compounded over a career, is how real wealth is built.`;
  } else if (sr >= 10) {
    insight = `✅ You saved ${sr}% of your income this year, which puts you ahead of most Canadians. The 10% rule is a classic benchmark — you\'re hitting it.`;
  } else if (sr >= 4) {
    insight = `📈 You saved ${sr}% of income this year, ahead of the Canadian average of 4%. You\'re in the right direction — see if you can push toward 10% next year.`;
  } else {
    insight = `💡 You saved ${sr}% of income this year, below the Canadian average of 4%. Review where the money went — identifying one spending category to reduce is often enough to shift this.`;
  }

  if (nwChange < 0 && !jobOfferState.layoffActive) {
    insight = '⚠️ Your net worth dropped this year. Check whether expenses are outpacing income, and whether any debt is compounding. This is the time to review — not panic, but adjust.';
  }

  // Net worth change formatting
  const nwSign   = nwChange >= 0 ? '+' : '';
  const nwColor  = nwChange >= 0 ? 'var(--clr-green,#2e7d32)' : '#c0392b';
  const nwIcon   = nwChange >= 5000 ? '🚀' : nwChange >= 0 ? '📈' : '📉';

  // Goal result
  let goalHTML;
  if (!hasGoal) {
    goalHTML = `<div class="year-reflection__goal-result year-reflection__goal-result--none">No savings goal was set. Next year, try committing to a monthly target — even $100/month makes a measurable difference.</div>`;
  } else if (goalMet) {
    goalHTML = `<div class="year-reflection__goal-result year-reflection__goal-result--met">🎯 Goal met! You aimed for ${formatCurrency(budgetGoal.monthlyTarget)}/mo and saved ${formatCurrency(invested)} this year — that's ${formatCurrency(Math.round(invested/12))}/mo on average. Well done.</div>`;
  } else {
    const shortBy = Math.round(budgetGoal.monthlyTarget * 12 - invested);
    goalHTML = `<div class="year-reflection__goal-result year-reflection__goal-result--missed">📌 Goal missed. You aimed for ${formatCurrency(budgetGoal.monthlyTarget)}/mo but averaged ${formatCurrency(Math.round(invested/12))}/mo. You were ${formatCurrency(shortBy)} short for the year. What got in the way?</div>`;
  }

  // Pick a discussion question (rotate by year)
  const question = REFLECTION_QUESTIONS[(yearNum - 1) % REFLECTION_QUESTIONS.length];

  // Tax note if it fired this month
  const taxLine = taxResult
    ? `<div class="review-stat"><span>Tax Filing</span><strong class="${taxResult.summary.includes('Refund')||taxResult.summary.includes('+') ? 'pos' : ''}">${taxResult.summary}</strong></div>`
    : '';

  // Add to history feed
  const histDiv = document.createElement('div');
  histDiv.className = 'history-tax-marker history-tax-marker--review';
  histDiv.innerHTML = `<span>📅 Year ${yearNum} in Review</span><span style="color:${nwColor}">${nwSign}${formatCurrency(nwChange)}</span>`;
  historyFeed.insertBefore(histDiv, historyFeed.firstChild);

  setMonthCardContent(`
    <div class="year-reflection">
      <div class="year-reflection__badge">📅 Year ${yearNum} in Review · Age ~${age}</div>
      <div class="year-reflection__icon">${nwIcon}</div>
      <h2 class="year-reflection__heading">Year ${yearNum} Complete</h2>

      <div class="year-reflection__nw-change" style="color:${nwColor}">${nwSign}${formatCurrency(nwChange)}</div>
      <div class="year-reflection__nw-label">Net Worth Change This Year</div>

      <div class="review-stats">
        <div class="review-stat ${nwChange >= 0 ? 'review-stat--pos' : 'review-stat--neg'}">
          <span>Net Worth Now</span>
          <strong>${formatCurrency(gameState.netWorth)}</strong>
        </div>
        <div class="review-stat">
          <span>Monthly Income</span>
          <strong>${formatCurrency(income)}/mo</strong>
        </div>
        <div class="review-stat ${invested > 0 ? 'review-stat--pos' : ''}">
          <span>Total Saved / Invested</span>
          <strong class="${invested > 0 ? 'pos' : ''}">${formatCurrency(invested)}</strong>
        </div>
        <div class="review-stat">
          <span>Savings Rate</span>
          <strong class="${sr >= 10 ? 'pos' : sr >= 4 ? '' : 'neg'}">${sr}% of income</strong>
        </div>
        <div class="review-stat">
          <span>Emergency Fund</span>
          <strong>${formatCurrency(Math.round(gameState.emergencyFund))}</strong>
        </div>
        ${taxLine}
      </div>

      ${goalHTML}

      <div class="year-reflection__insight">${insight}</div>

      <div class="year-reflection__question">
        💬 <strong>Think about it:</strong> ${question}
      </div>

      <div class="interests-review-card" id="interests-review-section-solo">
        <div class="interests-review-card__title">🎯 Update Your Interests for Year ${yearNum + 1}</div>
        <p style="font-size:0.78rem;color:var(--clr-muted);margin-bottom:10px">Adjust your interests to reflect how your life is changing.</p>
        <div class="interests-review-grid" id="interests-review-grid-solo">
          ${INTERESTS_LIST.map(i => `
            <button class="interests-review-chip${(playerSetup.interests||[]).includes(i.id) ? ' selected' : ''}" data-interest="${i.id}">
              <span>${i.icon} ${i.label}</span>
              <span class="interests-review-chip__check">✓</span>
            </button>`).join('')}
        </div>
        <button class="btn-save-interests" id="btn-save-interests-solo">Save Interests ✓</button>
      </div>

      <button class="btn-confirm-month review-continue hidden" id="btn-year-continue">
        Start Year ${yearNum + 1} →
      </button>
    </div>`);

  // ── Wire interests review ──
  const soloGrid = document.getElementById('interests-review-grid-solo');
  let pendingInterestsSolo = [...(playerSetup.interests || [])];

  if (soloGrid) {
    soloGrid.querySelectorAll('.interests-review-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.interest;
        const idx = pendingInterestsSolo.indexOf(id);
        if (idx === -1) {
          if (pendingInterestsSolo.length >= 5) return;
          pendingInterestsSolo.push(id);
          chip.classList.add('selected');
        } else {
          pendingInterestsSolo.splice(idx, 1);
          chip.classList.remove('selected');
        }
      });
    });
  }

  const btnSaveInterestsSolo = document.getElementById('btn-save-interests-solo');
  if (btnSaveInterestsSolo) {
    btnSaveInterestsSolo.addEventListener('click', () => {
      if (pendingInterestsSolo.length === 0) return;
      playerSetup.interests = pendingInterestsSolo;
      btnSaveInterestsSolo.textContent = '✅ Interests saved!';
      btnSaveInterestsSolo.disabled = true;
      const cont = document.getElementById('btn-year-continue');
      if (cont) cont.classList.remove('hidden');
    });
  }

  document.getElementById('btn-year-continue').addEventListener('click', () => {
    // Reset yearly tracker
    _yearInvestedAccum = 0;
    takeYearSnapshot();
    restoreMonthCard();
    resumeMonthAfterInterstitial();
  });

  btnNextMonth.disabled = true;
}

// Take a snapshot when the game starts (for year 1 delta calculation)
// Also called at the start of each year from the continue button
(function initReflectionSystem() {
  // Will be called properly once initGame runs
  // We hook into initGame via the startLife override below
})();
