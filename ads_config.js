// WebMasti Pure Monetag Ad Engine (Monetag Smartlink + Multitag + Push Notifications)
window.WEBMASTI_ADS = {
  // 1. Monetag Direct Smartlink Link
  directAdLink: "https://omg10.com/4/11829066",

  // 2. Monetag Push Service Worker Zone
  pushZoneId: 11829074,
  pushDomain: "3nbf4.com",

  // 3. Monetag Multitag Zone
  multitagZone: 282356,

  // 4. Adsterra Social Bar Script
  adsterraSocialBarScript: "https://pl31408331.profitableratecpmnetwork.com/19/23/ca/1923ca6bbf85eb75c786980bbedb3c57.js",

  // Enable/Disable Ads
  enabled: true
};

// 45-Second Cooldown timer between ad triggers for smooth UX & high CPM
let lastAdTriggerTime = 0;
const AD_COOLDOWN_MS = 45000;

// Unified Helper function to trigger Monetag Smartlink safely in a new tab
window.triggerAdOnClick = function(force, targetUrl) {
  if (!window.WEBMASTI_ADS || !window.WEBMASTI_ADS.enabled) return false;

  const now = Date.now();
  if (!force && (now - lastAdTriggerTime < AD_COOLDOWN_MS)) {
    return false;
  }
  
  const directLink = window.WEBMASTI_ADS.directAdLink || "https://omg10.com/4/11829066";

  try {
    // Open Monetag Smartlink in new tab so original video page is never lost
    const adWin = window.open(directLink, '_blank');
    if (adWin) {
      adWin.blur();
      window.focus();
    }
    lastAdTriggerTime = now;
    return false;
  } catch (e) {
    console.log('Ad open notice:', e);
  }
  return false;
};
